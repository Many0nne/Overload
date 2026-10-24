-- sync_fetch (#58) : relecture ciblée de la version serveur après un refus de sync_push.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select tests.create_user('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local');
select tests.create_user('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local');
insert into public.folders (id, user_id, name, client_updated_at, client_device_id) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dossier A', 1, gen_random_uuid()),
  ('bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Dossier B', 1, gen_random_uuid());
insert into public.folders (id, user_id, name, client_updated_at, client_device_id, deleted_at) values
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Supprimé', 1, gen_random_uuid(),
   to_timestamp(1760000000.123));
insert into public.exercises (id, user_id, name, equipment, primary_muscle, measurement_type)
values ('cccccccc-0000-0000-0000-000000000009', null, 'Squat', 'barbell', 'quads', 'weight_reps');

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000001');
create temp table f1 as select public.sync_fetch(jsonb_build_array(
  jsonb_build_object('table', 'folders', 'id', 'aaaaaaaa-2222-0000-0000-000000000001'),
  jsonb_build_object('table', 'folders', 'id', 'bbbbbbbb-2222-0000-0000-000000000001'),
  jsonb_build_object('table', 'folders', 'id', gen_random_uuid()),
  jsonb_build_object('table', 'exercises', 'id', 'cccccccc-0000-0000-0000-000000000009'),
  jsonb_build_object('table', 'profiles', 'id', 'aaaaaaaa-0000-0000-0000-000000000001'),
  jsonb_build_object('table', 'folders', 'id', 'aaaaaaaa-2222-0000-0000-000000000002'),
  jsonb_build_object('table', 'nope', 'id', 'pas-un-uuid')
)) as r;

select is((select r -> 0 -> 'row' ->> 'name' from f1), 'Dossier A', 'ligne du compte renvoyée');
select is((select r -> 1 -> 'row' from f1), 'null'::jsonb, 'ligne d''un autre compte : null');
select is((select r -> 2 -> 'row' from f1), 'null'::jsonb, 'ligne absente : null');
select is((select r -> 3 -> 'row' ->> 'name' from f1), 'Squat', 'exercice du catalogue lisible');
select is((select r -> 4 -> 'row' ->> 'id' from f1), 'aaaaaaaa-0000-0000-0000-000000000001', 'profil renvoyé');
select is((select (r -> 5 -> 'row' ->> 'deleted_at')::bigint from f1), 1760000000123::bigint, 'tombstone, deleted_at en ms');
select is((select r -> 6 -> 'row' from f1), 'null'::jsonb, 'table ou id invalide : null');
select throws_ok($$ select public.sync_fetch((select jsonb_agg(jsonb_build_object('table', 'folders', 'id', gen_random_uuid()))
  from generate_series(1, 101))) $$, '22023', 'batch_too_large', 'plus de 100 clés refusées');

select tests.as_postgres();
select * from finish();
rollback;
