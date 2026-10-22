-- RPC de synchronisation, de compte et de minuteur (contrat docs/contrat-serveur.md).

-- ---------- Outils ----------

-- Cette méthode permet de savoir si une écriture entrante est plus récente que la ligne existante (dernier gagne).
-- Égalité d'horodatage : l'identifiant d'appareil le plus grand (en texte) l'emporte.
create function private.is_newer(p_in_cua bigint, p_in_dev uuid, p_ex_cua bigint, p_ex_dev uuid) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_in_cua > p_ex_cua or (p_in_cua = p_ex_cua and p_in_dev::text > p_ex_dev::text);
$$;

-- Cette méthode permet de convertir une ligne en JSON client (horodatages en ms) lorsqu'elle est renvoyée par une RPC.
create function private.row_out(p jsonb) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare k text;
begin
  foreach k in array array['started_at', 'deleted_at', 'archived_at'] loop
    if p ? k then
      p := jsonb_set(p, array[k], coalesce(to_jsonb(private.ts_to_ms((p ->> k)::timestamptz)), 'null'::jsonb));
    end if;
  end loop;
  return p;
end;
$$;

-- Cette méthode permet de lire un tableau JSON de textes en text[] lorsqu'une ligne arrive du client.
create function private.text_array(p jsonb) returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)), '{}');
$$;

-- Cette méthode permet de générer un code d'invitation de 12 caractères sans ambiguïté lorsqu'un compte est créé ou régénère son lien.
create function private.gen_invite_code() returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  b bytea;
  s text;
begin
  loop
    b := extensions.gen_random_bytes(12);
    s := '';
    for i in 0..11 loop
      s := s || substr(alphabet, (get_byte(b, i) % 30) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = s);
  end loop;
  return s;
end;
$$;

-- Cette méthode permet de refuser un appel lorsqu'aucun utilisateur n'est authentifié, et renvoie son id sinon.
create function private.require_uid() returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- ---------- sync_push ----------

-- Cette méthode permet d'appliquer une seule ligne poussée par le client lorsqu'elle passe les contrôles d'appartenance et le dernier gagne.
-- Elle renvoie accepted, stale, rejected_not_owner, forbidden ou invalid (ligne mal formée ou contrainte violée).
create function private.push_one(p_uid uuid, p_device uuid, p_table text, r jsonb) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_cua bigint;
  v_dev uuid;
  v_user uuid;
  v_n int;
  ex record;
