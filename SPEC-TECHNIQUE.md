# Spécification technique : application personnelle de suivi de musculation

> Complète [SPEC.md](SPEC.md) (fonctionnelle, v0.7) et [design/maquette.html](design/maquette.html). Les renvois « §F7.4 » pointent vers la spec fonctionnelle.
> Version 0.3, 21/10/2026. Nom : « Overload » (Q1 de la spec fonctionnelle).
> Changement 0.2 : objectifs de progression et tendance projetée (§F7.10). Les changements portent sur les §4, §5, §10.4, §10.7, §10.8, §14, §17, §18, §19 et §20.
> Changement 0.3 : nom de l'app. Suppression de la migration v1 → v2 des routines (aucune donnée v1 n'existera, les fourchettes sont présentes dès L4). Date de la séance de référence ajoutée à `computeTargets`. Raison `duration_up`. Test de la chaîne Web Push dès L0. Écarts du §20 reportés dans la spec fonctionnelle.

---

## 1. Principes directeurs

1. **Local d'abord.** L'appareil est la source de vérité pendant l'usage. Toute lecture et toute écriture passent par la base locale (IndexedDB). Le serveur ne sert qu'à synchroniser, authentifier et envoyer les notifications. C'est ce qui rend la séance 100 % hors ligne et l'écran de séance instantané.
2. **Calculs côté client.** Records, volume, « Précédent », objectifs, tendance, graphiques et statistiques sont des fonctions pures TypeScript exécutées sur les données locales. Le volume de données le permet (≈ 5 000 séries par an et par compte) et le résultat est identique en ligne et hors ligne.
3. **Un élément = un document.** Une séance (avec ses exercices et ses séries) ou une routine est stockée et synchronisée comme un seul enregistrement. La règle « la modification la plus récente l'emporte pour l'élément entier » (§F7.9) devient alors triviale.
4. **Gratuit.** Uniquement des offres gratuites, sans carte bancaire obligatoire.
5. **Isolation garantie par la base**, pas par le code applicatif : Row Level Security (RLS) PostgreSQL sur toutes les tables.

## 2. Choix techniques

| Besoin | Choix | Raison | Alternative écartée |
|---|---|---|---|
| Front | **React 19 + TypeScript + Vite** | Écosystème, outillage PWA mature, typage partagé front/serveur. | SvelteKit (plus léger, mais écosystème plus petit). |
| PWA / service worker | **vite-plugin-pwa** (Workbox, stratégie `injectManifest`) | SW personnalisé nécessaire pour les push. | SW écrit à la main. |
| Base locale | **Dexie 4** (IndexedDB) + `useLiveQuery` | Requêtes indexées, réactivité, transactions. | RxDB (plus lourd, licence premium pour certaines fonctions). |
| État UI | **Zustand** (état éphémère seulement) | Minimal. Les données métier vivent dans Dexie. | Redux. |
| Routage | **React Router 7** (mode bibliothèque) | Simple, suffisant. | TanStack Router. |
| Backend | **Supabase** (offre Free) : Postgres, Auth, Storage, Edge Functions, pg_cron, pg_net | Auth e-mail clé en main, RLS, stockage photos, tâches planifiées à la seconde, un seul fournisseur. | Cloudflare Workers + D1 + Durable Objects : alarmes précises, mais auth à écrire soi-même et hachage de mot de passe incompatible avec la limite CPU de 10 ms de l'offre gratuite. |
| Hébergement front | **Cloudflare Pages** | Gratuit, bande passante illimitée, HTTPS, déploiement par branche. | Vercel, Netlify. |
| E-mails (mot de passe oublié) | **Brevo** en SMTP personnalisé de Supabase | 300 e-mails/jour gratuits, expéditeur vérifiable sans nom de domaine. Le SMTP par défaut de Supabase n'envoie qu'aux membres de l'équipe du projet. | Resend (exige un domaine). |
| Notifications | **Web Push** (VAPID), envoyé par une Edge Function | Seule option sur iOS en PWA (≥ 16.4). | — |
| Graphiques | **uPlot** pour les courbes, **SVG maison** pour histogrammes et calendrier | ≈ 45 Ko, rapide sur mobile. | Recharts, Chart.js (plus lourds). |
| Glisser-déposer | **dnd-kit** | Support tactile, accessible. | react-beautiful-dnd (abandonné). |
| Identifiants | **UUID v7** générés côté client | Création hors ligne sans collision, tri chronologique. | Séquences serveur (impossibles hors ligne). |
| Tests | **Vitest**, **Playwright**, **pgTAP** | Unitaires, E2E (dont hors ligne), RLS. | — |
| Qualité | **Biome** (lint + format), `tsc --noEmit` strict | Un seul outil rapide. | ESLint + Prettier. |

**Limites de l'offre Supabase Free à surveiller** : 500 Mo de base, 1 Go de stockage, 5 Go de sortie/mois, 500 000 appels d'Edge Functions/mois, et **mise en pause après 7 jours sans activité**. Parade : une GitHub Action planifiée appelle une RPC `health()` tous les 3 jours (§16).

## 3. Architecture

```
┌──────────────────────── iPhone (PWA installée) ────────────────────────┐
│  UI React ──► repositories ──► Dexie (IndexedDB)  ◄── domaine (pur TS)  │
│                                   │  outbox                              │
│                         moteur de sync (push/pull)                       │
│  Service worker : cache de l'app, réception des push, affichage notif   │
└───────────────┬───────────────────────────────▲─────────────────────────┘
                │ HTTPS (supabase-js, JWT)       │ Web Push (APNs / FCM)
┌───────────────▼─────────────── Supabase ──────┴─────────────────────────┐
│ Auth (e-mail + mdp)   Postgres + RLS   Storage (photos, avatars)        │
│ RPC : sync_push, sync_pull, take_over_workout, regenerate_invite...     │
│ Edge Functions : signup-with-invite, send-push, delete-account          │
│ pg_cron (chaque seconde) ──► minuteurs échus ──► pg_net ──► send-push   │
└─────────────────────────────────────────────────────────────────────────┘
```

## 4. Organisation du dépôt

```
/app                        Application Vite
  /src
    /domain                 Fonctions pures, sans dépendance au navigateur (100 % testées)
      units.ts              conversions, arrondi d'affichage, parsing « 82,5 »
      measurement.ts        types de mesure, champs requis, colonnes
      volume.ts             volume d'une série / d'une séance
      records.ts            1RM, critères de record, badges, compteur
      previous.ts           « Précédent » : dernière fois + série équivalente
      routineDiff.ts        différence de structure séance/routine
      progression.ts        objectifs de la prochaine séance, équivalence charge ↔ reps, objectifs atteints
      progressionConfig.ts  constantes heuristiques du §F7.10 (seuils de reprise, plateau, plafonds), centralisées pour recalibrage (Q8)
      trend.ts              tendance linéaire-log, rythme actuel, date d'atteinte de l'objectif à long terme
      stats.ts              agrégats hebdo, muscles, calendrier, série de semaines
      dates.ts              jour d'appartenance, semaine lundi-dimanche
    /data
      db.ts                 schéma Dexie et migrations locales
      repositories/         lecture/écriture par entité (écrit aussi dans l'outbox)
      sync/                 moteur de synchronisation
      supabase.ts           client
    /features               un dossier par écran/parcours
      onboarding/ auth/ home/ workout-live/ workout-summary/ routines/
      library/ exercise/ history/ stats/ measurements/ profile/ settings/
    /ui                     composants génériques, tokens CSS (repris de la maquette)
    /sw                     service-worker.ts
  /tests/e2e                Playwright
/supabase
  /migrations               SQL versionné
  /functions                Edge Functions (Deno)
  /tests                    pgTAP (RLS, RPC)
  seed.sql                  catalogue d'exercices
/scripts
  build-catalog.ts          free-exercise-db → catalogue FR
  build-body-map.ts         MuscleMap → tracés de la carte musculaire
  create-admin.ts           création du premier compte
/design                     maquette
```

