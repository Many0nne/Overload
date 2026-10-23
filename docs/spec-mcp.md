# Spécification : connecteur Claude (serveur MCP distant)

> Complète [SPEC.md](../SPEC.md) (§F), [SPEC-TECHNIQUE.md](../SPEC-TECHNIQUE.md) et [contrat-serveur.md](contrat-serveur.md).
> Version 0.2, 23/10/2026. Lots M0 à M2 implémentés (branche `feature/connecteur-claude`) ; M3 (production) reste à faire. Décisions du §12 tranchées selon les recommandations ; constats du spike M0 au §11.

---

## 1. Objectif

Permettre à chaque utilisateur de **brancher son propre Claude** (claude.ai web, Claude Desktop, Claude mobile, Claude Code) sur son compte Overload, pour :

- **interroger** ses données en langage naturel : « compare mes 3 dernières séances de squat », « où en est ma progression au développé couché depuis janvier ? », « quels muscles j'ai négligés ce mois-ci ? » ;
- **agir** sur ses données : « crée-moi une routine push/pull/legs en 8–12 », « ajoute la séance d'hier : squat 3 × 5 à 100 kg », « note mon poids de ce matin : 81,4 kg ».

Ce que ce n'est **pas** : un chat dans l'application (lot ultérieur, qui réutilisera les outils définis ici), ni un accès de Claude aux données d'un autre compte.

**Coût** : aucun coût d'IA pour l'application. Les tokens sont payés par l'abonnement Claude de l'utilisateur. Côté serveur, un appel d'Edge Function par appel d'outil (limite Free : 500 000/mois).

## 2. Principes

1. **Le serveur MCP est un appareil comme un autre.** Il lit et écrit par les mêmes chemins que l'app (`sync_push`, RLS). Les téléphones récupèrent ses modifications au prochain `sync_pull` (30 s au plus app ouverte, §6.3). Aucun changement du moteur de synchronisation.
2. **Isolation par la base.** Le serveur agit avec le jeton OAuth de l'utilisateur, jamais avec la clé secrète. La RLS existante s'applique telle quelle.
3. **Mêmes calculs que l'app.** Records, 1RM, tendance, volume, statistiques : les fonctions pures de `app/src/domain/` sont importées par l'Edge Function. Claude voit exactement les chiffres affichés dans l'app.
4. **Écritures prudentes.** La lecture est toujours permise ; l'écriture se règle par connexion (§5.3). Toute écriture est journalisée (§7.5) et réversible (suppression logique).
5. **Pas de séance en direct.** Claude ne touche jamais une séance `in_progress` : c'est l'appareil propriétaire qui la tient (§F7.9).

## 3. Parcours utilisateur

### C1. Connecter Claude

1. Dans l'app, **Paramètres › Claude** affiche l'URL du connecteur (bouton « Copier ») et un court mode d'emploi :
   - claude.ai / Desktop / mobile : *Paramètres › Connecteurs › Ajouter un connecteur personnalisé*, coller l'URL ;
   - Claude Code : `claude mcp add --transport http overload <URL>`.
2. Claude ouvre la **page de consentement** d'Overload (`/oauth/consent`) dans un navigateur (Safari, navigateur intégré de l'app Claude, ou navigateur par défaut).
3. Si l'utilisateur n'y est pas connecté, la page affiche le formulaire de connexion (e-mail + mot de passe), sur la même page.
4. La page affiche : le nom du client (« Claude »), le domaine de retour (`claude.ai`, ou `localhost` avec un avertissement pour Claude Code), ce que Claude pourra faire, et une case **« Autoriser Claude à modifier mes données »** (cochée par défaut, voir Q-M2).
5. « Autoriser » renvoie vers Claude, qui est connecté. « Refuser » renvoie vers Claude avec un refus.

### C2. Utiliser Claude