begin
  begin
    v_id := (r ->> 'id')::uuid;
    v_cua := (r ->> 'client_updated_at')::bigint;
    v_dev := (r ->> 'client_device_id')::uuid;
    v_user := nullif(r ->> 'user_id', '')::uuid;
  exception when others then
    return 'invalid';
  end;
  if v_id is null or v_cua is null or v_dev is null then
    return 'invalid';
  end if;

  -- Profil : mise à jour de colonnes autorisées seulement.
  if p_table = 'profiles' then
    if v_id <> p_uid then
      return 'forbidden';
    end if;
    select client_updated_at, client_device_id into ex from public.profiles where id = v_id for update;
    if not found then
      return 'forbidden';
    end if;
    if not private.is_newer(v_cua, v_dev, ex.client_updated_at, ex.client_device_id) then
      return 'stale';
    end if;
    begin
      update public.profiles set
        display_name = coalesce(r ->> 'display_name', display_name),
        avatar_path = r ->> 'avatar_path',
        settings = coalesce(r -> 'settings', settings),
        client_updated_at = v_cua,
        client_device_id = v_dev
      where id = v_id;
    exception when others then
      return 'invalid';
    end;
    return 'accepted';
  end if;

  if p_table not in ('exercises', 'folders', 'routines', 'workouts', 'body_measurements', 'exercise_prefs') then
    return 'invalid';
  end if;

  -- Appartenance de la ligne entrante.
  if p_table = 'exercises' then
    if not (v_user is not distinct from p_uid or (v_user is null and private.is_admin())) then
      return 'forbidden';
    end if;
  elsif v_user is distinct from p_uid then
    return 'forbidden';
  end if;

  execute format(
    'select user_id, client_updated_at, client_device_id, %s from public.%I where id = $1 for update',
    case when p_table = 'workouts' then 'status, owner_device_id' else 'null::text as status, null::uuid as owner_device_id' end,
    p_table)
  into ex using v_id;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    -- Une ligne existante d'un autre compte (ou du catalogue pour un non-admin) n'est jamais écrasée.
    if ex.user_id is distinct from v_user then
      return 'forbidden';
    end if;
    if p_table = 'workouts' and ex.status = 'in_progress' and ex.owner_device_id <> p_device then
      return 'rejected_not_owner';
    end if;
    if not private.is_newer(v_cua, v_dev, ex.client_updated_at, ex.client_device_id) then
      return 'stale';
    end if;
  end if;

  begin
    if p_table = 'exercises' then
      insert into public.exercises as e (id, user_id, name, equipment, primary_muscle, secondary_muscles, measurement_type,
        instructions, source_id, archived_at, client_updated_at, client_device_id, deleted_at)
      values (v_id, v_user, r ->> 'name', r ->> 'equipment', r ->> 'primary_muscle', private.text_array(r -> 'secondary_muscles'),
        r ->> 'measurement_type', r ->> 'instructions', r ->> 'source_id', private.ms_to_ts(r -> 'archived_at'),
        v_cua, v_dev, private.ms_to_ts(r -> 'deleted_at'))
      on conflict (id) do update set
        name = excluded.name,
        equipment = excluded.equipment,
        primary_muscle = excluded.primary_muscle,
        secondary_muscles = excluded.secondary_muscles,
        measurement_type = case when e.user_id is null then e.measurement_type else excluded.measurement_type end,
        instructions = excluded.instructions,
        source_id = excluded.source_id,
        archived_at = excluded.archived_at,
        client_updated_at = excluded.client_updated_at,
        client_device_id = excluded.client_device_id,
        deleted_at = excluded.deleted_at;

    elsif p_table = 'folders' then
      insert into public.folders (id, user_id, name, position, collapsed, client_updated_at, client_device_id, deleted_at)
      values (v_id, v_user, r ->> 'name', coalesce((r ->> 'position')::int, 0), coalesce((r ->> 'collapsed')::boolean, false),
        v_cua, v_dev, private.ms_to_ts(r -> 'deleted_at'))
      on conflict (id) do update set
        name = excluded.name, position = excluded.position, collapsed = excluded.collapsed,
        client_updated_at = excluded.client_updated_at, client_device_id = excluded.client_device_id,
        deleted_at = excluded.deleted_at;

    elsif p_table = 'routines' then
      insert into public.routines (id, user_id, folder_id, position, doc, client_updated_at, client_device_id, deleted_at)
      values (v_id, v_user, nullif(r ->> 'folder_id', '')::uuid, coalesce((r ->> 'position')::int, 0), r -> 'doc',
        v_cua, v_dev, private.ms_to_ts(r -> 'deleted_at'))
      on conflict (id) do update set
        folder_id = excluded.folder_id, position = excluded.position, doc = excluded.doc,
        client_updated_at = excluded.client_updated_at, client_device_id = excluded.client_device_id,
        deleted_at = excluded.deleted_at;

    elsif p_table = 'workouts' then
      insert into public.workouts (id, user_id, status, owner_device_id, routine_id, started_at, exercise_ids, doc,
        client_updated_at, client_device_id, deleted_at)
      values (v_id, v_user, r ->> 'status', (r ->> 'owner_device_id')::uuid, nullif(r ->> 'routine_id', '')::uuid,
        private.ms_to_ts(r -> 'started_at'), private.text_array(r -> 'exercise_ids')::uuid[], r -> 'doc',
        v_cua, v_dev, private.ms_to_ts(r -> 'deleted_at'))
      on conflict (id) do update set
        status = excluded.status, owner_device_id = excluded.owner_device_id, routine_id = excluded.routine_id,
        started_at = excluded.started_at, exercise_ids = excluded.exercise_ids, doc = excluded.doc,
        client_updated_at = excluded.client_updated_at, client_device_id = excluded.client_device_id,
        deleted_at = excluded.deleted_at;

    elsif p_table = 'body_measurements' then
      insert into public.body_measurements (id, user_id, measured_on, values, client_updated_at, client_device_id, deleted_at)
      values (v_id, v_user, (r ->> 'measured_on')::date, coalesce(r -> 'values', '{}'::jsonb),
        v_cua, v_dev, private.ms_to_ts(r -> 'deleted_at'))
      on conflict (id) do update set
        measured_on = excluded.measured_on, values = excluded.values,
        client_updated_at = excluded.client_updated_at, client_device_id = excluded.client_device_id,
        deleted_at = excluded.deleted_at;

    elsif p_table = 'exercise_prefs' then
      insert into public.exercise_prefs (id, user_id, exercise_id, doc, client_updated_at, client_device_id, deleted_at)
      values (v_id, v_user, (r ->> 'exercise_id')::uuid, r -> 'doc', v_cua, v_dev, private.ms_to_ts(r -> 'deleted_at'))
      on conflict (id) do update set
        exercise_id = excluded.exercise_id, doc = excluded.doc,
        client_updated_at = excluded.client_updated_at, client_device_id = excluded.client_device_id,
        deleted_at = excluded.deleted_at;
    end if;
  exception when others then
    return 'invalid';
  end;
  return 'accepted';
