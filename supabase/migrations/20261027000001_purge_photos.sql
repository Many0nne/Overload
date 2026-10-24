-- Purge des photos orphelines (#61) : l'offre Free plafonne Storage à 1 Go pour tous les comptes.
-- Une photo est orpheline quand aucune séance non supprimée (ni aucun avatar) ne la référence : séance supprimée,
-- photo retirée ou remplacée dans le récapitulatif. Storage interdit le DELETE SQL direct (storage.protect_delete) :
-- pg_cron appelle chaque nuit l'Edge Function purge-photos, qui supprime les objets par l'API Storage.

-- Cette méthode permet de lister les photos qu'aucune séance non supprimée ne référence, une fois le délai de grâce passé.
-- Le délai couvre une photo envoyée dont le document n'est pas encore poussé (envoi coupé, appareil hors ligne).
create function public.orphan_photos(p_grace interval default interval '7 days', p_limit int default 1000)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'photos'
    and o.created_at < now() - p_grace
    and not exists (
      select 1 from public.workouts w where w.deleted_at is null and w.doc ->> 'photoPath' = o.name)
    and not exists (select 1 from public.profiles p where p.avatar_path = o.name)
  order by o.created_at
  limit p_limit;
$$;

-- Cette méthode permet de déclencher la purge des photos orphelines lorsque pg_cron l'exécute (chaque nuit).
-- Rien n'est appelé si l'URL ou le secret manquent dans private.config.
create function public.dispatch_photo_purge() returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.config where key = 'purge_photos_url';
  select value into v_secret from private.config where key = 'push_secret';
  if v_url is null or v_secret is null then
    return false;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 30000);
  return true;
end;
$$;

revoke execute on function public.orphan_photos(interval, int), public.dispatch_photo_purge()
  from public, anon, authenticated;
grant execute on function public.orphan_photos(interval, int) to service_role;

select cron.schedule('purge-orphan-photos', '41 3 * * *', 'select public.dispatch_photo_purge()');
