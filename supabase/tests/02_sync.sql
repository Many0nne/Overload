-- sync_push (dernier gagne, appartenance, séance en cours) et sync_pull (curseurs, pagination, catalogue).
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

select tests.create_user('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local');
select tests.create_user('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local');
select tests.create_user('adadadad-0000-0000-0000-000000000003', 'admin@test.local', true);
insert into public.folders (id, user_id, name, client_updated_at, client_device_id) values
  ('bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Dossier B', 1, gen_random_uuid());

-- Cette méthode permet de construire un élément d'outbox « dossier » lorsqu'un test pousse un dossier.
create function pg_temp.folder(p_id text, p_user text, p_name text, p_cua bigint, p_dev text) returns jsonb
language sql as $$
  select jsonb_build_object('table', 'folders', 'row', jsonb_build_object(
    'id', p_id, 'user_id', p_user, 'name', p_name, 'position', 0, 'collapsed', false,
    'client_updated_at', p_cua, 'client_device_id', p_dev, 'deleted_at', null));
$$;
-- Cette méthode permet de lire le statut du premier élément renvoyé par sync_push lorsqu'un test pousse une seule ligne.
create function pg_temp.push1(p_dev text, p_item jsonb) returns text
language sql as $$
  select public.sync_push(p_dev::uuid, jsonb_build_array(p_item)) -> 0 ->> 'status';
$$;

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000001');

-- Dernier gagne
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000',
  pg_temp.folder('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'v1', 1000, '11111111-0000-0000-0000-000000000000')),
  'accepted', 'création acceptée');
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000',
  pg_temp.folder('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'vieux', 900, '11111111-0000-0000-0000-000000000000')),
  'stale', 'plus ancien : stale');
select is(pg_temp.push1('00000000-0000-0000-0000-000000000001',
  pg_temp.folder('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'égal-petit', 1000, '00000000-0000-0000-0000-000000000001')),
  'stale', 'égalité, appareil plus petit : stale');
select is(pg_temp.push1('22222222-0000-0000-0000-000000000000',
  pg_temp.folder('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'égal-grand', 1000, '22222222-0000-0000-0000-000000000000')),
  'accepted', 'égalité, appareil plus grand : accepted');
select is((select name from public.folders where id = 'aaaaaaaa-2222-0000-0000-000000000001'), 'égal-grand', 'la version gagnante est stockée');
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000',
  pg_temp.folder('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'v2', 2000, '11111111-0000-0000-0000-000000000000')),
  'accepted', 'plus récent : accepted');

-- Appartenance
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000',
  pg_temp.folder(gen_random_uuid()::text, 'bbbbbbbb-0000-0000-0000-000000000002', 'pour B', 1000, '11111111-0000-0000-0000-000000000000')),
  'forbidden', 'écrire pour un autre compte : forbidden');
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000',
  pg_temp.folder('bbbbbbbb-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'vol', 9999, '11111111-0000-0000-0000-000000000000')),
  'forbidden', 'écraser la ligne d''un autre compte : forbidden');
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000', jsonb_build_object('table', 'exercises', 'row', jsonb_build_object(
  'id', gen_random_uuid(), 'user_id', null, 'name', 'Faux', 'equipment', 'other', 'primary_muscle', 'abs',
  'measurement_type', 'duration', 'client_updated_at', 1, 'client_device_id', '11111111-0000-0000-0000-000000000000'))),
  'forbidden', 'catalogue par un non-admin : forbidden');
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000', jsonb_build_object('table', 'folders', 'row', jsonb_build_object('name', 'x'))),
  'invalid', 'ligne mal formée : invalid');
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000', jsonb_build_object('table', 'profiles', 'row', jsonb_build_object(
  'id', 'aaaaaaaa-0000-0000-0000-000000000001', 'display_name', 'Paul', 'is_admin', true, 'invite_code', 'XXXXXXXXXXXX',
  'settings', '{"theme":"light"}'::jsonb, 'client_updated_at', 99999999999999, 'client_device_id', '11111111-0000-0000-0000-000000000000'))),
  'accepted', 'profil accepté');
select is((select is_admin from public.profiles), false, 'is_admin ignoré par sync_push');
select isnt((select invite_code from public.profiles), 'XXXXXXXXXXXX', 'invite_code ignoré par sync_push');

-- Ordre des dépendances : réglage poussé avant son exercice perso dans le même lot.
select is((select string_agg(e ->> 'status', ',') from jsonb_array_elements(public.sync_push('11111111-0000-0000-0000-000000000000'::uuid, jsonb_build_array(
  jsonb_build_object('table', 'exercise_prefs', 'row', jsonb_build_object('id', gen_random_uuid(), 'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'exercise_id', 'aaaaaaaa-4444-0000-0000-000000000001', 'doc', '{"schemaVersion":1}'::jsonb, 'client_updated_at', 1,
    'client_device_id', '11111111-0000-0000-0000-000000000000')),
  jsonb_build_object('table', 'exercises', 'row', jsonb_build_object('id', 'aaaaaaaa-4444-0000-0000-000000000001',
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'name', 'Mon exo', 'equipment', 'other', 'primary_muscle', 'abs',
    'secondary_muscles', '["chest"]'::jsonb, 'measurement_type', 'duration', 'client_updated_at', 1,
    'client_device_id', '11111111-0000-0000-0000-000000000000'))))) e),
  'accepted,accepted', 'exercice appliqué avant ses réglages');

