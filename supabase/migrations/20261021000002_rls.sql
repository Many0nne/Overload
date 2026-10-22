-- Isolation par Row Level Security (spec technique §7.3). L'admin n'a aucun contournement hors catalogue.

-- Cette méthode permet de savoir si l'appelant est administrateur lorsqu'il écrit dans le catalogue.
create function private.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.folders enable row level security;
alter table public.routines enable row level security;
alter table public.workouts enable row level security;
alter table public.body_measurements enable row level security;
alter table public.exercise_prefs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rest_timers enable row level security;

-- anon n'a accès à rien ; pas de delete physique (suppression logique) ; tables non synchronisées via RPC seulement.
revoke all on all tables in schema public from anon;
revoke delete, truncate on all tables in schema public from authenticated;
revoke all on public.push_subscriptions, public.rest_timers, public.sync_revs from authenticated;

-- Profil : seules quelques colonnes sont modifiables, aucune insertion directe.
revoke insert, update on public.profiles from authenticated;
grant update (display_name, avatar_path, settings, client_updated_at, client_device_id) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Exercices : catalogue lisible par tous, écrit par l'admin ; exercices perso propres au compte.
create policy exercises_select on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()) or (user_id is null and (select private.is_admin())));
create policy exercises_update on public.exercises for update to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select private.is_admin())))
  with check (user_id = (select auth.uid()) or (user_id is null and (select private.is_admin())));

-- Tables d'un compte : même politique propriétaire.
do $$
declare t text;
begin
  foreach t in array array['folders', 'routines', 'workouts', 'body_measurements', 'exercise_prefs'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------- Storage : bucket privé photos, chemin <user_id>/<objet> ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