## 5. Modèle de données

### 5.1 Conventions communes

Chaque table synchronisée possède :

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` | UUID v7 généré par le client. |
| `user_id` | `uuid` | Propriétaire, `references auth.users on delete cascade`. |
| `client_updated_at` | `bigint` | Horodatage (ms) de la modification **sur l'appareil**. Base du « dernier gagne ». |
| `client_device_id` | `uuid` | Appareil auteur de la dernière modification. Départage les égalités. |
| `deleted_at` | `timestamptz null` | Suppression logique (tombstone), pour propager les suppressions. |
| `rev` | `bigint` | Révision serveur, attribuée par trigger, strictement croissante **par compte**. Curseur de synchronisation. |

Les valeurs saisies sont stockées **dans l'unité de saisie** (`{ v: 225, u: "lb" }`), jamais converties à l'écriture (§F7.8 : affichage exact, records sur valeurs exactes).

### 5.2 Tables Postgres

```sql
-- Profil et paramètres (1 ligne par compte, id = auth.uid())
profiles(
  id uuid pk references auth.users on delete cascade,
  display_name text not null,
  avatar_path text,
  is_admin boolean not null default false,      -- non modifiable par l'utilisateur (grant colonne)
  invite_code text unique not null,             -- 12 caractères base32 (60 bits)
  settings jsonb not null,                      -- voir Settings ci-dessous
  client_updated_at, client_device_id, rev
)

-- Catalogue (user_id null) et exercices personnalisés (user_id = propriétaire)
exercises(
  id uuid pk, user_id uuid null,
  name text not null, name_search text not null, -- minuscules, sans accents (calculé côté client et serveur)
  equipment text not null,                       -- enum applicatif (§F7.2)
  primary_muscle text not null, secondary_muscles text[] not null default '{}',
  measurement_type text not null,                -- weight_reps | bodyweight | weighted_bw | assisted_bw | duration | weight_duration | distance_duration
  instructions text,
  source_id text,                                -- id free-exercise-db pour le catalogue
  archived_at timestamptz,
  client_updated_at, client_device_id, deleted_at, rev
)

folders(id, user_id, name text, position int, collapsed boolean, client_updated_at, client_device_id, deleted_at, rev)

routines(id, user_id, folder_id uuid null, position int, doc jsonb,     -- RoutineDoc
         client_updated_at, client_device_id, deleted_at, rev)

workouts(
  id, user_id,
  status text not null,                          -- in_progress | completed
  owner_device_id uuid not null,                 -- appareil propriétaire tant que in_progress
  routine_id uuid null,
  started_at timestamptz not null,
  exercise_ids uuid[] not null,                  -- dénormalisé pour l'index « dernière fois »
  doc jsonb not null,                            -- WorkoutDoc
  client_updated_at, client_device_id, deleted_at, rev
)

body_measurements(id, user_id, measured_on date, values jsonb,          -- { weight:{v,u}, body_fat: 18.5, waist:{v,u}, ... }
                  client_updated_at, client_device_id, deleted_at, rev)

-- Réglages de progression par utilisateur et par exercice (catalogue ou personnalisé), §F7.10
exercise_prefs(
  id uuid pk,                                    -- UUID v5 de (user_id, exercise_id) : deux appareils hors ligne créent le même id, pas de doublon
  user_id, exercise_id uuid not null references exercises,
  doc jsonb not null,                            -- ExercisePrefsDoc
  client_updated_at, client_device_id, deleted_at, rev,
  unique (user_id, exercise_id)
)

-- Non synchronisées (gérées par RPC/Edge Functions)
push_subscriptions(id, user_id, device_id uuid unique, endpoint text, p256dh text, auth text, created_at)
rest_timers(device_id uuid pk, user_id, ends_at timestamptz, title text, body text, sent_at timestamptz null)
```

Index : `(user_id, rev)` sur chaque table synchronisée ; `workouts(user_id, started_at desc)` ; GIN sur `workouts.exercise_ids` ; `rest_timers(ends_at) where sent_at is null`.

### 5.3 Documents JSON (types partagés)

```ts
type Weight = { v: number; u: 'kg' | 'lb' };
type Distance = { v: number; u: 'km' | 'mi' };
type SetKind = 'normal' | 'warmup' | 'drop' | 'failure';

type RepRange = { min: number; max: number };   // min ≤ max ; 8–8 = nombre fixe

// Objectif figé au démarrage de la séance (§F7.10) ; absent = pas d'objectif (premier essai, type sans objectif, objectifs désactivés)
type SetTarget = { weight?: Weight; reps?: number; durationS?: number };
type TargetReason =
  | { kind: 'comeback'; weeksOff: number }
  | { kind: 'plateau' }
  | { kind: 'load_up'; reachedReps: number; rpe?: number }   // rpe : effort facile (≤ 7), double incrément
  | { kind: 'consolidate'; rpe?: number }                   // rpe : maximum atteint à RPE 10, confirmé une fois
  | { kind: 'reps_up'; step?: number; rpe?: number }        // step : 2 si effort facile
  | { kind: 'mixed'; rpe?: number }                         // cas différents selon les séries
  | { kind: 'duration_up' };          // type durée (+5 %)

type WorkoutSet = {
  id: string;
  kind: SetKind;
  weight?: Weight;        // charge, kg ajoutés ou kg d'assistance selon le type de mesure
  reps?: number;
  durationS?: number;
  distance?: Distance;
  done: boolean;
  doneAt?: number;        // ms, ordre de validation
  target?: SetTarget;     // séries de travail uniquement
  rpe?: number;           // effort ressenti, 6 à 10 par demi-point (facultatif)
};

type WorkoutExercise = {
  id: string;
  exerciseId: string;
  measurementType: MeasurementType;   // copie figée : l'historique reste lisible quoi qu'il arrive à l'exercice
  note?: string;
  restS: number | null;               // null = minuteur « Off »
  repRange?: RepRange;                // fourchette en vigueur pour cette séance (copie figée)
  targetReason?: TargetReason;
  sets: WorkoutSet[];
};

type WorkoutDoc = {
  title: string;
  note?: string;
  photoPath?: string;                 // 1 photo en V1 (Q2)
  durationS?: number;                 // fixée à la fin ou en saisie a posteriori
  exercises: WorkoutExercise[];
};

type RoutineDoc = {
  name: string;
  note?: string;
  exercises: { id: string; exerciseId: string; restS: number | null; note?: string;
               repRange?: RepRange;                       // types avec reps uniquement (§F7.3)
               sets: Omit<WorkoutSet, 'done' | 'doneAt' | 'target' | 'reps' | 'rpe'>[] }[];   // les reps cibles sont la fourchette
};