end;
$$;

-- Cette méthode permet d'enregistrer un lot de modifications de l'outbox lorsqu'un appareil synchronise (100 éléments au plus).
-- Les éléments sont appliqués dans l'ordre des dépendances (exercices avant réglages), sous verrou du compte.
create function public.sync_push(p_device_id uuid, p_changes jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_out jsonb := '[]'::jsonb;
  it record;
begin
  if p_device_id is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) > 100 then
    raise exception 'batch_too_large' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  for it in
    select c.value ->> 'table' as tbl, c.value -> 'row' as r, c.ord
    from jsonb_array_elements(p_changes) with ordinality as c(value, ord)
    order by array_position(array['profiles', 'exercises', 'folders', 'routines', 'workouts', 'body_measurements', 'exercise_prefs'],
                            c.value ->> 'table') nulls last, c.ord
  loop
    v_out := v_out || jsonb_build_object(
      'table', it.tbl,
      'id', it.r ->> 'id',
      'status', private.push_one(v_uid, p_device_id, it.tbl, coalesce(it.r, '{}'::jsonb)));
  end loop;
  return v_out;
end;
$$;

-- ---------- sync_pull ----------

-- Cette méthode permet de lire une page de lignes d'une table après un curseur lorsqu'un appareil tire les changements.
create function private.pull_page(p_table text, p_where text, p_after bigint, p_limit int) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  execute format(
    'select coalesce(jsonb_agg(private.row_out(to_jsonb(t)) order by t.rev), ''[]''::jsonb)
       from (select * from public.%I where %s and rev > $1 order by rev limit $2) t',
    p_table, p_where)
  into v using p_after, p_limit;
  return v;
end;
$$;

-- Cette méthode permet de renvoyer les lignes modifiées depuis les curseurs du client lorsqu'il synchronise (500 par clé au plus).
create function public.sync_pull(p_cursors jsonb) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_limit constant int := 500;
  v_changes jsonb := '{}'::jsonb;
  v_cursors jsonb := '{}'::jsonb;
  v_more boolean := false;
  v_rows jsonb;
  v_after bigint;
  v_max bigint;
  k record;
