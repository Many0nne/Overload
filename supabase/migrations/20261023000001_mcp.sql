-- Connecteur Claude (serveur MCP distant, docs/spec-mcp.md §7.3) : connexions OAuth et journal des écritures.
-- Tables non synchronisées : l'écran Paramètres › Claude les lit en ligne seulement.

-- ---------- Connexions : droit d'écriture et révocation, par (compte, client OAuth) ----------
create table public.mcp_connections (
  user_id uuid not null references auth.users on delete cascade,
  client_id text not null,
  client_name text,
  can_write boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  primary key (user_id, client_id)
);

-- ---------- Journal des écritures faites par Claude (transparence, restauration manuelle) ----------
create table public.mcp_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  client_id text not null,
  tool text not null,
  sync_table text not null,
  row_id uuid not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index mcp_audit_user_at on public.mcp_audit (user_id, at desc);

alter table public.mcp_connections enable row level security;
alter table public.mcp_audit enable row level security;

revoke all on public.mcp_connections, public.mcp_audit from anon, authenticated;
grant select on public.mcp_connections, public.mcp_audit to authenticated;
grant update (can_write, revoked_at) on public.mcp_connections to authenticated;

create policy mcp_connections_select on public.mcp_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy mcp_connections_update on public.mcp_connections for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy mcp_audit_select on public.mcp_audit for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- RPC ----------

-- Cette méthode permet de lire le client OAuth du jeton courant lorsque le serveur MCP agit (absent pour une session de l'app).
create function private.jwt_client_id() returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'client_id', '');
$$;

-- Cette méthode permet d'enregistrer le choix « modifications autorisées » lorsque l'utilisateur approuve un client OAuth.
-- Une nouvelle approbation rétablit une connexion déconnectée.
create function public.upsert_mcp_connection(p_client_id text, p_client_name text, p_can_write boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  if coalesce(trim(p_client_id), '') = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.mcp_connections (user_id, client_id, client_name, can_write)
  values (v_uid, p_client_id, left(p_client_name, 200), coalesce(p_can_write, true))
  on conflict (user_id, client_id) do update set
    client_name = coalesce(excluded.client_name, public.mcp_connections.client_name),
    can_write = excluded.can_write,
    revoked_at = null;
end;
$$;

-- Cette méthode permet de déconnecter un client OAuth lorsque l'utilisateur le révoque dans Paramètres › Claude.
create function public.revoke_mcp_connection(p_client_id text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_uid();
begin
  update public.mcp_connections set revoked_at = now()
  where user_id = v_uid and client_id = p_client_id and revoked_at is null;
end;
$$;

-- Cette méthode permet au serveur MCP de valider la connexion du jeton courant à chaque requête (§5.3).
-- Elle crée la connexion absente avec les valeurs par défaut, note la dernière utilisation (au plus une fois par minute)
-- et renvoie { can_write, revoked } ; un jeton sans client_id (session de l'app) est refusé.
create function public.mcp_touch(p_client_name text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_client text := private.jwt_client_id();
  v_row public.mcp_connections;
begin
  if v_client is null then
    raise exception 'not_an_oauth_token' using errcode = '42501';
  end if;
  insert into public.mcp_connections (user_id, client_id, client_name, last_used_at)
  values (v_uid, v_client, left(p_client_name, 200), now())
  on conflict (user_id, client_id) do nothing;
  update public.mcp_connections set last_used_at = now()
  where user_id = v_uid and client_id = v_client
    and revoked_at is null and (last_used_at is null or last_used_at < now() - interval '1 minute');
  select * into v_row from public.mcp_connections where user_id = v_uid and client_id = v_client;
  return jsonb_build_object('can_write', v_row.can_write, 'revoked', v_row.revoked_at is not null);
end;
$$;

-- Cette méthode permet au serveur MCP de journaliser une écriture (ligne avant/après) lorsqu'un outil modifie une donnée.
create function public.mcp_log(p_tool text, p_table text, p_row_id uuid, p_before jsonb, p_after jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_client text := private.jwt_client_id();
begin
  if v_client is null then
    raise exception 'not_an_oauth_token' using errcode = '42501';
  end if;
  insert into public.mcp_audit (user_id, client_id, tool, sync_table, row_id, before, after)
  values (v_uid, v_client, p_tool, p_table, p_row_id, p_before, p_after);
end;
$$;

-- Cette méthode permet de purger le journal des écritures de Claude au-delà de 90 jours lorsque pg_cron l'exécute.
create function private.purge_mcp_audit() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.mcp_audit where at < now() - interval '90 days';
$$;

-- ---------- Droits d'exécution ----------
revoke execute on function private.jwt_client_id(), private.purge_mcp_audit() from public, anon, authenticated;
revoke execute on function public.upsert_mcp_connection(text, text, boolean), public.revoke_mcp_connection(text),
  public.mcp_touch(text), public.mcp_log(text, text, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_mcp_connection(text, text, boolean), public.revoke_mcp_connection(text),
  public.mcp_touch(text), public.mcp_log(text, text, uuid, jsonb, jsonb)
  to authenticated;

-- ---------- Planification ----------
select cron.schedule('purge-mcp-audit', '17 3 * * *', 'select private.purge_mcp_audit()');
