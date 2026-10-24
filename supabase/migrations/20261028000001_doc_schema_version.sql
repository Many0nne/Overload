-- Versions des documents synchronisés (#71) : sync_push refuse un document d'un format plus ancien que celui stocké
-- (statut 'outdated'). Le client se réaligne alors sur la version serveur et demande la mise à jour de l'app.

-- Cette méthode permet de lire la version d'un document synchronisé lorsqu'on compare deux formats (absente : 1, comme côté client).
create or replace function private.doc_version(p_doc jsonb) returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_doc -> 'schemaVersion') = 'number' and (p_doc ->> 'schemaVersion') ~ '^[1-9][0-9]{0,8}$'
      then (p_doc ->> 'schemaVersion')::int
    else 1
  end;
$$;

-- Cette méthode permet d'appliquer une seule ligne poussée par le client lorsqu'elle passe les contrôles d'appartenance et le dernier gagne.
-- Elle renvoie accepted, stale, rejected_not_owner, forbidden, outdated (document d'un format plus ancien que celui stocké)
-- ou invalid (ligne mal formée ou contrainte violée).
create or replace function private.push_one(p_uid uuid, p_device uuid, p_table text, r jsonb) returns text
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
    'select user_id, client_updated_at, client_device_id, %s, %s from public.%I where id = $1 for update',
    case when p_table = 'workouts' then 'status, owner_device_id' else 'null::text as status, null::uuid as owner_device_id' end,
    case when p_table in ('routines', 'workouts', 'exercise_prefs') then 'doc' else 'null::jsonb as doc' end,
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
    -- Un appareil resté sur une ancienne version de l'app n'écrase pas un document d'un format plus récent (#71).
    if private.doc_version(r -> 'doc') < private.doc_version(ex.doc) then
      return 'outdated';
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

revoke execute on function private.doc_version(jsonb) from public, anon, authenticated;
