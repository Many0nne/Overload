-- Alerte de quota photos (§19 spec technique) : l'offre Free plafonne Storage à 1 Go pour tous les comptes.
-- Seul l'admin lit l'occupation totale ; il n'apprend rien du contenu des autres comptes, seulement un total.

-- Cette méthode permet à l'admin de lire l'occupation totale de Storage et le quota lorsqu'il ouvre ses paramètres.
create function public.admin_storage_usage() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'used_bytes', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o),
    'quota_bytes', 1073741824::bigint
  );
end;
$$;

revoke execute on function public.admin_storage_usage() from public, anon, authenticated;
grant execute on function public.admin_storage_usage() to authenticated;
