-- Isolation entre comptes (admin compris), colonnes protégées du profil, catalogue réservé à l'admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select tests.create_user('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local');
select tests.create_user('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local');
select tests.create_user('adadadad-0000-0000-0000-000000000003', 'admin@test.local', true);

insert into public.exercises (id, user_id, name, equipment, primary_muscle, measurement_type)
values ('cccccccc-0000-0000-0000-000000000001', null, 'Développé couché (barre)', 'barbell', 'chest', 'weight_reps'),
       ('bbbbbbbb-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Exo de B', 'other', 'abs', 'duration');
insert into public.folders (id, user_id, name, client_updated_at, client_device_id) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'PPL', 1, gen_random_uuid()),
  ('bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Dossier B', 1, gen_random_uuid());
insert into public.workouts (id, user_id, status, owner_device_id, started_at, doc, client_updated_at, client_device_id) values
  ('bbbbbbbb-3333-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'completed', gen_random_uuid(), now(), '{}', 1, gen_random_uuid());

select is((select name_search from public.exercises where id = 'cccccccc-0000-0000-0000-000000000001'),
  'developpe couche (barre)', 'name_search est normalisé par le serveur');
select ok((select rev from public.folders where id = 'aaaaaaaa-2222-0000-0000-000000000001') > 0, 'rev attribué par trigger');

-- ---------- Compte A ----------
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.folders), 1, 'A ne voit que son dossier');
select is((select count(*)::int from public.profiles), 1, 'A ne voit que son profil');
select is((select count(*)::int from public.workouts), 0, 'A ne voit pas les séances de B');
select is((select count(*)::int from public.exercises), 1, 'A voit le catalogue mais pas les exercices perso de B');
select throws_ok($$insert into public.folders (id, user_id, name, client_updated_at, client_device_id)
  values (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000002', 'pirate', 1, gen_random_uuid())$$,
  '42501', null, 'A ne peut pas écrire pour B');
update public.folders set name = 'pirate' where id = 'bbbbbbbb-2222-0000-0000-000000000001';
select throws_ok($$update public.profiles set is_admin = true$$, '42501', null, 'is_admin non modifiable');
select throws_ok($$update public.profiles set invite_code = 'AAAAAAAAAAAA'$$, '42501', null, 'invite_code non modifiable');
select lives_ok($$update public.profiles set display_name = 'Paul'$$, 'display_name modifiable');
select throws_ok($$insert into public.exercises (id, user_id, name, equipment, primary_muscle, measurement_type)
  values (gen_random_uuid(), null, 'Faux catalogue', 'other', 'abs', 'duration')$$, '42501', null, 'catalogue réservé à l''admin');
update public.exercises set name = 'pirate' where id = 'cccccccc-0000-0000-0000-000000000001';
select throws_ok($$delete from public.folders$$, '42501', null, 'pas de suppression physique');
select throws_ok($$select * from public.push_subscriptions$$, '42501', null, 'abonnements push inaccessibles en direct');
select throws_ok($$select * from public.rest_timers$$, '42501', null, 'minuteurs inaccessibles en direct');

-- regenerate_invite
select tests.as_postgres();
create temp table old_code as select invite_code from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001';
grant select on old_code to authenticated;
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000001');
select matches(public.regenerate_invite(), '^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{12}$', 'nouveau code de 12 caractères');
select isnt((select invite_code from public.profiles), (select invite_code from old_code), 'le code a changé');

-- ---------- Admin ----------
select tests.authenticate_as('adadadad-0000-0000-0000-000000000003');
select is((select count(*)::int from public.folders), 0, 'l''admin ne voit pas les dossiers des autres');
select is((select count(*)::int from public.workouts), 0, 'l''admin ne voit pas les séances des autres');
select is((select count(*)::int from public.profiles), 1, 'l''admin ne voit que son profil');
select lives_ok($$insert into public.exercises (id, user_id, name, equipment, primary_muscle, measurement_type, client_updated_at, client_device_id)
  values ('cccccccc-0000-0000-0000-000000000002', null, 'Squat', 'barbell', 'quads', 'weight_reps', 1, gen_random_uuid())$$,
  'l''admin écrit dans le catalogue');
select throws_ok($$update public.exercises set measurement_type = 'duration' where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  '42501', null, 'type de mesure du catalogue figé');

-- ---------- Vérifications sans RLS ----------
select tests.as_postgres();
select is((select name from public.folders where id = 'bbbbbbbb-2222-0000-0000-000000000001'), 'Dossier B', 'B intact après tentative de A');
select is((select name from public.exercises where id = 'cccccccc-0000-0000-0000-000000000001'), 'Développé couché (barre)',
  'catalogue intact après tentative de A');

-- ---------- anon ----------
set local role anon;
select throws_ok($$select * from public.folders$$, '42501', null, 'anon n''a accès à rien');
select is(public.health(), 'ok', 'health() accessible à anon');
reset role;

select * from finish();
rollback;
