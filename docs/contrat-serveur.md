# Contrat client ↔ serveur (Supabase)

Précise la spec technique (§6, §7, §8) pour que le front et le SQL restent alignés. Types TS : `app/src/domain/types.ts`.

## Format des lignes
- Les lignes échangées ont les colonnes de la table, en snake_case. `doc`, `settings` et `values` sont des objets JSON.
- `started_at`, `deleted_at` et `archived_at` circulent en **millisecondes epoch** (`number`) ; le SQL convertit avec `to_timestamp(ms / 1000.0)` et `(extract(epoch from ts) * 1000)::bigint`.
- `measured_on` circule en `'AAAA-MM-JJ'`.
- `client_updated_at` est un `bigint` (ms). `rev` est renvoyé par le serveur, ignoré en entrée.

## RPC (toutes `security definer`, `search_path = ''`, refusent `auth.uid() is null`)

### `sync_push(p_device_id uuid, p_changes jsonb) returns jsonb`
- Entrée : `[{ "table": SyncTable, "row": {...} }, ...]` (100 au plus).
- Pour chaque élément, contrôle d'appartenance :
  - `profiles` : `row.id = auth.uid()` ; seuls `display_name`, `avatar_path`, `settings` sont écrits (jamais `is_admin`, `invite_code`) ; pas d'insertion (le profil est créé par `signup-with-invite`).
  - `exercises` : `row.user_id = auth.uid()`, ou `row.user_id is null` et appelant admin. Le `measurement_type` d'une ligne existante n'est jamais modifié (catalogue : toujours ; perso : le client gère le gel).
  - autres tables : `row.user_id = auth.uid()`.
  - Sinon : statut `forbidden`.
- « Dernier gagne » : écriture si la ligne n'existe pas, ou si `(client_updated_at, client_device_id)` entrant > existant (comparaison lexicographique, `client_device_id` comparé en texte). Sinon `stale`.
- Séance en cours : si la ligne `workouts` existante a `status = 'in_progress'` et `owner_device_id <> p_device_id` → `rejected_not_owner`, quel que soit l'horodatage.
- Sortie : `[{ "table", "id", "status": "accepted" | "stale" | "rejected_not_owner" | "forbidden" }]`.
- Verrou `pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0))`.

### `sync_pull(p_cursors jsonb) returns jsonb`
- Entrée : `{ "profiles": rev, "exercises": rev, "catalog": rev, "folders": rev, "routines": rev, "workouts": rev, "body_measurements": rev, "exercise_prefs": rev }` (clé absente = 0).
- `exercises` = exercices perso du compte ; `catalog` = exercices `user_id is null` (curseur global).
- Sortie : `{ "changes": { "<clé>": [rows...] }, "cursors": { "<clé>": rev max renvoyé }, "has_more": bool }`, 500 lignes au plus par clé, triées par `rev`. Les tombstones (`deleted_at` non nul) sont renvoyés.

### `rev`
- Table `public.sync_revs(scope uuid primary key, rev bigint)` : un compteur par compte, plus le scope `00000000-0000-0000-0000-000000000000` pour le catalogue.
- Trigger `before insert or update` sur chaque table synchronisée : `new.rev = next_rev(coalesce(new.user_id, nil))` (pour `profiles` : `new.id`).

### Autres RPC
- `take_over_workout(p_id uuid, p_device_id uuid) returns jsonb` : passe `owner_device_id` à `p_device_id` (séance du compte, `in_progress`), met à jour `client_updated_at = now_ms`, `client_device_id = p_device_id`, renvoie la ligne.
- `regenerate_invite() returns text` : nouveau code (12 caractères parmi `ABCDEFGHJKMNPQRSTVWXYZ23456789`, sans tirets), renvoyé sans tirets.
- `register_push_subscription(p_device_id uuid, p_endpoint text, p_p256dh text, p_auth text) returns void` : upsert sur `device_id`.
- `unregister_push_subscription(p_device_id uuid) returns void`.
- `schedule_rest_timer(p_device_id uuid, p_ends_at_ms bigint, p_title text, p_body text) returns void` : upsert sur `device_id`, `sent_at = null`.
- `cancel_rest_timer(p_device_id uuid) returns void`.
- `health() returns text` : `'ok'`, accessible à `anon`.
- `server_now_ms() returns bigint` : pour l'avertissement d'horloge (l'en-tête `Date` n'est pas lisible en CORS ; le client place l'heure serveur au milieu de l'aller-retour, alerte au-delà de 5 min).
- `admin_storage_usage() returns jsonb` : `{ used_bytes, quota_bytes }`, occupation totale de Storage (tous buckets). Admin seulement, sinon `42501 forbidden`. Le client alerte à 80 %.

## Edge Functions
- `signup-with-invite` (POST, sans JWT) : `{ code, email, password, display_name, settings }`. Le code est normalisé (majuscules, sans tirets ni espaces). Réponses : `200 { ok: true }`, `400 { error: 'invalid_code' | 'email_taken' | 'weak_password' | 'invalid_input' }`, `429 { error: 'rate_limited' }` (5 / IP / heure, table `signup_attempts`). Le client ouvre ensuite la session avec `signInWithPassword`.
- `send-push` (POST, en-tête `x-push-secret`) : `{ device_id, title, body }`. Appelée par `dispatch_due_timers()` via `pg_net`.
- `delete-account` (POST, JWT) : supprime `photos/<uid>/*`, puis `auth.admin.deleteUser(uid)`.

## Notifications (pg_cron)
- `dispatch_due_timers()` chaque seconde. URL et secret lus dans `private.config` (clés `send_push_url`, `push_secret`), alimentée par une migration locale et par une commande manuelle en prod (voir `DEPLOY.md`).

## Storage
- Bucket privé `photos`, chemins `<user_id>/<workout_id>.jpg` et `<user_id>/avatar.jpg`.
