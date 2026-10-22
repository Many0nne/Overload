-- Occupation de Storage : total lisible par l'admin seul (§19 spec technique, alerte de quota photos).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', true);
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'user@test.local');

insert into storage.objects (bucket_id, name, owner, metadata) values
  ('photos', '00000000-0000-0000-0000-0000000000b1/w1.jpg', '00000000-0000-0000-0000-0000000000b1', '{"size": 300000}'),
  ('photos', '00000000-0000-0000-0000-0000000000a1/w2.jpg', '00000000-0000-0000-0000-0000000000a1', '{"size": 200000}');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select is((public.admin_storage_usage() ->> 'used_bytes')::bigint >= 500000, true,
  'l''admin lit l''occupation totale, tous comptes confondus');
select is((public.admin_storage_usage() ->> 'quota_bytes')::bigint, 1073741824::bigint, 'quota de 1 Go');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok('select public.admin_storage_usage()', '42501', 'forbidden',
  'un utilisateur non admin ne lit pas l''occupation');

select * from finish();
rollback;
