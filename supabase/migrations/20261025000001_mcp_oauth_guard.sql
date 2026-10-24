-- Connecteur Claude (#62) : « Modifications autorisées » et « Déconnecter » appliqués par la base, pas seulement par l'Edge Function.
-- Le jeton OAuth de Claude est un JWT `authenticated` ordinaire (claim client_id en plus) : sans ces gardes, il pourrait appeler
-- PostgREST et les RPC directement, même en lecture seule ou déconnecté.
-- Règles pour un jeton OAuth : lectures si la connexion existe et n'est pas révoquée ; écritures de données si elle a en plus
-- can_write ; gestion du compte (connexions, invitation, notifications, photos, suppression du compte) réservée à l'app.

-- ---------- Gardes ----------

-- Cette méthode permet de savoir si l'appelant est une session de l'app (jeton sans client_id) lorsqu'une action touche au compte.
create function private.is_app_session() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.jwt_client_id() is null;
$$;

-- Cette méthode permet de savoir si l'appelant peut lire : session de l'app, ou jeton OAuth d'une connexion existante non révoquée.
create function private.oauth_read_allowed() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.jwt_client_id() is null
    or exists (
      select 1 from public.mcp_connections c
      where c.user_id = auth.uid() and c.client_id = private.jwt_client_id() and c.revoked_at is null);
$$;

-- Cette méthode permet de savoir si l'appelant peut écrire des données : session de l'app, ou jeton OAuth d'une connexion
-- non révoquée avec « Modifications autorisées ».
create function private.oauth_write_allowed() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.jwt_client_id() is null
    or exists (
      select 1 from public.mcp_connections c
      where c.user_id = auth.uid() and c.client_id = private.jwt_client_id() and c.revoked_at is null and c.can_write);
$$;

-- Cette méthode permet de refuser une RPC de gestion du compte lorsqu'elle est appelée avec un jeton OAuth.
create function private.require_app_session() returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_app_session() then
    raise exception 'oauth_forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Cette méthode permet de refuser une RPC de lecture lorsque la connexion OAuth de l'appelant est absente ou déconnectée.
create function private.require_oauth_read() returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.oauth_read_allowed() then
    raise exception 'connection_revoked' using errcode = '42501';
  end if;
end;
$$;

-- Cette méthode permet de refuser une RPC d'écriture lorsque la connexion OAuth de l'appelant est en lecture seule ou déconnectée.
create function private.require_oauth_write() returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.oauth_write_allowed() then
    raise exception 'connection_read_only' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function private.is_app_session(), private.oauth_read_allowed(), private.oauth_write_allowed(),
  private.require_app_session(), private.require_oauth_read(), private.require_oauth_write()
  from public, anon, authenticated;
-- Évaluées par les politiques RLS avec les droits de l'appelant.
grant execute on function private.is_app_session(), private.oauth_read_allowed(), private.oauth_write_allowed()
  to authenticated;

-- ---------- Politiques restrictives (combinées en ET avec les politiques propriétaire) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'exercises', 'folders', 'routines', 'workouts', 'body_measurements', 'exercise_prefs'] loop
    execute format('create policy %1$s_oauth_select on public.%1$s as restrictive for select to authenticated
      using ((select private.oauth_read_allowed()))', t);
    execute format('create policy %1$s_oauth_insert on public.%1$s as restrictive for insert to authenticated
      with check ((select private.oauth_write_allowed()))', t);
    execute format('create policy %1$s_oauth_update on public.%1$s as restrictive for update to authenticated
      using ((select private.oauth_write_allowed())) with check ((select private.oauth_write_allowed()))', t);
  end loop;
end $$;

create policy mcp_connections_oauth_select on public.mcp_connections as restrictive for select to authenticated
  using ((select private.oauth_read_allowed()));
create policy mcp_connections_oauth_update on public.mcp_connections as restrictive for update to authenticated
  using ((select private.is_app_session())) with check ((select private.is_app_session()));
create policy mcp_audit_oauth_select on public.mcp_audit as restrictive for select to authenticated
  using ((select private.oauth_read_allowed()));

-- Photos : jamais utilisées par le connecteur.
create policy objects_oauth_guard on storage.objects as restrictive for all to authenticated
  using ((select private.is_app_session())) with check ((select private.is_app_session()));

-- ---------- RPC de synchronisation ----------

-- Cette méthode permet d'enregistrer un lot de modifications de l'outbox lorsqu'un appareil synchronise (100 éléments au plus).
-- Les éléments sont appliqués dans l'ordre des dépendances (exercices avant réglages), sous verrou du compte.
create or replace function public.sync_push(p_device_id uuid, p_changes jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_out jsonb := '[]'::jsonb;
  it record;
begin
  perform private.require_oauth_write();
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

-- Cette méthode permet de renvoyer les lignes modifiées depuis les curseurs du client lorsqu'il synchronise (500 par clé au plus).
create or replace function public.sync_pull(p_cursors jsonb) returns jsonb
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
  perform private.require_oauth_read();
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

-- Cette méthode permet de renvoyer la version serveur de lignes précises lorsqu'un appareil se réaligne après un refus.
-- Mêmes règles de lecture que sync_pull ; une ligne absente ou illisible est renvoyée à null.
create or replace function public.sync_fetch(p_keys jsonb) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_out jsonb := '[]'::jsonb;
  v_id uuid;
  v_row jsonb;
  it record;
begin
  perform private.require_oauth_read();
  if jsonb_typeof(p_keys) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_keys) > 100 then
    raise exception 'batch_too_large' using errcode = '22023';
  end if;

  for it in select k.value ->> 'table' as tbl, k.value ->> 'id' as id from jsonb_array_elements(p_keys) as k(value)
  loop
    v_row := null;
    begin
      v_id := it.id::uuid;
    exception when others then
      v_id := null;
    end;
    if v_id is not null and it.tbl in ('profiles', 'exercises', 'folders', 'routines', 'workouts', 'body_measurements', 'exercise_prefs') then
      execute format('select private.row_out(to_jsonb(t)) from public.%I t where t.id = $1 and %s',
        it.tbl,
        case it.tbl
          when 'profiles' then 't.id = $2'
          when 'exercises' then '(t.user_id = $2 or t.user_id is null)'
          else 't.user_id = $2'
        end)
      into v_row using v_id, v_uid;
    end if;
    v_out := v_out || jsonb_build_object('table', it.tbl, 'id', it.id, 'row', v_row);
  end loop;
  return v_out;
end;
$$;

-- Cette méthode permet de reprendre une séance en cours sur cet appareil lorsqu'elle a été démarrée ailleurs.
create or replace function public.take_over_workout(p_id uuid, p_device_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_row public.workouts;
begin
  perform private.require_oauth_write();
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

-- ---------- RPC de gestion du compte : session de l'app seulement ----------

-- Cette méthode permet de remplacer le code d'invitation de l'appelant lorsqu'il veut invalider l'ancien lien.
create or replace function public.regenerate_invite() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_code text := private.gen_invite_code();
begin
  perform private.require_app_session();
  update public.profiles set invite_code = v_code where id = v_uid;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  return v_code;
end;
$$;

-- Cette méthode permet d'enregistrer l'abonnement push de cet appareil lorsque l'utilisateur active les notifications.
create or replace function public.register_push_subscription(p_device_id uuid, p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  perform private.require_app_session();
  insert into public.push_subscriptions as s (user_id, device_id, endpoint, p256dh, auth)
  values (v_uid, p_device_id, p_endpoint, p_p256dh, p_auth)
  on conflict (device_id) do update set
    user_id = excluded.user_id, endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth,
    created_at = now();
end;
$$;

-- Cette méthode permet de supprimer l'abonnement push de cet appareil lorsque l'utilisateur désactive les notifications.
create or replace function public.unregister_push_subscription(p_device_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  perform private.require_app_session();
  delete from public.push_subscriptions where device_id = p_device_id and user_id = v_uid;
end;
$$;

-- Cette méthode permet de planifier la notification de fin de repos lorsqu'une série est validée ou que le minuteur change.
create or replace function public.schedule_rest_timer(p_device_id uuid, p_ends_at_ms bigint, p_title text, p_body text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  perform private.require_app_session();
  insert into public.rest_timers as t (device_id, user_id, ends_at, title, body, sent_at)
  values (p_device_id, v_uid, to_timestamp(p_ends_at_ms / 1000.0), p_title, p_body, null)
  on conflict (device_id) do update set
    user_id = excluded.user_id, ends_at = excluded.ends_at, title = excluded.title, body = excluded.body, sent_at = null;
end;
$$;

-- Cette méthode permet d'annuler la notification de repos de cet appareil lorsque l'utilisateur passe le repos.
create or replace function public.cancel_rest_timer(p_device_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  perform private.require_app_session();
  delete from public.rest_timers where device_id = p_device_id and user_id = v_uid;
end;
$$;

-- Cette méthode permet à l'admin de lire l'occupation totale de Storage et le quota lorsqu'il ouvre ses paramètres.
create or replace function public.admin_storage_usage() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_app_session();
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'used_bytes', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o),
    'quota_bytes', 1073741824::bigint
  );
end;
$$;

-- ---------- RPC du connecteur ----------

-- Cette méthode permet d'enregistrer le choix « modifications autorisées » lorsque l'utilisateur approuve un client OAuth.
-- Une nouvelle approbation rétablit une connexion déconnectée ; un jeton OAuth ne peut pas s'accorder de droits.
create or replace function public.upsert_mcp_connection(p_client_id text, p_client_name text, p_can_write boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  perform private.require_app_session();
  if coalesce(trim(p_client_id), '') = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.mcp_connections (user_id, client_id, client_name, can_write)
  values (v_uid, p_client_id, left(p_client_name, 200), coalesce(p_can_write, true))
  on conflict (user_id, client_id) do update set
    client_name = coalesce(excluded.client_name, public.mcp_connections.client_name),
    can_write = excluded.can_write,
    revoked_at = null;
end;
$$;

-- Cette méthode permet de déconnecter un client OAuth lorsque l'utilisateur le révoque dans Paramètres › Claude.
-- Elle ferme aussi ses sessions Supabase Auth (refresh tokens compris) et son consentement, pour que Claude redemande l'accès.
create or replace function public.revoke_mcp_connection(p_client_id text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_client uuid;
begin
  perform private.require_app_session();
  update public.mcp_connections set revoked_at = now()
  where user_id = v_uid and client_id = p_client_id and revoked_at is null;
  begin
    v_client := p_client_id::uuid;
  exception when others then
    return;
  end;
  begin
    delete from auth.sessions where user_id = v_uid and oauth_client_id = v_client;
    update auth.oauth_consents set revoked_at = now()
    where user_id = v_uid and client_id = v_client and revoked_at is null;
  exception when insufficient_privilege or undefined_table or undefined_column then
    -- Schéma auth inaccessible ou différent : le refus par mcp_connections (RLS et RPC) suffit.
    raise warning 'revoke_mcp_connection : sessions OAuth non fermées (%)', sqlerrm;
  end;
end;
$$;

-- Cette méthode permet au serveur MCP de journaliser une écriture (ligne avant/après) lorsqu'un outil modifie une donnée.
create or replace function public.mcp_log(p_tool text, p_table text, p_row_id uuid, p_before jsonb, p_after jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_client text := private.jwt_client_id();
begin
  if v_client is null then
    raise exception 'not_an_oauth_token' using errcode = '42501';
  end if;
  perform private.require_oauth_write();
  insert into public.mcp_audit (user_id, client_id, tool, sync_table, row_id, before, after)
  values (v_uid, v_client, p_tool, p_table, p_row_id, p_before, p_after);
end;
$$;
