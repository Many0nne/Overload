-- Configuration locale uniquement (jamais appliquée en prod : les seeds ne passent pas par db push).
-- send-push est joignable depuis le conteneur Postgres via la passerelle exposée sur l'hôte.
insert into private.config (key, value) values
  ('send_push_url', 'http://host.docker.internal:54321/functions/v1/send-push'),
  ('push_secret', 'dev-push-secret')
on conflict (key) do update set value = excluded.value;
