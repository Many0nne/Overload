# TODO — reprise des prochaines sessions

État au 22/10/2026. Lire d'abord `CLAUDE.md`, `docs/contrat-serveur.md`, `DEPLOY.md`.

## Fait (sur `main`)
- PR #1 catalogue (218 exercices FR, `supabase/seed.sql`, `app/src/data/catalog.generated.json`).
- PR #2 domaine pur `app/src/domain/` (72 tests Vitest verts).
- PR #3 backend Supabase : migrations, RLS, RPC, pg_cron/pg_net, Edge Functions, 55 tests pgTAP, `DEPLOY.md`.
- PR #4 front complet de la V1 (données, synchro, shell, tous les écrans, objectifs, notifications, CI).
- PR #5 catalogue phase 0, #6 tests de synchro, #7 E2E Playwright, puis finitions (lot 3).

Toutes les fonctionnalités de la V1 sont codées. Reste : tests, finitions, déploiement, usage réel.

## 0. Décisions à valider par l'utilisateur (avant le lot 4)
- [x] Types de mesure du catalogue validés. Glute-ham raise passé en « poids du corps lesté » ; ajout de
      « Tractions assistées (machine) » et « Dips assistés (machine) » via `scripts/catalog-extra.json` (220 exercices).
- [x] Séance vide : un exercice ajouté reprend la structure de séries de la dernière fois (sinon 1 série). Gardé.
- [x] Fin de séance improvisée : « Enregistrer comme routine » en feuille modale. Gardé.
- [ ] Relecture humaine des noms et consignes de `scripts/catalog-fr.json` avant le seed prod (§19).
      Rappel : une fois en prod, le type de mesure d'un exercice du catalogue est figé (trigger `exercises_guard`).

