-- Relecture ciblée (#58) : quand sync_push refuse une ligne (invalid, forbidden), le client relit la version serveur
-- pour réaligner sa base locale ; le curseur de pull a déjà dépassé la rev de cette ligne.

-- Cette méthode permet de renvoyer la version serveur de lignes précises lorsqu'un appareil se réaligne après un refus.
-- Mêmes règles de lecture que sync_pull ; une ligne absente ou illisible est renvoyée à null.
create function public.sync_fetch(p_keys jsonb) returns jsonb
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

revoke execute on function public.sync_fetch(jsonb) from public, anon, authenticated;
grant execute on function public.sync_fetch(jsonb) to authenticated;
