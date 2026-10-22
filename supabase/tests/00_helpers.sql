-- Outils de test partagés (schéma tests, créé une fois ; chaque fichier de test tourne dans sa transaction).
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Cette méthode permet de créer un utilisateur auth et son profil lorsqu'un test a besoin d'un compte.
create or replace function tests.create_user(p_id uuid, p_email text, p_is_admin boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  insert into auth.users (id, email, aud, role, instance_id, created_at, updated_at)
  values (p_id, p_email, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now(), now());
  perform public.admin_create_profile(p_id, split_part(p_email, '@', 1), '{}'::jsonb, p_is_admin);
  return p_id;
end;
$$;

-- Cette méthode permet de simuler la session d'un utilisateur lorsqu'un test appelle l'API en son nom.
create or replace function tests.authenticate_as(p_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Cette méthode permet de revenir au rôle postgres lorsqu'un test doit préparer ou vérifier des données sans RLS.
create or replace function tests.as_postgres() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select pass('helpers installés');
select * from finish();
commit;
