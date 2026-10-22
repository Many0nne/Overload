-- Schéma de base d'Overload (spec technique §5.2, contrat docs/contrat-serveur.md).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Schéma privé (jamais exposé par l'API) ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.config (
  key text primary key,
  value text not null
);

create table private.signup_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index signup_attempts_ip_at on private.signup_attempts (ip, at);

-- ---------- Révisions de synchronisation ----------
-- Un compteur par compte (scope = user_id) et un pour le catalogue (scope = uuid nul).
create table public.sync_revs (
  scope uuid primary key,
  rev bigint not null
);
alter table public.sync_revs enable row level security;
revoke all on public.sync_revs from anon, authenticated;

-- Cette méthode permet d'attribuer la révision suivante d'un compte (ou du catalogue) lorsqu'une ligne synchronisée change.
-- Le verrou de ligne sur sync_revs est tenu jusqu'à la validation : les rev d'un compte suivent l'ordre des commits.
create function private.next_rev(p_scope uuid) returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.sync_revs as s (scope, rev) values (p_scope, 1)
  on conflict (scope) do update set rev = s.rev + 1
  returning rev;
$$;

-- Cette méthode permet de poser la révision serveur sur une ligne synchronisée lorsqu'elle est insérée ou modifiée.
create function private.set_rev() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    new.rev := private.next_rev(new.id);
  else
    new.rev := private.next_rev(coalesce(new.user_id, '00000000-0000-0000-0000-000000000000'::uuid));
  end if;
  return new;
end;
$$;

-- Cette méthode permet de normaliser un nom pour la recherche (minuscules, sans accents) lorsqu'un exercice est écrit.
create function private.normalize_search(p text) returns text
language sql
immutable
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')));
$$;

-- Cette méthode permet de convertir des millisecondes epoch (JSON) en timestamptz lorsqu'une ligne arrive du client.
create function private.ms_to_ts(p jsonb) returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when p is null or jsonb_typeof(p) = 'null' then null
              else to_timestamp((p #>> '{}')::numeric / 1000.0) end;
$$;

-- Cette méthode permet de convertir un timestamptz en millisecondes epoch lorsqu'une ligne part vers le client.
create function private.ts_to_ms(p timestamptz) returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when p is null then null else round(extract(epoch from p) * 1000)::bigint end;
$$;

-- ---------- Tables synchronisées ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_path text,
  is_admin boolean not null default false,
  invite_code text unique not null,
  settings jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  client_device_id uuid not null default '00000000-0000-0000-0000-000000000000',
  rev bigint not null default 0
);

create table public.exercises (
  id uuid primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  name_search text not null default '',
  equipment text not null check (equipment in ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  measurement_type text not null check (measurement_type in
    ('weight_reps','bodyweight','weighted_bw','assisted_bw','duration','weight_duration','distance_duration')),
  instructions text,
  source_id text,
  archived_at timestamptz,
  client_updated_at bigint not null default 0,
  client_device_id uuid not null default '00000000-0000-0000-0000-000000000000',
  deleted_at timestamptz,
  rev bigint not null default 0
);

create table public.folders (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  position int not null default 0,
  collapsed boolean not null default false,
  client_updated_at bigint not null,
  client_device_id uuid not null,
  deleted_at timestamptz,
  rev bigint not null default 0
);

create table public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  folder_id uuid,
  position int not null default 0,
  doc jsonb not null,
  client_updated_at bigint not null,
  client_device_id uuid not null,
  deleted_at timestamptz,
  rev bigint not null default 0
);

create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  status text not null check (status in ('in_progress', 'completed')),
  owner_device_id uuid not null,
  routine_id uuid,
  started_at timestamptz not null,
  exercise_ids uuid[] not null default '{}',
  doc jsonb not null,
  client_updated_at bigint not null,
  client_device_id uuid not null,
  deleted_at timestamptz,
  rev bigint not null default 0
);

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  measured_on date not null,
  values jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null,
  client_device_id uuid not null,
  deleted_at timestamptz,
  rev bigint not null default 0
);

create table public.exercise_prefs (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  doc jsonb not null,
  client_updated_at bigint not null,
  client_device_id uuid not null,
  deleted_at timestamptz,
  rev bigint not null default 0,
  unique (user_id, exercise_id)
);

-- ---------- Tables non synchronisées ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  device_id uuid unique not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.rest_timers (
  device_id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  ends_at timestamptz not null,
  title text not null,
  body text not null,
  sent_at timestamptz
);

-- ---------- Index ----------
create index profiles_rev on public.profiles (id, rev);
create index exercises_user_rev on public.exercises (user_id, rev);
create index exercises_catalog_rev on public.exercises (rev) where user_id is null;
create index folders_user_rev on public.folders (user_id, rev);
create index routines_user_rev on public.routines (user_id, rev);
create index workouts_user_rev on public.workouts (user_id, rev);
create index body_measurements_user_rev on public.body_measurements (user_id, rev);
create index exercise_prefs_user_rev on public.exercise_prefs (user_id, rev);
create index workouts_user_started on public.workouts (user_id, started_at desc);
create index workouts_exercise_ids on public.workouts using gin (exercise_ids);
create index rest_timers_due on public.rest_timers (ends_at) where sent_at is null;

-- ---------- Triggers ----------
create trigger set_rev before insert or update on public.profiles for each row execute function private.set_rev();
create trigger set_rev before insert or update on public.exercises for each row execute function private.set_rev();
create trigger set_rev before insert or update on public.folders for each row execute function private.set_rev();
create trigger set_rev before insert or update on public.routines for each row execute function private.set_rev();
create trigger set_rev before insert or update on public.workouts for each row execute function private.set_rev();
create trigger set_rev before insert or update on public.body_measurements for each row execute function private.set_rev();
create trigger set_rev before insert or update on public.exercise_prefs for each row execute function private.set_rev();

-- Cette méthode permet de recalculer name_search et de figer le type de mesure du catalogue lorsqu'un exercice est écrit.
create function private.exercises_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name_search := private.normalize_search(new.name);
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'exercise owner cannot change' using errcode = '42501';
    end if;
    if old.user_id is null and new.measurement_type <> old.measurement_type then
      raise exception 'catalog measurement_type is immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger exercises_guard before insert or update on public.exercises
  for each row execute function private.exercises_guard();