## 1. Tests de synchro — `feat/sync-tests` (§17 spec technique, ligne « Sync »)
Vitest + fake-indexeddb sur `app/src/data/sync/engine.ts`, Supabase local pour l'aller-retour serveur.
- [x] Dernier gagne sur `client_updated_at` (horloge appareil).
- [x] Égalité d'horodatage départagée par l'identifiant d'appareil.
- [x] Écriture rejetée après reprise de la séance sur un autre appareil (`take_over_workout`).
- [x] Outbox non écrasée par un pull (élément local en attente conservé).
- [x] Reprise après coupure au milieu d'un lot (ni perte ni doublon).
- [x] Brancher dans la CI (job `app`, ou job dédié s'il faut Supabase local).
Livrable : tests verts en local et en CI. Fait : `npm run test:sync` (16 tests, `app/tests/sync/`), job CI `sync`.
      Bug corrigé au passage : égalité d'horodatage au pull départagée par appareil (`shouldApply`).

## 2. E2E Playwright — `feat/e2e` (§17, ligne « E2E »)
- [x] Config : WebKit + Chromium, viewport iPhone 15, build de prod servi par `vite preview` (service worker actif),
      Supabase local, un compte seedé par test (service_role : profil, routine « Push E2E », séance d'il y a 3 jours).
- [x] P2 complet depuis une routine ; objectif pré-rempli validé en 1 toucher ; compteur « objectifs atteints » (2/2).
- [x] P2 en `context.setOffline(true)` puis synchro au retour du réseau.
- [x] Rechargement en pleine séance sans perte (en ligne puis hors ligne via le service worker).
- [x] Deux contextes = deux appareils : séance visible sur le second, reprise, lecture seule sur le premier.
- [x] Minuteur juste après un saut d'horloge simulé (`page.clock`).
- [x] Job CI `e2e` (sur chaque PR ; rapport et traces en artefact en cas d'échec).
Livrable : `npm run e2e` (10 tests, `app/tests/e2e/`), ~2 min en local. Bug corrigé au passage : après connexion,
      `LoginPage` renvoyait à l'accueil à la fin de la première synchro (onglet touché entre-temps annulé, et retour
      forcé à l'accueil depuis la feuille « Reconnexion requise » en pleine séance).

## 3. Finitions manquantes — `feat/finitions` (§19 spec technique, lot L9)
- [x] Avertissement d'horloge décalée : écart > 5 min avec l'heure serveur (RPC `server_now_ms`, l'en-tête `Date`
      n'est pas lisible en CORS), mesuré après une synchro (au plus toutes les 10 min). Pastille « Horloge décalée » + feuille.
- [x] Alerte de quota photos à 80 % du 1 Go : RPC `admin_storage_usage` (admin seul, pgTAP), ligne « Stockage photos »
      dans Paramètres › Administration, pastille d'alerte au-delà de 80 %.
- [x] Budgets de performance : `npm run budget` (JS initial < 180 Ko gzip, bloquant en CI, 176,9 Ko), test E2E
      `perf.spec.ts` (séance de 6 exercices < 1 s, historique et stats < 2 s ; indicatif sous WebKit Windows),
      Lighthouse CI indicatif (job `lighthouse`, rapports en artefact). Catalogue rempli en arrière-plan au premier
      lancement ; écrans publics (connexion, inscription…) en lazy.
- [x] Revue §F9 : contraste AA (tokens `--muted` et `--accent-fill`), zones tactiles ≥ 44 px (pseudo-élément
      transparent), pavé numérique pour les durées (saisie façon minuteur : « 130 » = 1:30), libellés VoiceOver
      en français, test E2E « modifier un poids puis valider » (2 touchers).
      Bug corrigé au passage : sous Safari, le toucher sur un champ de série annulait la sélection (« 60 » + « 62,5 »
      donnait « 662,50 »).

## 4. Déploiement prod — avec l'utilisateur (`DEPLOY.md` §2 à §7)
Bloqué sur l'utilisateur : accès et secrets (passer par `request_secret`, jamais dans le chat).
- [x] Supabase `saiqhwqoibyqgdsdakuy` : 4 migrations (MCP, versions alignées sur les fichiers, schéma identique au
      local par empreintes), pg_cron/pg_net actifs, job `dispatch-due-timers`, catalogue seedé (220, sans attendre la
      relecture du point 0 : un nouveau seed met à jour noms et consignes), `private.config` renseigné.
- [x] Edge Functions (3) + secrets VAPID / PUSH_SECRET (valeurs dans `.tmp/prod-functions.env`, hors dépôt).
- [x] Auth : inscriptions désactivées, Site URL `https://overload-m8z.pages.dev`, Redirect `…/reset`, SMTP Brevo.
- [x] Compte admin créé (ptitesailes@gmail.com) ; lien d'invitation `https://overload-m8z.pages.dev/i/<CODE>`.
- [x] Cloudflare Pages `overload` → https://overload-m8z.pages.dev (Git, `main` en prod, préversion par branche).
- [x] Secrets GitHub `SUPABASE_URL` / `SUPABASE_ANON_KEY` pour `health.yml` (ping tous les 3 jours, testé).
- [x] Test de fumée en prod (compte jetable, supprimé ensuite) : inscription par invitation, connexion, pull du
      catalogue (220), push/pull d'un dossier, `server_now_ms`, minuteur → pg_cron → `send-push` (200, secret OK),
      `delete-account`. Reste l'envoi réel vers un appareil abonné (lot 5).
- [x] Nouvelles clés API : Edge Functions sur `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS` (repli legacy
      pour la pile locale), front Pages et secret GitHub sur `sb_publishable_…`, test de fumée et ping verts.
- [x] Désactiver les clés legacy (Settings › API Keys) : la clé service_role est passée dans un chat. Relancer
      ensuite `node .tmp/prod-smoke.mjs <CODE>`. Révoquer le token Cloudflare de `.tmp/cloudflare.env`.

## 5. Vérifications sur iPhone réel (iOS 27) — par l'utilisateur
- [ ] Rédiger le protocole écrit (`docs/protocole-iphone.md`) : URL, étapes, ce qu'il faut observer.
- [x] Installation PWA et ouverture hors ligne.
- [x] Notification de test (Paramètres › À propos, « Dans 10 s ») sur iPhone verrouillé.
- [ ] Minuteur de repos notifié écran verrouillé (critère n° 2).
- [ ] Séance de 6 exercices / 20 séries en mode avion (critère n° 1).
- [x] Séance visible sur un 2e appareil en moins d'une minute (critère n° 3).
- [ ] Écran allumé (wake lock), taille de texte agrandie.

## 6. Après la V1
- [ ] 4 semaines d'usage réel (critère n° 5), puis analyse du taux d'objectifs atteints par `reason.kind`
      depuis l'export et recalibrage de `progressionConfig.ts` si besoin (critère n° 6, Q8).
- [ ] V1.1 si bloquant : import CSV HEVY (Q4).
- [ ] Plus tard : visuels d'exercices, SVG ou 3D (Q5/Q6).

## Ordre conseillé
1 → 2 → 3 (indépendants, parallélisables en worktrees), puis 0 + 4 avec l'utilisateur, puis 5, puis 6.

## Test manuel local
`npx supabase start`, `npx supabase functions serve --env-file supabase/functions/.env`,
`app/.env.local` déjà rempli (local), `cd app && npm run dev`. Comptes locaux : admin@overload.local / motdepasse1,
paul@overload.local / motdepasse1 (perdus après `db reset`).

## Notes techniques
- `gh` : compte actif TerryBarillon non collaborateur → préfixer `GH_TOKEN=$(gh auth token --user Many0nne)`.
- Worktrees des sous-agents dans `.claude/worktrees/` (ignorés), supprimables (`git worktree remove`).
