-- Purge des photos orphelines (#61) : seuls les objets non référencés depuis le délai de grâce sont listés.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'photos@test.local');

insert into public.workouts (id, user_id, status, owner_device_id, started_at, doc, deleted_at, client_updated_at, client_device_id)
values
  ('00000000-0000-7000-8000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'completed',
   '00000000-0000-0000-0000-000000000000', now(),
   '{"schemaVersion": 1, "title": "A", "exercises": [], "photoPath": "00000000-0000-0000-0000-0000000000c1/kept.jpg"}',
   null, 1, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-7000-8000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'completed',
   '00000000-0000-0000-0000-000000000000', now(),
   '{"schemaVersion": 1, "title": "B", "exercises": [], "photoPath": "00000000-0000-0000-0000-0000000000c1/deleted.jpg"}',
   now(), 1, '00000000-0000-0000-0000-000000000000');

insert into storage.objects (bucket_id, name, owner, created_at) values
  ('photos', '00000000-0000-0000-0000-0000000000c1/kept.jpg', '00000000-0000-0000-0000-0000000000c1', now() - interval '30 days'),
  ('photos', '00000000-0000-0000-0000-0000000000c1/deleted.jpg', '00000000-0000-0000-0000-0000000000c1', now() - interval '30 days'),
  ('photos', '00000000-0000-0000-0000-0000000000c1/replaced.jpg', '00000000-0000-0000-0000-0000000000c1', now() - interval '30 days'),
  ('photos', '00000000-0000-0000-0000-0000000000c1/recent.jpg', '00000000-0000-0000-0000-0000000000c1', now() - interval '1 day');

create temp table orphans as select name from public.orphan_photos() where name like '00000000-0000-0000-0000-0000000000c1/%';

select ok(not exists (select 1 from orphans where name like '%/kept.jpg'), 'une photo référencée est gardée');
select ok(exists (select 1 from orphans where name like '%/deleted.jpg'), 'la photo d''une séance supprimée est orpheline');
select ok(exists (select 1 from orphans where name like '%/replaced.jpg'), 'une photo remplacée ou abandonnée est orpheline');
select ok(not exists (select 1 from orphans where name like '%/recent.jpg'), 'une photo récente attend le délai de grâce');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok('select * from public.orphan_photos()', '42501', null, 'un utilisateur ne liste pas les orphelins');
select throws_ok('select public.dispatch_photo_purge()', '42501', null, 'un utilisateur ne déclenche pas la purge');

select * from finish();
rollback;
