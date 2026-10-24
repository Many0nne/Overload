-- Reprise d'une séance : les minuteurs de repos des autres appareils du compte sont annulés (#66),
-- sinon l'appareil dépossédé reçoit quand même la notification de fin de repos.

-- Cette méthode permet de reprendre une séance en cours sur cet appareil lorsqu'elle a été démarrée ailleurs,
-- en supprimant les minuteurs de repos planifiés par les autres appareils du compte.
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
  delete from public.rest_timers where user_id = v_uid and device_id <> p_device_id;
  return private.row_out(to_jsonb(v_row));
end;
$$;
