-- Durcissements de sécurité (#63).
-- 1. Abonnements push et minuteurs de repos : une ligne par (appareil, compte). Un compte qui connaît le device_id
--    d'un autre ne peut plus écraser son abonnement ni son minuteur, et un minuteur n'est envoyé qu'à l'abonnement
--    du même compte. Le changement de compte sur un même appareil (device_id conservé) reste possible.
-- 2. Tables synchronisées : plus d'insert/update direct pour authenticated, toutes les écritures passent par sync_push.

-- ---------- Abonnements push ----------
alter table public.push_subscriptions drop constraint push_subscriptions_device_id_key;
alter table public.push_subscriptions add constraint push_subscriptions_device_user_key unique (device_id, user_id);

-- Cette méthode permet d'enregistrer l'abonnement push de cet appareil pour le compte connecté lorsque l'utilisateur
-- active les notifications ; l'abonnement du même navigateur laissé par un autre compte de l'appareil est retiré.
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
  on conflict (device_id, user_id) do update set
    endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  -- Connaître l'endpoint (URL secrète du service push) prouve qu'on détient ce navigateur.
  delete from public.push_subscriptions
  where device_id = p_device_id and endpoint = p_endpoint and user_id <> v_uid;
end;
$$;

-- ---------- Minuteurs de repos ----------
alter table public.rest_timers drop constraint rest_timers_pkey;
alter table public.rest_timers add constraint rest_timers_pkey primary key (device_id, user_id);

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
  on conflict (device_id, user_id) do update set
    ends_at = excluded.ends_at, title = excluded.title, body = excluded.body, sent_at = null;
end;
$$;

-- Cette méthode permet d'envoyer les notifications de repos échues lorsque pg_cron l'exécute (chaque seconde).
-- Un appel HTTP à send-push par minuteur échu, avec le compte du minuteur ; rien n'est fait s'il n'y en a pas.
create or replace function public.dispatch_due_timers() returns int
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
    where (device_id, user_id) in (
      select device_id, user_id from public.rest_timers where sent_at is null and ends_at <= now() for update skip locked)
    returning device_id, user_id, title, body
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('device_id', t.device_id, 'user_id', t.user_id, 'title', t.title, 'body', t.body),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      timeout_milliseconds := 5000);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------- Tables synchronisées : lecture seule en direct ----------
revoke insert, update on public.folders, public.routines, public.workouts, public.body_measurements,
  public.exercise_prefs, public.exercises from authenticated;
revoke update (display_name, avatar_path, settings, client_updated_at, client_device_id) on public.profiles from authenticated;

drop policy profiles_update on public.profiles;
drop policy exercises_insert on public.exercises;
drop policy exercises_update on public.exercises;
do $$
declare t text;
begin
  foreach t in array array['folders', 'routines', 'workouts', 'body_measurements', 'exercise_prefs'] loop
    execute format('drop policy %1$s_insert on public.%1$s', t);
    execute format('drop policy %1$s_update on public.%1$s', t);
  end loop;
  -- Les gardes OAuth en écriture n'ont plus d'objet : seule la lecture reste ouverte en direct.
  foreach t in array array['profiles', 'exercises', 'folders', 'routines', 'workouts', 'body_measurements', 'exercise_prefs'] loop
    execute format('drop policy %1$s_oauth_insert on public.%1$s', t);
    execute format('drop policy %1$s_oauth_update on public.%1$s', t);
  end loop;
end $$;