begin
  p_cursors := coalesce(p_cursors, '{}'::jsonb);
  for k in
    select * from (values
      ('profiles', 'profiles', format('id = %L', v_uid)),
      ('exercises', 'exercises', format('user_id = %L', v_uid)),
      ('catalog', 'exercises', 'user_id is null'),
      ('folders', 'folders', format('user_id = %L', v_uid)),
      ('routines', 'routines', format('user_id = %L', v_uid)),
      ('workouts', 'workouts', format('user_id = %L', v_uid)),
      ('body_measurements', 'body_measurements', format('user_id = %L', v_uid)),
      ('exercise_prefs', 'exercise_prefs', format('user_id = %L', v_uid))
    ) as t(key, tbl, cond)
  loop
    v_after := coalesce((p_cursors ->> k.key)::bigint, 0);
    v_rows := private.pull_page(k.tbl, k.cond, v_after, v_limit + 1);
    if jsonb_array_length(v_rows) > v_limit then
      v_more := true;
      v_rows := v_rows - v_limit;
    end if;
    v_max := coalesce((v_rows -> -1 ->> 'rev')::bigint, v_after);
    v_changes := v_changes || jsonb_build_object(k.key, v_rows);
    v_cursors := v_cursors || jsonb_build_object(k.key, v_max);
  end loop;
  return jsonb_build_object('changes', v_changes, 'cursors', v_cursors, 'has_more', v_more);
end;
$$;

-- ---------- Séance en cours ----------