type ExercisePrefsDoc = {
  increment?: Weight;                 // absent = défaut selon l'équipement et l'unité (§F7.10)
  defaultRepRange?: RepRange;
  longTermGoal?: { weight: Weight; reps: number; setAt: number };   // reps 1..12
};

type Settings = {
  units: { weight: 'kg' | 'lb'; length: 'cm' | 'in'; distance: 'km' | 'mi' };
  defaultRestS: number | null;        // 90 par défaut, null = Off
  timerSound: boolean; keepAwake: boolean;
  theme: 'dark' | 'light' | 'auto';   // dark par défaut
  restNotification: boolean;
  profileChart: 'duration' | 'volume' | 'count';
  progressionEnabled: boolean;        // true par défaut
  rpeEnabled: boolean;                // saisie du RPE, false par défaut
  trainingAge?: { bucket: 'none' | 'lt6m' | '6to12m' | '1to2y' | '2to5y' | 'gt5y'; declaredAt: number };   // absent = non renseignée
};
```

Les documents portent un champ `schemaVersion` (1 à la création) ; une fonction `migrateDoc()` côté client mettra à niveau les anciens documents à la lecture lors des évolutions futures. Aucune migration n'existe au départ : les `RoutineDoc` sont créés avec `repRange` dès le lot L4.

`trainingAge` est stocké comme une **tranche plus une date de déclaration**, et non comme une date de début. Le début de l'entraînement vaut `declaredAt − durée(tranche)`. Il reste donc juste si l'utilisateur modifie sa tranche plus tard.

### 5.4 Base locale (Dexie)

```ts
db.version(1).stores({
  exercises:    'id, user_id, name_search, primary_muscle, equipment',
  folders:      'id, position',
  routines:     'id, folder_id, position',
  workouts:     'id, started_at, status, *exercise_ids, [routine_id+started_at]',
  measurements: 'id, measured_on',
  exercisePrefs: 'id, &exercise_id',
  outbox:       '++seq, [table+row_id]',   // une entrée par élément modifié (dédoublonnée)
  blobs:        'path',                    // photos en attente d'envoi
  meta:         'key',                     // curseurs de sync, device_id, session, état du minuteur
});
```

Au premier lancement, l'app appelle `navigator.storage.persist()`. Une PWA ajoutée à l'écran d'accueil iOS n'est pas soumise à l'effacement des données après 7 jours d'inactivité.

## 6. Synchronisation

### 6.1 Écriture locale
Toute modification passe par un repository qui, **dans une même transaction Dexie** :
1. écrit l'élément complet avec `client_updated_at = Date.now()` et `client_device_id` ;
2. ajoute ou met à jour l'entrée `outbox` de cet élément.

### 6.2 Push
- Déclenché 2 s après la dernière écriture (anti-rebond), au retour du réseau (`online`), au passage au premier plan (`visibilitychange`) et à la fin d'une séance.
- Envoie les éléments de l'outbox par lots de 100 à la RPC `sync_push(device_id, changes jsonb)`.
- Côté serveur, pour chaque élément, `insert ... on conflict (id) do update ... where` **l'entrée est plus récente** (`client_updated_at` supérieur, ou égal et `client_device_id` supérieur). Sinon l'élément est ignoré (le serveur a déjà plus récent).
- **Règle séance en cours** : une écriture sur un `workout` dont le serveur a `status = 'in_progress'` et `owner_device_id ≠ device_id` est **refusée**, quel que soit l'horodatage (appareil dépossédé, §F7.9).
- La RPC renvoie, par élément : `accepted`, `stale` ou `rejected_not_owner`. Les entrées `accepted` et `stale` sortent de l'outbox ; `rejected_not_owner` déclenche le passage en lecture seule de la séance.
- La RPC prend un verrou `pg_advisory_xact_lock(hash(user_id))` : les `rev` d'un compte sont attribués dans l'ordre de validation des transactions. Un pull par curseur ne peut donc jamais manquer une ligne.

### 6.3 Pull
- RPC `sync_pull(cursors jsonb)` : renvoie pour chaque table les lignes `rev > curseur` (lignes du compte, plus les exercices du catalogue), par pages de 500.
- Déclenché au démarrage, au retour au premier plan, au retour du réseau, après chaque push, et **toutes les 30 s** quand l'app est visible. Cela tient l'objectif « visible sur l'autre appareil en moins d'une minute » sans Realtime.
- Application locale : une ligne reçue remplace la ligne locale **sauf** si l'élément a une entrée dans l'outbox avec un `client_updated_at` plus récent (modification locale pas encore poussée). À horodatage égal, même départage que le serveur : la ligne reçue ne s'applique que si son `client_device_id` est supérieur à celui de cet appareil.
- Le catalogue a son propre curseur (`rev` global sous verrou `catalog`), car il n'appartient à aucun compte.

### 6.4 Séance en cours sur plusieurs appareils
- Démarrer une séance : création locale `status = in_progress`, `owner_device_id = cet appareil`. Le blocage « une seule séance en cours » est vérifié **localement**, sur les données synchronisées. Hors ligne, deux séances peuvent coexister ; elles sont conservées toutes les deux, comme le prévoit la spec.
- Bandeau « Séance en cours sur un autre appareil » : affiché quand Dexie contient une séance `in_progress` dont `owner_device_id ≠ cet appareil`.
- « Reprendre ici » : RPC `take_over_workout(id, device_id)`, qui met à jour `owner_device_id` sous verrou. L'appareil dépossédé l'apprend au prochain pull ou push et passe la séance en lecture seule. Ses modifications non poussées sont jetées.
- Le minuteur de repos n'est pas transféré.

### 6.5 Indicateur de synchronisation
Pastille discrète dans l'en-tête : rien si l'outbox est vide ; « n en attente » sinon ; « hors ligne » si `navigator.onLine` est faux ou si le dernier appel a échoué.

### 6.6 Session expirée hors ligne
Le JWT Supabase expire au bout d'1 h. Hors ligne, l'app continue de fonctionner sur les données locales ; la sync reprend après rafraîchissement du jeton. Si le jeton de rafraîchissement est révoqué (changement de mot de passe), l'app demande de se reconnecter **sans purger** la base locale ni l'outbox.

## 7. Authentification, invitations, isolation

### 7.1 Inscription sur invitation
- Les inscriptions publiques sont **désactivées** dans Supabase Auth.
- Lien d'invitation : `https://<app>/i/<code>`. La page explique l'installation en 3 étapes et affiche le code en gros (format `RX7K-2P9Q-D4MA`) avec un bouton « Copier ».
- **Contrainte iOS** : la PWA installée ne partage ni ses cookies ni son stockage avec Safari. Le code ne peut donc pas être transmis par le stockage. Deux mécanismes :
  1. la page d'invitation injecte un manifeste dont `start_url = /signup?code=<code>`. La PWA s'ouvre alors directement sur le formulaire pré-rempli ;
  2. en secours, le formulaire d'inscription a un champ « Code d'invitation » qui accepte le collage.