-- Séance en cours et reprise sur un autre appareil
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000', jsonb_build_object('table', 'workouts', 'row', jsonb_build_object(
  'id', 'aaaaaaaa-3333-0000-0000-000000000001', 'user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'status', 'in_progress',
  'owner_device_id', '11111111-0000-0000-0000-000000000000', 'routine_id', null, 'started_at', 1760000000123,
  'exercise_ids', '["aaaaaaaa-4444-0000-0000-000000000001"]'::jsonb, 'doc', '{"title":"Push"}'::jsonb,
  'client_updated_at', 1000, 'client_device_id', '11111111-0000-0000-0000-000000000000', 'deleted_at', null))),
  'accepted', 'séance en cours créée par D1');
select is(public.take_over_workout('aaaaaaaa-3333-0000-0000-000000000001', '22222222-0000-0000-0000-000000000000') ->> 'owner_device_id',
  '22222222-0000-0000-0000-000000000000', 'reprise par D2');
select is(pg_temp.push1('11111111-0000-0000-0000-000000000000', jsonb_build_object('table', 'workouts', 'row', jsonb_build_object(
  'id', 'aaaaaaaa-3333-0000-0000-000000000001', 'user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'status', 'in_progress',
  'owner_device_id', '11111111-0000-0000-0000-000000000000', 'started_at', 1760000000123, 'exercise_ids', '[]'::jsonb,
  'doc', '{"title":"D1"}'::jsonb, 'client_updated_at', 99999999999999, 'client_device_id', '11111111-0000-0000-0000-000000000000'))),
  'rejected_not_owner', 'D1 dépossédé : rejected_not_owner même plus récent');
select is(pg_temp.push1('22222222-0000-0000-0000-000000000000', jsonb_build_object('table', 'workouts', 'row', jsonb_build_object(
  'id', 'aaaaaaaa-3333-0000-0000-000000000001', 'user_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'status', 'completed',
  'owner_device_id', '22222222-0000-0000-0000-000000000000', 'started_at', 1760000000123,
  'exercise_ids', '["aaaaaaaa-4444-0000-0000-000000000001"]'::jsonb, 'doc', '{"title":"D2"}'::jsonb,
  'client_updated_at', 99999999999999, 'client_device_id', '22222222-0000-0000-0000-000000000000'))),
  'accepted', 'D2 termine la séance');
select throws_ok($$select public.take_over_workout('aaaaaaaa-3333-0000-0000-000000000001', '11111111-0000-0000-0000-000000000000')$$,
  'P0002', null, 'une séance terminée ne se reprend pas');

-- sync_pull
create temp table pull1 as select public.sync_pull('{}'::jsonb) as r;
select is((select jsonb_array_length(r -> 'changes' -> 'folders') from pull1), 1, 'pull : seul le dossier de A');
select is((select (r -> 'changes' -> 'workouts' -> 0 ->> 'started_at')::bigint from pull1), 1760000000123::bigint,
  'started_at renvoyé en ms');
select is((select r -> 'changes' -> 'workouts' -> 0 -> 'exercise_ids' ->> 0 from pull1), 'aaaaaaaa-4444-0000-0000-000000000001',
  'exercise_ids renvoyé');
select is((select jsonb_array_length(r -> 'changes' -> 'profiles') from pull1), 1, 'pull : profil');
select is((select (r -> 'cursors' ->> 'folders')::bigint from pull1),
  (select rev from public.folders where id = 'aaaaaaaa-2222-0000-0000-000000000001'), 'curseur = rev max');
select is((select jsonb_array_length(public.sync_pull((select r -> 'cursors' from pull1)) -> 'changes' -> 'folders')), 0,
  'second pull avec les curseurs : rien de neuf');

-- Catalogue et pagination
select tests.as_postgres();
insert into public.exercises (id, user_id, name, equipment, primary_muscle, measurement_type)
values ('cccccccc-0000-0000-0000-000000000009', null, 'Squat', 'barbell', 'quads', 'weight_reps');
insert into public.folders (id, user_id, name, client_updated_at, client_device_id)
select gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'f' || g, 1, gen_random_uuid() from generate_series(1, 520) g;
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000001');
create temp table pull2 as select public.sync_pull('{}'::jsonb) as r;
-- Le catalogue peut contenir le seed : on vérifie la présence de l'exercice de test, pas le nombre total.
select ok((select (r -> 'changes' -> 'catalog') @> '[{"id": "cccccccc-0000-0000-0000-000000000009"}]'::jsonb from pull2),
  'catalogue renvoyé sous la clé catalog');
select is((select jsonb_array_length(r -> 'changes' -> 'folders') from pull2), 500, 'page de 500');
select is((select (r ->> 'has_more')::boolean from pull2), true, 'has_more vrai');
select is((select jsonb_array_length(public.sync_pull((select r -> 'cursors' from pull2)) -> 'changes' -> 'folders')), 21,
  'page suivante : le reste');

select tests.as_postgres();
select * from finish();
rollback;
