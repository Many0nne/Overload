-- Versions des documents (#71) : sync_push refuse un document d'un format plus ancien que celui stocké.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select tests.create_user('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local');
insert into public.routines (id, user_id, doc, client_updated_at, client_device_id) values
  ('aaaaaaaa-3333-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '{"schemaVersion": 2, "name": "V2", "exercises": []}', 1, gen_random_uuid()),
  ('aaaaaaaa-3333-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   '{"name": "Sans version", "exercises": []}', 1, gen_random_uuid());

select is(private.doc_version('{"schemaVersion": 3}'), 3, 'version lue');
select is(private.doc_version('{}'), 1, 'version absente : 1');
select is(private.doc_version('{"schemaVersion": "2"}'), 1, 'version illisible : 1');

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000001');
-- Cette méthode permet de pousser une routine avec un document donné et de renvoyer le statut obtenu.
create function pg_temp.push_routine(p_id uuid, p_doc jsonb) returns text language sql as $$
  select public.sync_push('dddddddd-0000-0000-0000-000000000001', jsonb_build_array(jsonb_build_object(
    'table', 'routines', 'row', jsonb_build_object('id', p_id, 'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
      'position', 0, 'doc', p_doc, 'client_updated_at', 100, 'client_device_id', 'dddddddd-0000-0000-0000-000000000001')
  ))) -> 0 ->> 'status';
$$;

select is(pg_temp.push_routine('aaaaaaaa-3333-0000-0000-000000000001', '{"schemaVersion": 1, "name": "V1", "exercises": []}'),
  'outdated', 'document plus ancien que celui stocké : refusé');
select is((select doc ->> 'name' from public.routines where id = 'aaaaaaaa-3333-0000-0000-000000000001'), 'V2',
  'document stocké inchangé');
select is(pg_temp.push_routine('aaaaaaaa-3333-0000-0000-000000000002', '{"schemaVersion": 1, "name": "V1", "exercises": []}'),
  'accepted', 'même version (absente = 1) : accepté');
select is(pg_temp.push_routine('aaaaaaaa-3333-0000-0000-000000000001', '{"schemaVersion": 3, "name": "V3", "exercises": []}'),
  'accepted', 'version plus récente : acceptée');

select tests.as_postgres();
select * from finish();
rollback;
