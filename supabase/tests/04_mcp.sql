-- Connecteur Claude (docs/spec-mcp.md §7.3) : isolation des connexions et du journal, RPC réservées au jeton OAuth.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000a1', 'mcp-a@test.local');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000b2', 'mcp-b@test.local');

-- Cette méthode permet de simuler un jeton OAuth (claim client_id) lorsqu'un test appelle l'API comme le serveur MCP.
create function tests.authenticate_oauth(p_id uuid, p_client text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'client_id', p_client)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
grant execute on function tests.authenticate_oauth(uuid, text) to authenticated;

-- ---------- Sans session ----------
select tests.as_postgres();
set local role anon;
select throws_ok($$select public.upsert_mcp_connection('c1', 'Claude', true)$$, '42501', null,
  'upsert_mcp_connection refusée à anon');

-- ---------- Session de l'app (sans client_id) ----------
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000a1');
select lives_ok($$select public.upsert_mcp_connection('client-a', 'Claude', false)$$, 'A enregistre son consentement');
select is((select can_write from public.mcp_connections where client_id = 'client-a'), false, 'choix « modifications » gardé');
select throws_ok($$select public.mcp_touch()$$, '42501', 'not_an_oauth_token', 'mcp_touch refusé sans client_id');
select throws_ok($$select public.mcp_log('t', 'routines', gen_random_uuid(), null, null)$$, '42501', 'not_an_oauth_token',
  'mcp_log refusé sans client_id');
select throws_ok($$insert into public.mcp_connections (user_id, client_id) values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'x')$$,
  '42501', null, 'pas d''insertion directe');
select lives_ok($$update public.mcp_connections set can_write = true where client_id = 'client-a'$$,
  'le propriétaire règle can_write');
select throws_ok($$update public.mcp_connections set client_id = 'autre'$$, '42501', null, 'client_id non modifiable');

-- ---------- Jeton OAuth du compte A ----------
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000a1', 'client-a');
select is(public.mcp_touch(), '{"can_write": true, "revoked": false}'::jsonb, 'mcp_touch renvoie l''état de la connexion');
select lives_ok($$select public.mcp_log('create_routine', 'routines', 'aaaaaaaa-1111-0000-0000-000000000001', null, '{"x":1}')$$,
  'mcp_log journalise');
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000a1', 'client-nouveau');
select is(public.mcp_touch('Claude'), '{"can_write": true, "revoked": false}'::jsonb,
  'connexion absente créée avec les valeurs par défaut');

-- ---------- Révocation ----------
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000a1');
select public.revoke_mcp_connection('client-a');
select tests.authenticate_oauth('aaaaaaaa-0000-0000-0000-0000000000a1', 'client-a');
select is(public.mcp_touch()->>'revoked', 'true', 'connexion révoquée signalée');
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000a1');
select public.upsert_mcp_connection('client-a', 'Claude', true);
select is((select revoked_at from public.mcp_connections where client_id = 'client-a'), null,
  'une nouvelle approbation rétablit la connexion');

-- ---------- Isolation A / B ----------
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.mcp_connections), 0, 'B ne voit pas les connexions de A');
select is((select count(*)::int from public.mcp_audit), 0, 'B ne voit pas le journal de A');
update public.mcp_connections set revoked_at = now();
select tests.as_postgres();
select is((select count(*)::int from public.mcp_connections
  where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and revoked_at is not null), 0,
  'B ne peut pas révoquer les connexions de A');

select * from finish();
rollback;