- L'inscription appelle l'Edge Function `signup-with-invite` : elle vérifie le code, crée l'utilisateur via l'API admin (e-mail confirmé d'office), crée son profil avec un nouveau code, puis le client ouvre la session. Limite : 5 tentatives par IP et par heure.
- `regenerate_invite()` (RPC) remplace le code du compte appelant.
- **Premier compte** : `scripts/create-admin.ts` (clé service, exécuté une fois en local) crée le compte avec `is_admin = true`.

### 7.2 Mot de passe oublié
Le lien de réinitialisation s'ouvre dans Safari, pas dans la PWA. La page `/reset` (web) permet de choisir un nouveau mot de passe, puis invite à revenir dans l'app installée pour se connecter.

### 7.3 Row Level Security
- Tables synchronisées : `select/insert/update` autorisés si `user_id = auth.uid()`. Pas de `delete` (suppression logique), sauf via `delete-account`.
- `exercises` : lecture si `user_id is null or user_id = auth.uid()`. Écriture du catalogue (`user_id is null`) si le profil appelant a `is_admin`. L'admin n'a **aucune** politique de contournement sur les autres tables.
- `profiles.is_admin` et `invite_code` : `revoke update` au niveau colonne pour le rôle `authenticated`.
- Storage, bucket privé `photos` : chemin `<user_id>/<objet>`, politique `(storage.foldername(name))[1] = auth.uid()::text`.
- La clé `service_role` n'existe que dans les secrets des Edge Functions.
- Tests pgTAP : un compte A ne peut ni lire ni écrire une ligne de B, admin compris (§13).

## 8. Minuteur de repos et notifications

### 8.1 Minuteur (client)
- État stocké dans `meta` (local, non synchronisé) : `{ workoutId, exerciseEntryId, setId, endsAt }`. Affichage = `endsAt − Date.now()`, recalculé à chaque image (`requestAnimationFrame`) et au retour au premier plan. Le minuteur est donc juste après une mise en arrière-plan.
- Même principe pour la durée de séance : `Date.now() − started_at`.
- ±15 s modifie `endsAt` ; « Passer » efface l'état.
- Fin, app ouverte : son via Web Audio (contexte débloqué par le toucher de validation).

### 8.2 Notification de fin de repos (serveur)
1. À la validation d'une série (et à chaque ±15 s), si les notifications sont activées et le réseau disponible : RPC `schedule_rest_timer(device_id, ends_at, title, body)` (upsert sur `device_id`). « Passer » ou une nouvelle validation remplace ou supprime la ligne.
2. `pg_cron` exécute **chaque seconde** `dispatch_due_timers()` : une requête indexée sur `rest_timers` échus et non envoyés. S'il y en a, elle les marque `sent_at = now()` et appelle `send-push` via `pg_net` (en-tête secret partagé). Coût : un appel d'Edge Function par notification réelle, pas par seconde.
3. `send-push` (Deno, bibliothèque `@negrel/webpush`) signe en VAPID et envoie à l'abonnement de **cet appareil** uniquement. Si le service push répond 404 ou 410, l'abonnement est supprimé.
4. Le service worker affiche la notification (`tag = 'rest'`, qui remplace la précédente). iOS exige d'afficher toute notification reçue, y compris quand l'app est ouverte.
- Précision attendue : 1 à 2 s.
- Hors ligne : pas de planification ; seul le minuteur local prévient (comportement prévu par la spec).

### 8.3 Abonnement
Demandé depuis un geste utilisateur (onboarding ou paramètres), uniquement en mode standalone sur iOS. L'abonnement est enregistré par `device_id` et renouvelé à chaque démarrage si l'endpoint a changé.

## 9. PWA, service worker, mises à jour

- `manifest.webmanifest` : `display: standalone`, `orientation: portrait`, `theme_color` et `background_color` du thème sombre, icônes 192/512 et maskable, plus `apple-touch-icon` et écrans de démarrage iOS.
- Précache Workbox de toute l'app (HTML, JS, CSS, polices, icônes). Navigation hors ligne vers `index.html`.
- Photos : cache `CacheFirst` indexé par **chemin de stockage**, pas par URL signée, car les URL signées changent.
- Appels Supabase : jamais mis en cache par le SW. Le hors ligne est géré par Dexie.
- Mise à jour : `registerType: 'prompt'`. Un toast « Nouvelle version » s'affiche, mais **jamais pendant une séance en cours** ; l'activation attend la fin de la séance ou le prochain lancement.
- Écran allumé : Screen Wake Lock API pendant une séance si l'option est active. Le verrou est redemandé au retour au premier plan, car il est perdu à chaque mise en arrière-plan. Disponible en PWA installée sur iOS depuis la 18.4 (appareil cible : iOS 27).
- Détection du mode : `matchMedia('(display-mode: standalone)')` ou `navigator.standalone`. Hors standalone sur iOS, l'app affiche la page d'installation.

## 10. Règles métier (module `domain`)

Toutes les fonctions sont pures, reçoivent des données déjà chargées et sont couvertes par des tests unitaires tirés des exemples de la spec.

### 10.1 Unités (`units.ts`)
- `toKg(w)` : `lb × 0.45359237`, sans arrondi. `toKm(d)` : `mi × 1.609344`.
- `display(value, unitSaisie, unitAffichage)` : valeur brute si les unités sont identiques ; sinon conversion, arrondi au dixième, sans zéro inutile, virgule décimale (`Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })`). Exemples testés : 100 kg → « 220,5 lb » ; 225 lb → « 102,1 kg ».
- `parseDecimal("82,5" | "82.5")`. Les champs utilisent `inputmode="decimal"` (poids, distance) ou `inputmode="numeric"` (reps).
- Durée : saisie `m:ss` ou `h:mm:ss`, stockage en secondes entières.

### 10.2 Volume (`volume.ts`)
`setVolume` : `kg(weight) × reps` pour `weight_reps` et `weighted_bw`, 0 sinon. Seules les séries validées non échauffement comptent. Le volume est calculé en kg puis affiché dans l'unité de l'utilisateur.

### 10.3 Records (`records.ts`)
- `e1rm(kg, reps)` : `reps = 1 → kg` ; `2 ≤ reps ≤ 12 → kg × (1 + reps/30)` (Epley) ; sinon `undefined`.
- Critères par type de mesure : table §F7.6, codée en dur (`criteriaFor(type)`). Chaque critère est une fonction `série → number | undefined`, avec un sens (`max`, ou `min` pour l'assistance et l'allure). « Poids à N reps » : `reps ≥ N ? kg : undefined`, pour N ∈ {1, 3, 5, 8, 10, 12}.
- Le critère « plus de reps sur une séance » (poids du corps) est un critère **de séance** : son badge s'affiche sur l'en-tête de l'exercice, pas sur une série.
- `computeBadges(exerciseId, workoutsTriés)` : parcourt les séances par `(started_at, id)` croissants, puis les séries validées non échauffement dans l'ordre d'affichage. Pour chaque critère, la valeur est comparée au meilleur courant ; si elle est **strictement** meilleure **et** qu'au moins une séance antérieure contient l'exercice, la série reçoit le badge. Le meilleur courant est mis à jour dans tous les cas.
- Comparaisons sur valeurs converties sans arrondi : un arrondi d'affichage ne crée jamais de faux record.
- Compteur « records » d'une séance : nombre de couples distincts `(exercice, critère)` ayant au moins un badge.
- **Recalcul** : les badges ne sont jamais stockés. Ils sont dérivés et mis en cache en mémoire par exercice, cache invalidé quand une séance contenant l'exercice change (création, modification, déplacement de date, suppression). Modifier une séance passée corrige donc automatiquement toutes les suivantes, sans notification.
- En séance : même fonction, appliquée à l'historique plus la séance en cours. Le badge 🏆 apparaît dès la validation.

### 10.4 « Précédent » (`previous.ts`)
- `lastTime(exerciseId, routineId, avant)` : la séance terminée la plus récente avec ce `routine_id` et contenant l'exercice (index `[routine_id+started_at]` puis filtre `exercise_ids`) ; à défaut, la plus récente contenant l'exercice (index multi-valeurs `exercise_ids`).
- `equivalentSet(setsAujourdhui, index, setsAvant)` : rang de la série parmi celles **de même type**, puis série de même type et de même rang la dernière fois, sinon « — ».
- Pré-remplissage : `target` (§10.7), sinon valeurs de la routine, sinon « Précédent ». Cocher avec un champ obligatoire vide copie « Précédent » s'il existe, sinon la coche est refusée et le champ est mis en évidence.

### 10.5 Différence avec la routine (`routineDiff.ts`)
Signature de structure, par exercice dans l'ordre : `exerciseId`, `restS`, liste des `kind` des séries (séries **validées** côté séance, séries cibles côté routine). Toute différence de signature déclenche la proposition de mise à jour. La fonction renvoie aussi un résumé lisible : « +1 exercice : Dips », « Squat : 4 → 5 séries », « Repos développé couché : 90 s → 120 s ». Les poids, les répétitions et `repRange` sont exclus de la signature. La mise à jour de la routine conserve `repRange` (§F P2.8).

### 10.6 Dates et statistiques (`dates.ts`, `stats.ts`)
- Jour d'une séance : date locale de `started_at` dans le fuseau **courant** de l'appareil. Semaine ISO (lundi-dimanche).
- Série de semaines : semaines consécutives avec au moins une séance, en partant de la semaine précédente ; la semaine en cours s'ajoute si elle contient une séance.
- Répartition musculaire : +1 pour le muscle principal et +0,5 par muscle secondaire, par série validée non échauffement.
- Agrégats calculés à la demande avec mémoïsation. Si la mesure dépasse 50 ms sur iPhone, les calculs passent dans un Web Worker (Comlink).

### 10.7 Objectifs (`progression.ts`)
**Quand.** `computeTargets()` est appelée une seule fois, à la **création** de la séance (depuis une routine ou vide), puis à chaque **ajout d'exercice** pendant la séance. Le résultat est écrit dans le `WorkoutDoc` : `target` des séries de travail, plus `repRange` et `targetReason` de l'exercice. Il n'est jamais recalculé ensuite. Une synchronisation reçue en pleine séance ne change donc pas les champs, et l'historique sait ce qui était visé. La saisie a posteriori ne calcule pas d'objectif.

**Signature.**
```ts
// Cette méthode permet de calculer l'objectif d'un exercice lorsqu'une séance démarre ou qu'un exercice y est ajouté.
// Elle choisit le cas du §F7.10 (reprise, plateau, montée, consolidation, +1 rep) à partir des séances antérieures triées.
computeTargets(input: {
  exercise: Exercise; prefs?: ExercisePrefsDoc; settings: Settings;
  repRange: RepRange | undefined;          // résolue par resolveRepRange()
  plannedSets: { kind: SetKind }[];        // séries prévues (routine) ou série par défaut
  history: CompletedWorkout[];             // séances terminées contenant l'exercice, started_at croissant
  reference: {                             // « la dernière fois » (§10.4 lastTime)
    exercise: WorkoutExercise;             // l'exercice dans la séance de référence
    startedAt: number;                     // ms, started_at de cette séance (cas « reprise »)
  } | undefined;
  now: number;
}): { sets: (SetTarget | undefined)[]; reason?: TargetReason } | undefined
```
- `undefined` si `settings.progressionEnabled` est faux, si aucune séance antérieure n'existe (premier essai) ou si le type de mesure est `weight_duration` ou `distance_duration`.
- `resolveRepRange()` prend, dans l'ordre : la `repRange` de l'exercice dans la routine, puis `prefs.defaultRepRange`, puis la `repRange` de la dernière routine qui contient l'exercice, puis `{ min: 8, max: 12 }`.
- `incrementFor(exercise, prefs, unit)` renvoie `prefs.increment` s'il existe, sinon le défaut du tableau §F7.10 selon l'équipement et l'unité de poids de l'utilisateur.
- Correspondance des séries : une série prévue de type normal ou échec prend la série de travail de même rang dans `reference`, comme `equivalentSet` mais en confondant normal et échec. S'il y a plus de séries prévues que de séries de référence, les séries en trop reprennent la dernière série de référence.

**Arbre de décision** (weight_reps ; les autres types appliquent les variantes du §F7.10) :
1. `weeksOff = (now − reference.startedAt) / 7 j`. Si `weeksOff > 4` : cas `comeback`. On réduit la charge selon `COMEBACK_STEPS = [[4, .05], [8, .10], [12, .15], [16, .20]]` (la dernière tranche franchie s'applique), on arrondit avec `floorTo(increment)` et on garde les reps de référence.
2. Les « séances à cette charge » sont les dernières séances consécutives de `history` dont les charges de travail sont identiques à celles de la référence, comparées sur les valeurs exactes en kg. On est en `plateau` si les 2 dernières ont chacune au moins une série sous `min`, ou si parmi les 3 dernières le total de reps des 2 plus récentes ne dépasse pas celui de la plus ancienne. On applique alors une charge × `(1 − PLATEAU_DROP)`, avec `PLATEAU_DROP = 0.10`, arrondie avec `floorTo(increment)`, et reps = `min`.
3. Sinon, chaque série prévue choisit son cas d'après sa série de référence (même rang) :
   - reps ≥ `max` : `load_up`. La charge vaut W + i et les reps valent `equivalentReps(W, max, W + i)`, bornées à `[min, max]` (assisté : assistance − i, reps = `min`) ;
   - reps < `min` : `consolidate`. On reprend le `target` de cette série de référence, sinon ses valeurs réalisées ;
   - sinon : `reps_up`. Même charge, et reps = `clamp(r + 1, min, max)`.
4. Raison : le cas commun s'il est unique (`load_up`, `consolidate` ou `reps_up`), sinon `mixed`.

**Équivalence charge ↔ reps (Marzagao 2026).** Ces fonctions servent uniquement aux objectifs. `e1rm()` (Epley, §10.3) reste la seule formule du 1RM affiché.
```ts
// Cette méthode permet d'obtenir le coefficient de conversion de Marzagao pour une charge en kg.
k = (wKg: number) => Math.max(0.5, -2.55 + 4.58 * Math.log(wKg));

// Cette méthode permet de calculer le nombre de reps à la charge w2 équivalent à w1 × r1, lorsque la charge monte d'un incrément.
// Les charges sont converties en kg avant le calcul ; le résultat est arrondi à l'inférieur (borné ensuite par l'appelant).
equivalentReps(w1: Weight, r1: number, w2: Weight): number {
  const a = toKg(w1), b = toKg(w2);
  const m = a * (1 + (r1 - 1) ** 0.85 / k(a));
  const x = k(b) * (m / b - 1);
  return x <= 0 ? 1 : Math.floor(1 + x ** (1 / 0.85));
}
```
Si `max > 30`, on retient `min` sans appeler `equivalentReps` (domaine d'ajustement de la formule : 1 à 30 reps). Les types `weighted_bw` et `assisted_bw` n'appellent jamais cette fonction : le poids de corps n'est pas connu.

**Arrondis et unités.**
- Les objectifs de charge s'expriment dans l'unité de poids **actuelle** de l'utilisateur. La référence est convertie sans arrondi, puis `floorTo(increment)` (multiple inférieur) s'applique pour les baisses, et `W + i` sans arrondi pour les hausses. Une référence saisie à 81 kg donne donc 83,5 kg.
- Pour la durée : `ceilTo5(d × 1.05)`, avec au moins `d + 5`. Raison `duration_up`.

**Objectifs atteints.** `targetsMet(we: WorkoutExercise)` renvoie `undefined` si aucune série n'a de `target`, sinon `true` si chaque série de travail qui a un `target` est validée avec une charge ≥ cible (≤ pour l'assistance) et des reps ou une durée ≥ cible. Une série avec objectif supprimée ou non validée compte comme non atteinte. Le compteur « n / m » du récapitulatif et de l'historique est dérivé à la lecture.

**Constantes.** Tous les seuils heuristiques (`COMEBACK_STEPS`, `PLATEAU_DROP`, la règle des 2 et 3 séances, `DURATION_STEP = 0.05`, `TREND_MAX_MONTHLY = 0.04`, les incréments par défaut) sont dans `progressionConfig.ts`. Le recalibrage prévu par la Q8 se fait donc sans toucher à la logique.

### 10.8 Tendance et objectif à long terme (`trend.ts`)
```ts
// Cette méthode permet d'ajuster la tendance linéaire-log du 1RM estimé lorsque l'historique d'un exercice est suffisant.
// Elle renvoie undefined si les conditions d'affichage du §F7.10 ne sont pas réunies.
fitTrend(points: { weekStart: number; e1rmKg: number }[], origin: number, now: number): Trend | undefined
type Trend = { a: number; b: number; origin: number; status: 'up' | 'flat' };
```
- **Points** : pour chaque semaine ISO, le maximum de `e1rm()` (Epley) des séries de travail validées de 12 reps au plus. Sont exclus les échauffements, les séries dégressives et la séance en cours.
- **Origine** (`trainingOrigin(settings, firstSessionAt)`) : `declaredAt − durée(bucket)`, avec `none = 0`, `lt6m = 3 mois`, `6to12m = 9 mois`, `1to2y = 18 mois`, `2to5y = 42 mois` et `gt5y = 72 mois`. Le résultat est borné à `firstSessionAt` au plus tard. Si l'ancienneté est absente, l'origine vaut `firstSessionAt`.
- t = (weekStart − origin) / 7 j + 1, puis x = ln(t). Les moindres carrés ordinaires donnent `b = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)²` et `a = ȳ − b x̄`, en forme fermée, sans bibliothèque.
- Conditions : au moins 6 points, sur une étendue d'au moins 8 semaines. Si b ≤ 0, `status = 'flat'` et aucune courbe n'est tracée.
- **Projection** : `project(trend, at)` vaut `min(a + b ln(t_at), y_now × (1 + TREND_MAX_MONTHLY × moisÉcoulés))`, où `y_now = a + b ln(t_now)`. Elle est tracée à t_now + 4 et t_now + 12 semaines, en série uPlot pointillée.
- **Rythme actuel** : `b / t_now` (kg par semaine) × 30,44 / 7, affiché dans l'unité de l'utilisateur.
- **Date d'atteinte** : `goalE1rm = e1rm(goal.weight, goal.reps)`, puis `t* = exp((goalE1rm − a) / b)`. On renvoie `undefined` (« Plus d'un an au rythme actuel ») si `status = 'flat'`, si t* − t_now > 52 semaines, ou si la projection plafonnée n'atteint pas l'objectif dans l'année. La date est affichée au mois près.
- **Objectif atteint** : une série de travail validée avec charge ≥ `goal.weight` et reps ≥ `goal.reps`, comparées en kg exacts. Le badge 🎯 est dérivé à la lecture comme les records (§10.3) : seule la **première** série qui l'atteint après `goal.setAt` le reçoit.
- Calcul mémoïsé par exercice, invalidé avec le cache des records.

## 11. Points techniques par écran

| Écran | Notes |
|---|---|
| Séance en direct | Écriture Dexie à **chaque** modification (aucune perte si l'app est tuée). Composants mémoïsés par série. Swipe pour supprimer : gestionnaire de pointeurs maison (seuil 80 px). Réordonner : dnd-kit avec poignée. Chronomètre isolé dans son propre composant pour ne pas re-rendre la liste. |
| Bandeau « Séance en cours » | Composant global au-dessus de la barre d'onglets, piloté par `useLiveQuery(workouts.where('status').equals('in_progress'))`. |
| Récapitulatif | Durée proposée = maintenant − début ; si > 4 h, un champ de correction apparaît en premier. Photo compressée avant stockage (§12). |
| Bibliothèque | Recherche locale sur `name_search` (normalisation NFD, suppression des diacritiques, minuscules) ; filtres combinés ; tri « récents » via la date de dernière utilisation calculée depuis `workouts`. |
| Historique | Liste virtualisée (`@tanstack/react-virtual`), pages de 20 séances lues dans Dexie par `started_at` décroissant. |
| Fiche exercice / stats | Chargées en *lazy* (`React.lazy`) : uPlot ne pèse pas sur le premier chargement. Tendance : deuxième série uPlot en pointillés (`dash`), sans point. Les réglages de progression (incrément, fourchette, objectif à long terme) écrivent dans `exercise_prefs`. |
| Objectif en séance | Ligne de raison sous le nom de l'exercice, générée par `formatReason(reason, units)`. Les champs pré-remplis par `target` gardent le style « pré-rempli » tant qu'ils ne sont pas modifiés. Un champ modifié est marqué `dirty` et n'est jamais réécrit. La flèche ↑ / ↓ / = vient de `reason.kind`. |
| Routine (édition) | Les reps se saisissent sous forme de fourchette (« 8–12 », ou « 8 » pour une fourchette fixe), une fois par exercice et non par série. |
| Saisie a posteriori | Même éditeur que la séance en direct en mode `completed`, sans minuteur, avec date, heure et durée. |

Thème et tokens : variables CSS reprises de la maquette (`--bg`, `--surface`, `--accent`, `--done`, `--warm`, `--drop`, `--fail`, `--gold`…), thème piloté par `data-theme` sur `<html>`. Les tailles de texte sont en `rem` pour suivre la taille de texte agrandie d'iOS. Zones tactiles d'au moins 44 × 44 px.

## 12. Photos

- Compression côté client avant stockage : côté long 1600 px max, JPEG qualité 0,8 (≈ 200-300 Ko), via `createImageBitmap` + `OffscreenCanvas` ; données EXIF supprimées.
- Hors ligne : le blob est mis dans `blobs` et le document référence déjà `photoPath = <user_id>/<workout_id>.jpg`. L'envoi vers Storage se fait avant le push du document.
- Affichage : URL signée (1 h) mise en cache par chemin dans le SW.
- Avatars : même circuit, 512 px.
- Budget : 1 Go ≈ 4 000 photos ; un compteur de stockage est visible par l'admin dans le tableau de bord Supabase.

## 13. Catalogue d'exercices

`scripts/build-catalog.ts` :
1. télécharge `free-exercise-db` (version figée par commit) ;
2. filtre une liste blanche d'identifiants (≈ 200 exercices courants), maintenue dans `scripts/catalog-allowlist.json` ;
3. applique les correspondances muscles et équipements vers les listes §F7.2, et déduit le type de mesure (règles, puis surcharge manuelle) ;
4. fusionne avec `scripts/catalog-fr.json` : noms et consignes **réécrits en français**. Première passe assistée par LLM, puis relecture humaine. Le fichier versionné fait foi ;
5. ajoute les exercices courants absents de la source, rédigés en entier dans `scripts/catalog-extra.json` (`source_id` préfixé `overload:`, ex. tractions et dips assistés à la machine) ;
6. génère `supabase/seed.sql` avec des UUID v5 stables dérivés de `source_id` (ré-exécution idempotente).

Les images de la source ne sont pas reprises : chaque exercice est illustré par une carte musculaire générée à partir de ses muscles. `scripts/build-body-map.ts` (`npm run body-map`) convertit les tracés MuscleMap (source Swift, MIT, version figée par commit) en `app/src/data/bodyMap.generated.ts`, sans les sous-groupes ; `domain/bodyMap.ts` associe chaque muscle de l'app à ses zones, et `ui/BodyMap.tsx` dessine la miniature et la carte de la fiche (chunk lazy, hors JS initial). Les modifications ultérieures du catalogue se font par l'admin dans l'app. Le **type de mesure d'un exercice du catalogue est non modifiable** : l'admin ne voit pas les données des autres et ne peut donc pas savoir s'il est utilisé. Pour changer de type, il faut créer un nouvel exercice et archiver l'ancien. L'historique reste lisible grâce à la copie de `measurementType` dans chaque séance.

## 14. Export et suppression de compte

- **Export** : forcer un push puis un pull complets, puis générer côté client :
  - `overload-export-AAAA-MM-JJ.json` : profil, paramètres, séances, routines, dossiers, exercices personnalisés, réglages de progression (`exercise_prefs`), mesures (documents bruts plus `schemaVersion`) ;
  - `overload-seances-AAAA-MM-JJ.csv` : une ligne par série (date, titre, exercice, type de série, poids, unité, reps, durée, distance, poids visé, reps visées, durée visée, note), séparateur `;`, encodage UTF-8 avec BOM (ouverture correcte dans Excel FR).
  - Partage via `navigator.share({ files })` sur iOS, téléchargement ailleurs.
- **Import HEVY** (Paramètres › Compte, `features/settings/importHevy.ts`, domaine pur `domain/hevy.ts`) : lecture côté client de `workout_data.csv` et `measurement_data.csv`, reconnus par leur en-tête ; dates FR/EN lues en heure locale.
  - Séances : id UUID v5 de (`user_id`, début local `AAAA-MM-JJTHH:mm`, titre), donc réimport idempotent ; une séance déjà présente (même supprimée) est ignorée. Types de série `dropset` → `drop` ; RPE importé s'il est entre 6 et 10 (arrondi au demi-point) ; supersets ignorés ; repos `null` ; durée = fin − début.
  - Exercices : suggestion par nom (exact sans accents, sinon Dice pondéré sur les mots, pénalisé si matériel ou type de mesure diffère), présélectionnée au-delà de `MATCH_THRESHOLD` ; sinon exercice perso au type de mesure déduit des colonnes remplies, matériel et muscle devinés.
  - Mesures : une par jour ; une mesure existante n'est complétée que sur ses champs vides. Colonnes avant-bras et abdomen ignorées.
  - Écriture en une transaction Dexie (outbox comprise), poussée ensuite par la synchro normale.
- **Suppression** : double confirmation (saisie de « SUPPRIMER »), puis Edge Function `delete-account` : suppression des objets Storage `<user_id>/*`, puis `auth.admin.deleteUser`, qui supprime tout le reste en cascade. Le client vide ensuite IndexedDB, les caches et l'abonnement push.

## 15. Performance et budgets

| Mesure | Cible | Moyen |
|---|---|---|
| JS initial (gzip) | < 180 Ko | Écrans secondaires et uPlot en lazy. |
| Ouverture de l'écran de séance | < 1 s (exigence §F9) | Données locales, aucun appel réseau sur le chemin critique. |
| Démarrage à froid de la PWA | < 2 s sur iPhone récent | Précache, pas de bloquant réseau au démarrage. |
| Validation d'une série | < 50 ms jusqu'au retour visuel | Mise à jour optimiste, écriture Dexie asynchrone. |
| Historique et stats | < 2 s (exigence) | Calcul local ; seule la première synchronisation d'un nouvel appareil dépend du réseau. |

Mesure : Lighthouse CI sur chaque PR (catégories PWA et Performance), plus un test Playwright qui chronomètre l'ouverture d'une séance de 6 exercices.

## 16. Environnements, CI/CD, exploitation

- **Local** : `supabase start` (Docker) avec migrations et seed ; `npm run dev`. Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
- **Production** : un projet Supabase Free et un projet Cloudflare Pages. Les prévisualisations Pages par branche pointent vers le Supabase local de CI ou vers un second projet Supabase « staging » (l'offre Free autorise 2 projets).
- **GitHub Actions** :
  - sur PR : `biome check`, `tsc`, Vitest, pgTAP (`supabase test db`), Playwright (Supabase local dans le runner), Lighthouse CI ;
  - sur `main` : `supabase db push` et `supabase functions deploy` (environnement protégé, validation manuelle). Cloudflare Pages déploie le front automatiquement ;
  - planifié tous les 3 jours : appel de `health()` pour éviter la mise en pause du projet.
- **Secrets** : VAPID privée, secret partagé pg_net → `send-push`, identifiants SMTP Brevo. Tous dans les secrets Supabase, jamais dans le dépôt.
- **Sauvegardes** : l'offre Free n'a pas de sauvegarde à restauration ponctuelle. Une Action hebdomadaire lance `pg_dump` (chaîne de connexion en secret), chiffre le dump (`age`) et le garde 8 semaines en artefact privé.
- **Erreurs** : pas de traqueur tiers (§F9). Les erreurs client sont journalisées localement dans `meta.errors` (100 dernières) et consultables dans Paramètres › À propos ; l'utilisateur peut les copier pour les transmettre.

## 17. Tests

| Niveau | Outil | Contenu minimal |
|---|---|---|
| Domaine | Vitest | Tous les exemples chiffrés de la spec : conversions, Epley (1, 12 et 13 reps), « à au moins N reps » (100 × 6), égalité qui n'est pas un record, premier essai, plusieurs records dans une séance, recalcul après modification d'une séance antérieure, séries équivalentes avec un échauffement ajouté, diff de routine (poids modifié = pas de diff), semaine en cours dans la série de semaines, séance à cheval sur minuit. **Objectifs** (§F7.10) : 80 × 12/12/12 en 8–12 → 82,5 × 10 ; 80 × 12/11/9 → 80 × 12/12/10 ; 100 × 6/6/6 en 4–6 → 102,5 × 5 ; 10 × 12/12/12 avec un incrément de 2 → 12 × 8 ; `equivalentReps` en lb égal au résultat en kg ; échec isolé → consolidation, deux échecs → −10 % arrondi à l'incrément inférieur ; plateau sur 3 séances sans hausse du total ; reprise après 3, 5, 9 et 20 semaines ; premier essai sans objectif ; objectifs désactivés ; *max* > 30 ; lesté et assisté sans équivalence ; durée 60 s → 65 s et 200 s → 210 s ; objectif figé non recalculé après la modification d'une séance antérieure ; `targetsMet` avec une série supprimée. **Tendance** : moins de 6 points → `undefined` ; pente nulle → `flat` ; série synthétique a + b ln t retrouvée à 1e-6 près ; plafond de 4 %/mois actif ; origine bornée à la première séance ; date d'atteinte au-delà de 52 semaines → `undefined` ; badge 🎯 seulement sur la première série après `setAt`. |
| Sync | Vitest + fake-indexeddb + Supabase local | Dernier gagne sur l'horloge appareil, égalité départagée par appareil, rejet après reprise de séance, outbox non écrasée par un pull, reprise après coupure au milieu d'un lot. |
| Base | pgTAP | RLS : isolation A/B, admin compris ; `is_admin` non modifiable ; écriture du catalogue réservée à l'admin ; `sync_push` et `take_over_workout`. |
| E2E | Playwright (WebKit + Chromium, viewport iPhone) | P2 complet, objectif pré-rempli validé en 1 toucher et compteur « objectifs atteints » ; P2 en `context.setOffline(true)` puis synchro ; app rechargée en pleine séance sans perte ; deux contextes = deux appareils (séance visible sur le second, reprise, lecture seule sur le premier) ; minuteur juste après un saut d'horloge simulé (`page.clock`). |
| Manuel (iPhone réel, iOS 27) | Protocole écrit | Installation, notification écran verrouillé, mode avion pendant toute une séance, écran allumé, taille de texte agrandie. Ces comportements ne sont pas automatisables de façon fiable. |

## 18. Découpage en lots

| Lot | Contenu | Livrable vérifiable |
|---|---|---|
| L0 Socle | Dépôt, CI, Supabase local et prod, PWA installable vide, thème, navigation 3 onglets, page d'installation. **Test de la chaîne Web Push** : clés VAPID, table `push_subscriptions` et `rest_timers` minimales, `dispatch_due_timers()` sous `pg_cron` (chaque seconde), Edge Function `send-push`, bouton de test « Notification dans 10 s » (Paramètres › À propos). Ce code est repris tel quel en L8. | L'app s'installe sur iPhone (iOS 27) et s'ouvre hors ligne. La notification de test arrive sur l'iPhone **verrouillé** en 1 à 2 s. |
| L1 Comptes | Admin, invitation, inscription, connexion, mot de passe oublié, profil minimal, RLS et tests pgTAP | Un invité crée son compte depuis l'iPhone. |
| L2 Données et sync | Schéma Dexie, repositories, outbox, `sync_push` / `sync_pull`, indicateur, catalogue seedé, bibliothèque et exercices personnalisés | Un exercice personnalisé créé hors ligne apparaît sur l'ordinateur. |
| L3 Séance en direct | Écran de séance, types de mesure, « Précédent », minuteur local, récapitulatif, abandon, séance oubliée, bandeau, reprise multi-appareil | Critère de réussite n° 1 (6 exercices, 20 séries, mode avion). |
| L4 Routines | Dossiers, routines, glisser-déposer, fourchette de reps dans l'éditeur (stockée en `repRange` dès le départ), démarrage depuis une routine, diff et mise à jour, enregistrer comme routine | Parcours P2 et P3 complets. |
| L5 Historique et records | Liste, détail, modification, suppression, saisie a posteriori, badges et compteurs | Critère n° 4 (records justes après modification). |
| L6 Progression | Fiche exercice (graphiques, périodes), statistiques globales, calendrier, mesures corporelles, graphique du profil | Parcours P4. |
| L7 Objectifs | `exercise_prefs`, `progression.ts`, pré-remplissage par `target`, ligne de raison, objectifs atteints, ancienneté (onboarding et paramètres), `trend.ts`, tendance sur la fiche, objectif à long terme | Exemples du §F7.10 verts en Vitest ; P2 avec objectif pré-rempli ; parcours P4 étape 3. |
| L8 Notifications | Branchement sur le minuteur de repos de la chaîne testée en L0 (planification à la validation, ±15 s, Passer), abonnement depuis l'onboarding et les paramètres, son, wake lock | Critère n° 2 (notification iPhone verrouillé). |
| L9 Compte et finitions | Paramètres complets, unités, export JSON/CSV, suppression du compte, mises à jour du SW, budgets de performance | Revue des exigences §F9. Critère n° 6 évalué après 4 semaines. |

## 19. Risques et points de vigilance

| Risque | Impact | Parade |
|---|---|---|
| Mise en pause du projet Supabase Free | App injoignable après une pause, données intactes | Ping automatique tous les 3 jours ; l'usage local continue de fonctionner. |
| `pg_cron` chaque seconde | Charge permanente faible sur la base | Requête sur index partiel, quasi gratuite. Repli possible : toutes les 5 s (précision moindre). |
| Chaîne Web Push iOS (VAPID, APNs, pg_cron, pg_net) | Critère n° 2 non tenu, découvert tard | Testée de bout en bout dès L0 sur l'iPhone cible (iOS 27), avant d'en dépendre. |
| Horloges d'appareil décalées | « Dernier gagne » peut garder la mauvaise version | Accepté par la spec ; un écart supérieur à 5 min avec l'heure serveur (en-tête `Date`) affiche un avertissement. |
| Évolutions des PWA sur iOS (push, wake lock, stockage) | Fonctions dégradées | Détection de fonctionnalités, protocole de test manuel à chaque version majeure d'iOS. |
| Quota photos 1 Go | Blocage de l'envoi | Compression ; 1 photo par séance (Q2) ; alerte à 80 %. |
| Traduction du catalogue | Qualité inégale | Relecture humaine obligatoire avant le seed de prod. |
| Objectifs mal calibrés (seuils heuristiques, formule de Marzagao non validée sur de vrais 1RM) | Objectifs trop durs ou trop faciles, perte de confiance | Constantes centralisées (`progressionConfig.ts`), objectif toujours modifiable, critère n° 6 et Q8. On suit le taux d'objectifs atteints par cas (`reason.kind`), calculable depuis l'export. |

## 20. Écarts et précisions par rapport à la spec fonctionnelle

Tous validés et reportés dans SPEC.md v0.7 :
1. **Invitation sur iOS** : le code ne passe pas automatiquement de Safari à l'app installée sur toutes les versions. Le formulaire d'inscription comporte donc un champ « code d'invitation » (§7.1).
2. **Mot de passe oublié** : la réinitialisation se fait dans Safari, puis l'utilisateur revient dans l'app (§7.2).
3. **Catalogue** : le type de mesure d'un exercice du catalogue est non modifiable (§13), pour la même raison que les exercices personnalisés utilisés.
4. **Record « plus de reps sur une séance »** : badge sur l'exercice et non sur une série (§10.3).
5. **Objectif figé** : l'objectif est enregistré dans la séance au démarrage (§10.7), ce qui permet le cas « consolidation » et le compteur d'objectifs atteints. Déjà reporté dans §F7.10.
6. **Séries prévues au-delà de la référence** : elles reprennent l'objectif de la dernière série de référence au lieu de rester sans objectif (§10.7). Déjà reporté dans §F7.10.