-- Cette méthode permet de reprendre une séance en cours sur cet appareil lorsqu'elle a été démarrée ailleurs.
create function public.take_over_workout(p_id uuid, p_device_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_row public.workouts;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  update public.workouts set
    owner_device_id = p_device_id,
    client_device_id = p_device_id,
    client_updated_at = greatest(client_updated_at + 1, round(extract(epoch from clock_timestamp()) * 1000)::bigint)
  where id = p_id and user_id = v_uid and status = 'in_progress' and deleted_at is null
  returning * into v_row;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.row_out(to_jsonb(v_row));
end;
$$;

-- ---------- Invitations et profils ----------

-- Cette méthode permet de remplacer le code d'invitation de l'appelant lorsqu'il veut invalider l'ancien lien.
create function public.regenerate_invite() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_code text := private.gen_invite_code();
begin
  update public.profiles set invite_code = v_code where id = v_uid;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  return v_code;
end;
$$;

-- Cette méthode permet de créer le profil d'un nouvel utilisateur lorsqu'il s'inscrit (Edge Function) ou que l'admin est créé (script).
-- Réservée à service_role ; renvoie le code d'invitation du nouveau compte.
create function public.admin_create_profile(p_user_id uuid, p_display_name text, p_settings jsonb, p_is_admin boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_code text := private.gen_invite_code();
begin
  insert into public.profiles (id, display_name, is_admin, invite_code, settings, client_updated_at)
  values (p_user_id, p_display_name, coalesce(p_is_admin, false), v_code, coalesce(p_settings, '{}'::jsonb),
          round(extract(epoch from clock_timestamp()) * 1000)::bigint);
  return v_code;
end;
$$;

-- Cette méthode permet d'enregistrer une tentative d'inscription et de dire si l'IP reste sous la limite (5 par heure).
create function public.signup_rate_check(p_ip text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  delete from private.signup_attempts where at < now() - interval '1 day';
  select count(*) into v_n from private.signup_attempts where ip = p_ip and at > now() - interval '1 hour';
  if v_n >= 5 then
    return false;
  end if;
  insert into private.signup_attempts (ip) values (p_ip);
  return true;
end;
$$;

-- ---------- Notifications ----------

-- Cette méthode permet d'enregistrer l'abonnement push de cet appareil lorsque l'utilisateur active les notifications.
create function public.register_push_subscription(p_device_id uuid, p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  insert into public.push_subscriptions as s (user_id, device_id, endpoint, p256dh, auth)
  values (v_uid, p_device_id, p_endpoint, p_p256dh, p_auth)
  on conflict (device_id) do update set
    user_id = excluded.user_id, endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth,
    created_at = now();
end;
$$;

-- Cette méthode permet de supprimer l'abonnement push de cet appareil lorsque l'utilisateur désactive les notifications.
create function public.unregister_push_subscription(p_device_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  delete from public.push_subscriptions where device_id = p_device_id and user_id = v_uid;
end;
$$;

-- Cette méthode permet de planifier la notification de fin de repos lorsqu'une série est validée ou que le minuteur change.
create function public.schedule_rest_timer(p_device_id uuid, p_ends_at_ms bigint, p_title text, p_body text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  insert into public.rest_timers as t (device_id, user_id, ends_at, title, body, sent_at)
  values (p_device_id, v_uid, to_timestamp(p_ends_at_ms / 1000.0), p_title, p_body, null)
  on conflict (device_id) do update set
    user_id = excluded.user_id, ends_at = excluded.ends_at, title = excluded.title, body = excluded.body, sent_at = null;
end;
$$;

-- Cette méthode permet d'annuler la notification de repos de cet appareil lorsque l'utilisateur passe le repos.
create function public.cancel_rest_timer(p_device_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  delete from public.rest_timers where device_id = p_device_id and user_id = v_uid;
end;
$$;

-- Cette méthode permet d'envoyer les notifications de repos échues lorsque pg_cron l'exécute (chaque seconde).
-- Un appel HTTP à send-push par minuteur échu ; rien n'est fait s'il n'y en a pas.
create function public.dispatch_due_timers() returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_n int := 0;
  t record;
begin
  if not exists (select 1 from public.rest_timers where sent_at is null and ends_at <= now()) then
    return 0;
  end if;
  select value into v_url from private.config where key = 'send_push_url';
  select value into v_secret from private.config where key = 'push_secret';
  if v_url is null or v_secret is null then
    return 0;
  end if;
  for t in
    update public.rest_timers set sent_at = now()
    where device_id in (
      select device_id from public.rest_timers where sent_at is null and ends_at <= now() for update skip locked)
    returning device_id, title, body
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('device_id', t.device_id, 'title', t.title, 'body', t.body),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      timeout_milliseconds := 5000);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------- Divers ----------

-- Cette méthode permet de vérifier que le projet répond lorsque la GitHub Action le réveille.
create function public.health() returns text
language sql
stable
set search_path = ''
as $$
  select 'ok'::text;
$$;

-- Cette méthode permet de lire l'heure serveur lorsque le client vérifie le décalage de son horloge.
create function public.server_now_ms() returns bigint
language sql
volatile
set search_path = ''
as $$
  select round(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

-- ---------- Droits d'exécution ----------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

revoke execute on function public.sync_push(uuid, jsonb), public.sync_pull(jsonb), public.take_over_workout(uuid, uuid),
  public.regenerate_invite(), public.admin_create_profile(uuid, text, jsonb, boolean), public.signup_rate_check(text),
  public.register_push_subscription(uuid, text, text, text), public.unregister_push_subscription(uuid),
  public.schedule_rest_timer(uuid, bigint, text, text), public.cancel_rest_timer(uuid), public.dispatch_due_timers(),
  public.health(), public.server_now_ms()
  from public, anon, authenticated;

grant execute on function public.sync_push(uuid, jsonb), public.sync_pull(jsonb), public.take_over_workout(uuid, uuid),
  public.regenerate_invite(), public.register_push_subscription(uuid, text, text, text),
  public.unregister_push_subscription(uuid), public.schedule_rest_timer(uuid, bigint, text, text),
  public.cancel_rest_timer(uuid), public.server_now_ms()
  to authenticated;
grant execute on function public.health() to anon, authenticated;
grant execute on function public.admin_create_profile(uuid, text, jsonb, boolean), public.signup_rate_check(text)
  to service_role;

-- ---------- Planification ----------
select cron.schedule('dispatch-due-timers', '1 seconds', 'select public.dispatch_due_timers()');
