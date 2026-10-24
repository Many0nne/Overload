-- Connecteur Claude (#62) : « Modifications autorisées » et « Déconnecter » appliqués par la base aux jetons OAuth
-- (PostgREST et RPC appelés directement, sans passer par l'Edge Function).
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000c1', 'guard-a@test.local');

-- Cette méthode permet de simuler un jeton OAuth (claim client_id) lorsqu'un test appelle l'API comme Claude.
create function tests.authenticate_oauth(p_id uuid, p_client text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'client_id', p_client)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
grant execute on function tests.authenticate_oauth(uuid, text) to authenticated;

insert into public.folders (id, user_id, name, client_updated_at, client_device_id) values
  ('aaaaaaaa-2222-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'PPL', 1, gen_random_uuid());
insert into public.workouts (id, user_id, status, owner_device_id, started_at, doc, client_updated_at, client_device_id) values
  ('aaaaaaaa-3333-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'in_progress', gen_random_uuid(), now(), '{}', 1,
   gen_random_uuid());

-- Connexions : lecture seule, écriture autorisée ; « client-x » n'a jamais été approuvé.
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000c1');
select public.upsert_mcp_connection('client-ro', 'Claude', false);
select public.upsert_mcp_connection('client-rw', 'Claude', true);

-- ---------- Session de l'app : inchangée ----------
select is((select count(*)::int from public.folders), 1, 'l''app lit ses dossiers');
select is(
  public.sync_push(gen_random_uuid(), jsonb_build_array(jsonb_build_object('table', 'folders', 'row',
    jsonb_build_object('id', 'aaaaaaaa-2222-0000-0000-0000000000c1', 'user_id', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'name', 'App', 'position', 0,
      'client_updated_at', 2, 'client_device_id', gen_random_uuid())))) -> 0 ->> 'status',
  'accepted', 'l''app modifie ses dossiers (sync_push)');

-- ---------- Jeton OAuth en lecture seule ----------
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000c1', 'client-ro');
select is((select count(*)::int from public.folders), 1, 'lecture seule : lecture PostgREST permise');
select ok((public.sync_pull('{}'::jsonb) -> 'changes' -> 'folders') is not null, 'lecture seule : sync_pull permis');
select throws_ok(
  $$select public.sync_push(gen_random_uuid(), jsonb_build_array(jsonb_build_object('table', 'folders', 'row',
    jsonb_build_object('id', 'aaaaaaaa-2222-0000-0000-0000000000c1', 'user_id', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'name', 'Claude', 'position', 0,
      'client_updated_at', 99, 'client_device_id', gen_random_uuid()))))$$,
  '42501', 'connection_read_only', 'lecture seule : sync_push refusé');
select throws_ok(
  $$insert into public.folders (id, user_id, name, client_updated_at, client_device_id)
    values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-0000000000c1', 'X', 1, gen_random_uuid())$$,
  '42501', null, 'lecture seule : insertion PostgREST refusée');
select throws_ok($$update public.folders set name = 'Claude' where id = 'aaaaaaaa-2222-0000-0000-0000000000c1'$$,
  '42501', null, 'lecture seule : mise à jour PostgREST refusée');
select tests.as_postgres();
select is((select name from public.folders where id = 'aaaaaaaa-2222-0000-0000-0000000000c1'), 'App',
  'lecture seule : mise à jour PostgREST sans effet');
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000c1', 'client-ro');
select throws_ok($$select public.take_over_workout('aaaaaaaa-3333-0000-0000-0000000000c1', gen_random_uuid())$$,
  '42501', 'connection_read_only', 'lecture seule : take_over_workout refusé');
select throws_ok($$select public.mcp_log('t', 'folders', gen_random_uuid(), null, null)$$,
  '42501', 'connection_read_only', 'lecture seule : mcp_log refusé');

-- Un jeton OAuth ne peut pas se redonner de droits ni gérer le compte.
select throws_ok($$select public.upsert_mcp_connection('client-ro', 'Claude', true)$$,
  '42501', 'oauth_forbidden', 'jeton OAuth : upsert_mcp_connection refusé');
update public.mcp_connections set can_write = true where client_id = 'client-ro';
select tests.as_postgres();
select is((select can_write from public.mcp_connections where client_id = 'client-ro'), false,
  'jeton OAuth : can_write non modifiable par PostgREST');
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000c1', 'client-ro');
select throws_ok($$select public.revoke_mcp_connection('client-rw')$$, '42501', 'oauth_forbidden',
  'jeton OAuth : revoke_mcp_connection refusé');
select throws_ok($$select public.regenerate_invite()$$, '42501', 'oauth_forbidden', 'jeton OAuth : regenerate_invite refusé');
select throws_ok($$select public.register_push_subscription(gen_random_uuid(), 'https://e', 'k', 'a')$$,
  '42501', 'oauth_forbidden', 'jeton OAuth : register_push_subscription refusé');
select throws_ok($$select public.schedule_rest_timer(gen_random_uuid(), 0, 't', 'b')$$,
  '42501', 'oauth_forbidden', 'jeton OAuth : schedule_rest_timer refusé');
select throws_ok($$select public.admin_storage_usage()$$, '42501', 'oauth_forbidden', 'jeton OAuth : admin_storage_usage refusé');
select is((select count(*)::int from storage.objects), 0, 'jeton OAuth : aucune photo lisible');

-- ---------- Jeton OAuth avec modifications autorisées ----------
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000c1', 'client-rw');
select is(
  public.sync_push(gen_random_uuid(), jsonb_build_array(jsonb_build_object('table', 'folders', 'row',
    jsonb_build_object('id', 'aaaaaaaa-2222-0000-0000-0000000000c1', 'user_id', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'name', 'Claude', 'position', 0,
      'client_updated_at', 99, 'client_device_id', gen_random_uuid())))) -> 0 ->> 'status',
  'accepted', 'écriture autorisée : sync_push accepté');
select lives_ok($$select public.mcp_log('update_folder', 'folders', 'aaaaaaaa-2222-0000-0000-0000000000c1', null, '{}')$$,
  'écriture autorisée : mcp_log permis');

-- ---------- Jeton OAuth d'un client jamais approuvé ----------
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000c1', 'client-x');
select is((select count(*)::int from public.folders), 0, 'client non approuvé : aucune lecture PostgREST');
select throws_ok($$select public.sync_pull('{}'::jsonb)$$, '42501', 'connection_revoked', 'client non approuvé : sync_pull refusé');

-- ---------- Déconnexion ----------
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000c1');
select public.revoke_mcp_connection('client-rw');
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000c1', 'client-rw');
select is((select count(*)::int from public.folders), 0, 'déconnecté : aucune lecture PostgREST');
select is((select count(*)::int from public.mcp_connections), 0, 'déconnecté : connexions illisibles');
select throws_ok($$select public.sync_pull('{}'::jsonb)$$, '42501', 'connection_revoked', 'déconnecté : sync_pull refusé');
select throws_ok($$select public.sync_fetch('[]'::jsonb)$$, '42501', 'connection_revoked', 'déconnecté : sync_fetch refusé');
select throws_ok(
  $$select public.sync_push(gen_random_uuid(), '[]'::jsonb)$$, '42501', 'connection_read_only', 'déconnecté : sync_push refusé');
select is(public.mcp_touch()->>'revoked', 'true', 'déconnecté : mcp_touch signale toujours la révocation');

select * from finish();
rollback;