L'utilisateur parle à Claude. Claude appelle les outils (§6). Avant chaque écriture, le client Claude demande confirmation selon ses propres réglages ; les outils d'écriture sont annotés pour l'y inciter (§6.4).

### C3. Gérer les connexions

**Paramètres › Claude** liste les connexions actives (client, date de connexion, dernière utilisation, droit d'écriture). Pour chacune : interrupteur « Modifications autorisées » et bouton **« Déconnecter »**. Une connexion déconnectée est refusée dès l'appel suivant ; Claude redemande alors l'autorisation. « Déconnecter » révoque aussi l'autorisation côté Supabase Auth (`auth.oauth.revokeGrant`) : sans cela, Supabase réapprouverait en silence un client déjà autorisé et la page de consentement ne serait jamais réaffichée.

## 4. Architecture

```
Claude (claude.ai / Desktop / mobile / Code)
   │  1. POST /functions/v1/mcp  sans jeton  ──► 401 + WWW-Authenticate: resource_metadata=…
   │  2. GET  …/mcp/.well-known/oauth-protected-resource   (Edge Function)
   │  3. GET  /.well-known/oauth-authorization-server/auth/v1   (Supabase Auth)
   │  4. POST <registration_endpoint annoncé>   (DCR, si activé)
   │  5. navigateur ► /auth/v1/oauth/authorize ► <app>/oauth/consent?authorization_id=…
   │  6. POST /auth/v1/oauth/token   (code + PKCE S256 ► access + refresh)
   ▼
Edge Function `mcp` (Deno, Streamable HTTP)
   ├─ vérifie le JWT (claims : sub, client_id) et la connexion (`mcp_connections`)
   ├─ lit via PostgREST avec le jeton de l'utilisateur (RLS)
   ├─ calcule avec app/src/domain/*
   └─ écrit via la RPC `sync_push` (appareil virtuel) + journal `mcp_audit`
```

- **Serveur d'autorisation** : le serveur OAuth 2.1 de Supabase Auth (bêta, gratuit pendant la bêta sur toutes les offres). Il fournit l'autorisation avec PKCE, le jeton, la rotation des jetons de rafraîchissement, la découverte RFC 8414 et l'enregistrement dynamique (DCR, RFC 7591). Aucune brique OAuth n'est écrite à la main.
- **Serveur de ressources** : une Edge Function `mcp`, transport MCP Streamable HTTP. Bibliothèque : SDK officiel `@modelcontextprotocol/sdk` (`WebStandardStreamableHTTPServerTransport`), ou `mcp-lite` si le démarrage à froid du SDK est trop lent (à mesurer en L0).
- **Page de consentement** : route de l'app web existante (Cloudflare Pages), chargée à la demande.

## 5. Authentification et autorisation

### 5.1 Configuration Supabase

`supabase/config.toml` (local) et tableau de bord (prod) :

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"   # combiné à site_url
allow_dynamic_registration = true            # nécessaire pour les connecteurs personnalisés de Claude
```

- **Clés de signature asymétriques** (ES256) recommandées : l'Edge Function vérifie alors le jeton localement via JWKS (`auth.getClaims()`), sans appel réseau. En HS256, `getClaims()` se rabat sur un appel à Auth à chaque requête. Migration des clés à faire en prod avant l'ouverture (impact : aucun pour l'app, supabase-js gère les deux).
- **Durée des jetons** : `jwt_expiry` actuel (1 h) ; Claude rafraîchit seul (au 401, ou 5 min avant expiration). `enable_refresh_token_rotation = true` est déjà actif, ce qu'exige la spec MCP pour un client public.
- **URI de retour** acceptées pour les clients enregistrés dynamiquement : `https://claude.ai/api/mcp/auth_callback` (claude.ai, Desktop, mobile) et boucle locale `http://localhost:<port>/callback`, `http://127.0.0.1:<port>/callback` (Claude Code, port variable). **À vérifier en L0** : que la validation de Supabase accepte le port variable (voir §11).

### 5.2 Découverte (Edge Function)

L'Edge Function ne peut pas servir `/.well-known/*` à la racine du domaine ; elle utilise le pointeur `resource_metadata`, que Claude suit en priorité.

- Toute requête MCP sans jeton valide → `401` avec
  `WWW-Authenticate: Bearer resource_metadata="https://<ref>.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource"`.
  Jamais un `200` : Claude ignore `WWW-Authenticate` sur un `200`.
- `GET /functions/v1/mcp/.well-known/oauth-protected-resource` (sans jeton) renvoie :

```json
{
  "resource": "https://<ref>.supabase.co/functions/v1/mcp",
  "authorization_servers": ["https://<ref>.supabase.co/auth/v1"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["email"]
}
```

- `resource` doit être **exactement** l'URL saisie par l'utilisateur (c'est celle affichée dans Paramètres › Claude). Construite à partir de `SUPABASE_URL`, pas de l'en-tête `Host`. Exceptions : `MCP_PUBLIC_URL` (secret de la fonction, pour un tunnel de test) et la pile locale, où `SUPABASE_URL` vaut l'adresse interne de Kong (`http://kong:8000`) et où l'hôte publié est repris des en-têtes `x-forwarded-*` de Kong.
- `verify_jwt = false` pour cette fonction dans `config.toml` : la vérification est faite dans le code, pour pouvoir répondre le `401` attendu.

### 5.3 Contrôle à chaque requête

1. Lire `Authorization: Bearer <jeton>` ; absent ou invalide (`getClaims()` en échec, expiré) → `401` du §5.2.
2. Exiger la présence du claim `client_id` : un jeton de session de l'app (sans `client_id`) est refusé (`401`). Le connecteur n'est utilisable qu'à travers OAuth.
3. Chercher `mcp_connections(user_id = sub, client_id)` :
   - absente → la créer avec les valeurs par défaut (cas d'une connexion approuvée dont la page de consentement n'a pas pu enregistrer le choix) ;
   - `revoked_at` non nul → `401` (Claude relance l'autorisation, qui recrée l'accès si l'utilisateur approuve).
4. Mettre à jour `last_used_at` (au plus une fois par minute pour limiter les écritures).
5. Un outil d'écriture appelé alors que `can_write = false` renvoie une erreur d'outil lisible : « Les modifications sont désactivées pour cette connexion (Paramètres › Claude). »

Les scopes standard de Supabase (`openid`, `email`, `profile`, `phone`) ne permettent pas d'exprimer « lecture » / « écriture ». Le droit d'écriture vit donc dans `mcp_connections`, réglé à la page de consentement et dans Paramètres.

### 5.4 Page de consentement (`/oauth/consent`)

- Route publique de l'app, ajoutée à la liste `publicPath` d'`App.tsx` (comme `/reset`) : sur iOS hors mode standalone, elle ne doit **pas** afficher la page d'installation.
- Chargée à la demande (lazy), sans démarrer Dexie ni la synchronisation : se connecter dans Safari pour approuver ne doit pas télécharger toutes les données dans le navigateur.
- Session Supabase **non persistée** (`persistSession: false`) : la page ouvre une session le temps du consentement, puis la ferme.
- Étapes : lire `authorization_id` ; connexion si nécessaire (la session de l'app ouverte dans le même navigateur est reprise si son jeton est encore valide, sans la rafraîchir) ; `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` ; afficher client, domaine de retour, droits ; si la demande est déjà approuvée (client autorisé auparavant), `getAuthorizationDetails` renvoie directement `redirect_url` et la page y renvoie aussitôt ; sinon `approveAuthorization` ou `denyAuthorization` et suivre la redirection renvoyée.
- Avant `approveAuthorization`, la page enregistre le choix « modifications autorisées » par la RPC `upsert_mcp_connection(p_client_id, p_client_name, p_can_write)`.
- Si le domaine de retour est une boucle locale (`localhost`, `127.0.0.1`), afficher l'avertissement exigé par la spec MCP : « Ne continuez que si vous venez de lancer Claude Code sur cet ordinateur. »
- Textes en français, thème de l'app.

## 6. Outils MCP

### 6.1 Conventions

- Noms en anglais `snake_case` (convention MCP, meilleure compréhension par le modèle) ; **descriptions en français**, précises sur les unités et les limites.
- Entrées validées par schéma (zod). Identifiants = UUID ; tout outil qui prend un exercice accepte aussi un **nom** (`exercise`) résolu par `search.ts` (même recherche sans accents que la bibliothèque) ; ambiguïté → erreur listant les candidats.
- Sorties : `structuredContent` (JSON) **et** un résumé texte en français. Valeurs dans les **unités de l'utilisateur** (`settings.units`), avec l'unité de saisie conservée dans le JSON (`{ v, u }`), comme l'app (§F7.8).
- Dates : ISO 8601 en entrée et en sortie, fuseau de l'appareil inconnu côté serveur → l'outil accepte un paramètre `tz` (IANA, défaut `Europe/Paris`) pour les regroupements par jour et par semaine.
- Volumes bornés : listes paginées (`limit` ≤ 50, `cursor`), historique d'un exercice limité à 2 ans par défaut. Objectif : moins de 1 s par appel et peu de tokens.
- Les éléments supprimés (`deleted_at`) et les exercices archivés sont exclus, sauf paramètre explicite.

### 6.2 Lecture

| Outil | Entrée | Sortie |
|---|---|---|
| `get_profile` | — | Nom, unités, ancienneté, objectifs activés, nombre de séances, série de semaines en cours. |
| `search_exercises` | `query`, `muscle?`, `equipment?`, `limit?` | Exercices (catalogue + perso) : id, nom, équipement, muscles, type de mesure. |
| `list_workouts` | `from?`, `to?`, `exercise?`, `routine?`, `limit?`, `cursor?` | Séances terminées, récentes d'abord : date, titre, durée, volume, nombre de records, objectifs atteints n/m. |
| `get_workout` | `id` | Séance complète : exercices, séries (type, charge, reps, durée, distance, validée, objectif), notes, badges de record. |
| `get_exercise_history` | `exercise`, `from?`, `to?` | Par séance : séries de travail, meilleur 1RM estimé (Epley), volume. Plus la « dernière fois ». |
| `get_records` | `exercise?` | Records par critère (§F7.6) avec date et séance ; sans `exercise` : records récents (`recentRecords`). |
| `get_progression` | `exercise` | Tendance (`fitTrend`), rythme actuel, projection à 4 et 12 semaines, objectif à long terme et date d'atteinte estimée ; « pas assez de données » si les conditions du §F7.10 ne sont pas réunies. |
| `get_stats` | `from`, `to`, `tz?` | Séances, durée, volume, séries par semaine ; répartition musculaire (`stats.ts`) ; calendrier des jours d'entraînement. |
| `list_routines` | — | Dossiers et routines : nom, exercices, séries prévues, fourchettes, repos. |
| `get_routine` | `id` | Routine complète. |
| `list_body_measurements` | `from?`, `to?`, `keys?` | Mesures par date. |

Hors V1 en lecture : les photos (jamais envoyées à Claude, voir §8).

### 6.3 Écriture

Toutes passent par `sync_push` (§7.2) et exigent `can_write`.

| Outil | Entrée | Effet et règles |
|---|---|---|
| `create_routine` | `name`, `folder?`, `note?`, `exercises[]` : `{ exercise, sets: [{ kind, weight? }], repRange?, restS? }` | Crée une `RoutineDoc` (schemaVersion 1). `restS` absent = repos par défaut de l'utilisateur. `repRange` refusé pour les types sans reps. Placée en fin de dossier. |
| `update_routine` | `id`, champs à changer (mêmes formes) | Remplace le document entier après fusion des champs fournis. Les ids des exercices conservés sont gardés. |
| `log_workout` | `startedAt`, `title?`, `durationS?` (défaut 1 h), `note?`, `routine?`, `exercises[]` : `{ exercise, sets: [{ kind, weight?, reps?, durationS?, distance? }] }` | Saisie a posteriori (§F7.5) : séance `completed`, séries `done = true`, sans objectif (comme la saisie a posteriori de l'app). Champs requis selon le type de mesure (`measurement.ts`). Unité absente = unité de l'utilisateur. |
| `update_workout` | `id`, champs à changer | Séance **terminée** uniquement ; `in_progress` → erreur « séance en cours sur un appareil ». Les records et objectifs atteints se recalculent seuls dans l'app (§10.3). |
| `delete_workout` | `id` | Suppression logique (`deleted_at`). Séance terminée uniquement. |
| `add_body_measurement` | `date`, `values` (clés de `BodyMeasurementKey`) | Une mesure par jour : complète la mesure existante du jour sans écraser les champs déjà remplis, sauf `overwrite: true`. |
| `set_exercise_goal` | `exercise`, `weight`, `reps` (1–12) | Objectif à long terme (`exercise_prefs.doc.longTermGoal`, `setAt = now`). |
| `set_exercise_prefs` | `exercise`, `increment?`, `defaultRepRange?` | Réglages de progression (§F7.10). |

Hors V1 en écriture : exercices personnalisés (création, modification, archivage), dossiers (sauf par `create_routine.folder` qui réutilise un dossier existant par nom), profil et paramètres, démarrage d'une séance en direct.

### 6.4 Annotations

Chaque outil porte les annotations MCP : `readOnlyHint: true` pour la lecture ; `readOnlyHint: false` et `destructiveHint` (`true` pour `update_*` et `delete_workout`) pour l'écriture. Les annotations sont fixes par outil : `add_body_measurement` reste `destructiveHint: false` (son comportement par défaut ne fait que compléter ; `overwrite` est explicite dans la description). Les clients Claude s'en servent pour demander confirmation.

### 6.5 Instructions du serveur

Le champ `instructions` de l'initialisation MCP donne à Claude le contexte métier, en quelques lignes : unités de saisie conservées, séries de travail vs échauffement, définition des records et du 1RM (Epley, 12 reps au plus), objectifs figés au démarrage, « ne jamais inventer un exercice : chercher d'abord avec `search_exercises` ».

## 7. Implémentation serveur

### 7.1 Organisation

```
supabase/functions/
  mcp/
    index.ts            routage : /.well-known/oauth-protected-resource, MCP, 401
    auth.ts             vérification du jeton, mcp_connections
    tools/              un fichier par groupe (read.ts, write.ts), schémas zod
    format.ts           résumés texte en français (réutilise domain/format.ts)
    store.ts            lectures PostgREST, écriture sync_push + mcp_log
  _shared/
    domain/             copie générée de app/src/domain (npm run edge:domain)
```

- **Réutilisation du domaine** : le runtime edge (local comme déployé) ne voit que `supabase/functions/`. Le cœur pur des outils vit dans `app/src/domain/mcp/` (testé par Vitest avec le reste du domaine) ; `app/scripts/build-edge-domain.mjs` copie ce dossier et les modules du domaine qu'il importe dans `supabase/functions/_shared/domain/`, en ajoutant les extensions `.ts` et en épinglant `uuid` (`npm:`). Un test unitaire échoue si la copie n'est plus à jour.
- **Lecture** : client supabase-js créé avec le jeton de l'utilisateur (`global.headers.Authorization`), requêtes PostgREST filtrées (`deleted_at is null`, plages de `started_at`). Les records et la tendance d'un exercice chargent les séances qui le contiennent (index GIN `exercise_ids`).

### 7.2 Écriture et synchronisation

- **Appareil virtuel** : `device_id = UUIDv5(user_id + ':' + client_id, NAMESPACE_MCP)`. Stable par connexion, distinct de tout téléphone, il départage les égalités du « dernier gagne » comme un appareil réel.
- **Horodatage** : `client_updated_at = max(now, existant + 1)`, comme `saveRow()` côté app.
- Chaque écriture appelle `sync_push(p_device_id, [{ table, row }])` avec le jeton de l'utilisateur. Statuts :
  - `accepted` → succès ;
  - `stale` → la ligne a été modifiée entre-temps : relire, réappliquer une fois, sinon erreur « modifiée sur un autre appareil, réessayer » ;
  - `rejected_not_owner` → erreur « séance en cours sur un appareil » ;
  - `forbidden` → erreur générique (ne devrait pas arriver).
- Les ids créés sont des UUID v7 (`ids.ts`). `exercise_ids` est recalculé à chaque écriture de séance.
- **Conflit connu** : une routine modifiée hors ligne sur le téléphone et en même temps par Claude suit la règle « la modification la plus récente l'emporte pour l'élément entier » (§F7.9). Accepté.

### 7.3 Nouvelles tables (migration)

```sql
-- Connexions MCP : droit d'écriture et révocation, par (compte, client OAuth)
mcp_connections(
  user_id uuid references auth.users on delete cascade,
  client_id text not null,
  client_name text,
  can_write boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  primary key (user_id, client_id)
)

-- Journal des écritures faites par Claude (restauration manuelle, transparence)
mcp_audit(
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  client_id text not null,
  tool text not null,
  sync_table text not null, row_id uuid not null,
  before jsonb, after jsonb,                -- ligne complète avant/après
  at timestamptz not null default now()
)
```

- RLS : `select` et `update (can_write, revoked_at)` sur `mcp_connections` si `user_id = auth.uid()` ; `select` seul sur `mcp_audit`. Insertions par RPC `security definer`.
- RPC : `upsert_mcp_connection(p_client_id, p_client_name, p_can_write)`, `revoke_mcp_connection(p_client_id)`. Le journal est écrit par une RPC `mcp_log(...)` appelée par l'Edge Function avec le jeton de l'utilisateur.
- Purge du journal après 90 jours (tâche `pg_cron` quotidienne).
- Non synchronisées : l'écran Paramètres › Claude les lit en ligne seulement.
- À la révocation, appeler aussi la révocation du grant côté Supabase Auth si l'API l'expose (à vérifier en L0) ; sinon le refus par `mcp_connections` suffit.

### 7.4 Erreurs

- Erreurs d'outil (`isError: true`) avec un message français actionnable ; jamais de trace technique.
- Erreurs de protocole et d'auth : codes HTTP standard (`401` uniquement pour l'auth, pour ne pas déclencher de réautorisation à tort).
- Journal technique : `console.error` (visible dans les logs Supabase), sans contenu de séance.

### 7.5 Limites

- Limite de débit par compte : 120 appels d'outil par minute (compteur en mémoire de l'instance, approximatif ; suffisant contre une boucle d'agent).
- Temps : moins de 1 s par appel visé ; Claude abandonne les endpoints OAuth au-delà de 10 s (ceux de Supabase Auth, hors de notre contrôle).

## 8. Confidentialité

- Les données lues par Claude quittent Supabase pour Anthropic, dans le cadre du compte Claude de l'utilisateur. Paramètres › Claude l'indique en une phrase avant la connexion.
- **Jamais** de photo, d'e-mail, de code d'invitation ni de champ `is_admin` dans une sortie d'outil.
- Les notes de séance sont renvoyées (elles sont utiles à l'analyse). Elles ne viennent que de l'utilisateur lui-même : le risque d'injection de consignes est limité à ses propres données.
- La suppression du compte (`delete-account`) supprime les connexions et le journal en cascade.

## 9. Côté app

| Élément | Contenu |
|---|---|
| Route `/oauth/consent` | §5.4. Lazy, publique, hors Dexie. |
| Paramètres › Claude | URL du connecteur + Copier ; mode d'emploi claude.ai / Claude Code ; phrase de confidentialité ; liste des connexions (`mcp_connections`) avec « Modifications autorisées » et « Déconnecter » ; lien « Voir les modifications de Claude » (30 dernières entrées de `mcp_audit` : date, outil, élément). Hors ligne : « Disponible en ligne uniquement ». |
| Budget JS | Les deux écrans en lazy : aucun impact sur le JS initial (§15). |

## 10. Tests

| Niveau | Contenu |
|---|---|
| Domaine (Vitest) | Inchangé : les outils réutilisent des fonctions déjà testées. Nouveaux tests pour les fonctions de mise en forme et de conversion des entrées d'outil (unités, résolution d'exercice par nom, validation par type de mesure). |
| Base (pgTAP) | `mcp_connections` et `mcp_audit` : isolation A/B ; `can_write` modifiable par le propriétaire seulement ; RPC refusées sans `auth.uid()`. |
| Edge Function (Deno test, Supabase local) | `401` + `WWW-Authenticate` sans jeton ; métadonnées de ressource ; jeton de session sans `client_id` refusé ; connexion révoquée refusée ; écriture refusée si `can_write = false` ; `log_workout` puis `sync_pull` côté client voit la séance ; `update_workout` sur une séance `in_progress` refusé ; `stale` géré. |
| Sync (Vitest, `npm run test:sync`) | Une routine écrite par l'appareil virtuel arrive dans Dexie au pull ; une modification locale plus récente dans l'outbox n'est pas écrasée. |
| E2E (Playwright) | Page de consentement : connexion, approbation, refus, avertissement boucle locale (avec un faux `authorization_id` servi par Supabase local). |
| Manuel | Connexion depuis claude.ai web, l'app Claude iOS et Claude Code sur le Supabase de staging ; 5 questions types et 3 écritures ; révocation. Avec MCP Inspector (`npx @modelcontextprotocol/inspector`) pour le protocole. |

## 11. Lots et risques

| Lot | Contenu | Livrable vérifiable |
|---|---|---|
| M0 Spike (fait) | OAuth server + DCR activés sur Supabase local ; Edge Function `mcp` avec un seul outil `get_profile` ; page de consentement minimale ; import du domaine depuis Deno ; tunnel (`jwt_issuer` réglé sur l'URL du tunnel) pour tester depuis claude.ai. | claude.ai et Claude Code se connectent et appellent `get_profile`. Les 4 points « à vérifier » ci-dessous sont tranchés. |
| M1 Lecture (fait) | Tous les outils du §6.2, `mcp_connections`, page de consentement complète, Paramètres › Claude (sans journal). | Les questions types obtiennent des chiffres identiques à ceux de l'app. |
| M2 Écriture (fait) | Outils du §6.3, `mcp_audit`, journal dans Paramètres, droit d'écriture. | Une routine créée par Claude apparaît sur l'iPhone en moins d'une minute. |
| M3 Prod | Clés asymétriques, activation en prod, `site_url` de prod, `DEPLOY.md`, contrat serveur mis à jour. | Connexion depuis l'iPhone réel. |

| Risque / point à vérifier en M0 | Parade |
|---|---|
| OAuth 2.1 de Supabase en **bêta** (comportement ou API susceptibles de changer) | Couche `auth.ts` mince ; suivi des notes de version. Repli : serveur OAuth minimal dans l'Edge Function (coûteux, à éviter). |
| URI de retour à port variable de Claude Code acceptée par la validation DCR de Supabase ? | Si refusée : claude.ai d'abord ; Claude Code via CIMD si Supabase l'annonce (`client_id_metadata_document_supported`), sinon documenter la limite. |
| Imports du domaine depuis Deno (extensions, fichiers hors `supabase/functions/`) | `sloppy-imports` ou script de copie au déploiement. |
| API de révocation des grants côté Supabase Auth | Sinon, révocation portée seule par `mcp_connections` (déjà suffisante). |
| DCR ouvert : n'importe quel client peut s'enregistrer | Le consentement explicite de l'utilisateur reste obligatoire ; le domaine de retour est affiché ; pas d'approbation automatique. |
| Démarrage à froid de l'Edge Function avec le SDK MCP | Mesurer en M0 ; basculer sur `mcp-lite` si besoin. |

**Constats du spike M0** (Supabase local, CLI 2.121, GoTrue 2.197) :

- OAuth 2.1 + DCR fonctionnent en local (`[auth.oauth_server]` de `config.toml`). Découverte servie à `/.well-known/oauth-authorization-server` et `/auth/v1/.well-known/openid-configuration` ; la variante à insertion de chemin (`/.well-known/oauth-authorization-server/auth/v1`) répond 404 en local (à revérifier en prod, Claude essaie les trois).
- Le jeton d'accès OAuth porte bien `client_id` (et `scope`), absent des jetons de session de l'app : le contrôle du §5.3 est fiable. La RLS s'applique au jeton OAuth sans changement.
- URI de retour en boucle locale : correspondance exacte du port. Claude Code enregistre son propre port à chaque DCR, donc pas de blocage.
- Révocation : `auth.oauth.listGrants()` / `revokeGrant({ clientId })` existent côté utilisateur ; un client déjà autorisé est réapprouvé sans consentement tant que le grant existe (d'où la révocation du grant au §C3).
- Démarrage à froid de `mcp` avec `@modelcontextprotocol/sdk` 1.32 : ~2 s en local, puis ~100 ms par appel d'outil. SDK officiel conservé.
- Le jeton n'est pas lié à la ressource (RFC 8707 : `aud` = `authenticated`) : tout jeton OAuth du projet est accepté par `mcp`. Sans conséquence tant que `mcp` est la seule ressource OAuth du projet.
- Reste à faire en M3 : essai réel depuis claude.ai et Claude Code (tunnel ou prod), clés asymétriques en prod.
| Projet Supabase Free mis en pause | Inchangé (ping tous les 3 jours) ; Claude reçoit une erreur de connexion pendant la pause. |

## 12. Décisions (tranchées le 23/10/2026 : recommandations retenues)

| # | Question | Recommandation |
|---|---|---|
| Q-M1 | Périmètre d'écriture en V1 : celui du §6.3, ou lecture seule d'abord ? | §6.3, livré en M2 après la lecture : les écritures demandées (routine, saisie a posteriori, mesure) sont le principal intérêt. |
| Q-M2 | Case « Autoriser les modifications » cochée par défaut à la connexion ? | Oui : l'utilisateur vient de demander la connexion lui-même, le client Claude confirme déjà chaque écriture, et tout est journalisé et réversible. |
| Q-M3 | Claude peut-il modifier ou supprimer des séances passées (`update_workout`, `delete_workout`) ? | Oui, avec `destructiveHint` ; la suppression est logique. |
| Q-M4 | Exercices personnalisés créables par Claude en V1 ? | Non : risque de doublons du catalogue ; `log_workout` renvoie une erreur avec les candidats proches et l'utilisateur crée l'exercice dans l'app. |
| Q-M5 | Annulation en un toucher depuis le journal (Paramètres › Claude) ? | Hors V1 : le journal garde `before`, la restauration manuelle reste possible ; à ajouter si le besoin apparaît. |
| Q-M6 | Ouvrir aussi aux autres clients MCP (ChatGPT, Cursor…) ? | Rien à faire de spécial : DCR + OAuth standard les rend compatibles. On ne teste et ne documente que Claude. |
