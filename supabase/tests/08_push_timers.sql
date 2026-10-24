-- Abonnements push et minuteurs de repos par (appareil, compte) (#63) : un compte ne peut pas détourner ceux d'un autre.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000a8', 'push-a@test.local');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000b8', 'push-b@test.local');

-- ---------- A s'abonne et planifie un minuteur sur son appareil ----------
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000a8');
select public.register_push_subscription('d8d8d8d8-0000-0000-0000-000000000001', 'https://push.test/a', 'pa', 'aa');
select public.schedule_rest_timer('d8d8d8d8-0000-0000-0000-000000000001', 4102444800000, 'Repos terminé', 'A');

-- ---------- B connaît le device_id de A ----------
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000b8');
select lives_ok($$select public.register_push_subscription('d8d8d8d8-0000-0000-0000-000000000001', 'https://push.test/pirate', 'pb', 'ab')$$,
  'B peut s''abonner avec ce device_id, sur sa propre ligne');
select lives_ok($$select public.schedule_rest_timer('d8d8d8d8-0000-0000-0000-000000000001', 1, 'Pirate', 'B')$$,
  'B peut planifier un minuteur avec ce device_id, sur sa propre ligne');
select public.cancel_rest_timer('d8d8d8d8-0000-0000-0000-000000000001');
select public.unregister_push_subscription('d8d8d8d8-0000-0000-0000-000000000001');

select tests.as_postgres();
select is((select endpoint from public.push_subscriptions
  where device_id = 'd8d8d8d8-0000-0000-0000-000000000001' and user_id = 'aaaaaaaa-0000-0000-0000-0000000000a8'),
  'https://push.test/a', 'l''abonnement de A est intact');
select is((select body from public.rest_timers
  where device_id = 'd8d8d8d8-0000-0000-0000-000000000001' and user_id = 'aaaaaaaa-0000-0000-0000-0000000000a8'),
  'A', 'le minuteur de A est intact');
select is((select count(*)::int from public.push_subscriptions where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b8'), 0,
  'B ne retire que sa propre ligne');
select is((select count(*)::int from public.rest_timers where device_id = 'd8d8d8d8-0000-0000-0000-000000000001'), 1,
  'B n''annule que son propre minuteur');

-- ---------- Changement de compte sur le même navigateur (même endpoint) ----------
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000b8');
select public.register_push_subscription('d8d8d8d8-0000-0000-0000-000000000001', 'https://push.test/a', 'pb2', 'ab2');
select tests.as_postgres();
select is((select string_agg(user_id::text, ',') from public.push_subscriptions where device_id = 'd8d8d8d8-0000-0000-0000-000000000001'),
  'bbbbbbbb-0000-0000-0000-0000000000b8', 'même endpoint : l''abonnement passe au nouveau compte');
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000b8');
select lives_ok($$select public.schedule_rest_timer('d8d8d8d8-0000-0000-0000-000000000001', 1, 'Repos terminé', 'B')$$,
  'le nouveau compte planifie malgré le minuteur laissé par l''ancien');

-- ---------- Envoi : le compte du minuteur accompagne l'appel à send-push ----------
select tests.as_postgres();
insert into private.config (key, value) values ('send_push_url', 'http://test.invalid/send-push'), ('push_secret', 'x')
on conflict (key) do update set value = excluded.value;
update public.rest_timers set ends_at = now() - interval '1 second' where device_id = 'd8d8d8d8-0000-0000-0000-000000000001';
select is(public.dispatch_due_timers(), 2, 'les deux minuteurs échus du même appareil partent');
select is((select count(*)::int from net.http_request_queue
  where url = 'http://test.invalid/send-push' and convert_from(body, 'utf8')::jsonb ? 'user_id'), 2,
  'chaque appel porte le user_id du minuteur');
select is((select count(*)::int from public.rest_timers where sent_at is null), 0, 'minuteurs marqués envoyés');

select * from finish();
rollback;
