# TODO — reprise des prochaines sessions

État au 22/10/2026. Lire d'abord `CLAUDE.md`, `docs/contrat-serveur.md`, `DEPLOY.md`.

## Fait (sur `main`)
- PR #1 catalogue (218 exercices FR, `supabase/seed.sql`, `app/src/data/catalog.generated.json`).
- PR #2 domaine pur `app/src/domain/` (72 tests Vitest verts).
- PR #3 backend Supabase : migrations, RLS, RPC, pg_cron/pg_net, Edge Functions, 55 tests pgTAP, `DEPLOY.md`.
- PR #4 front complet de la V1 (données, synchro, shell, tous les écrans, objectifs, notifications, CI).

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
- [ ] Dernier gagne sur `client_updated_at` (horloge appareil).
- [ ] Égalité d'horodatage départagée par l'identifiant d'appareil.
- [ ] Écriture rejetée après reprise de la séance sur un autre appareil (`take_over_workout`).
- [ ] Outbox non écrasée par un pull (élément local en attente conservé).
- [ ] Reprise après coupure au milieu d'un lot (ni perte ni doublon).
- [ ] Brancher dans la CI (job `app`, ou job dédié s'il faut Supabase local).
Livrable : tests verts en local et en CI.

## 2. E2E Playwright — `feat/e2e` (§17, ligne « E2E »)
Le paquet et le script `npm run e2e` existent ; `app/tests/` est vide, pas de `playwright.config.ts`.
- [ ] Config : WebKit + Chromium, viewport iPhone, serveur Vite + Supabase local, comptes de test seedés.
- [ ] P2 complet depuis une routine ; objectif pré-rempli validé en 1 toucher ; compteur « objectifs atteints ».
- [ ] P2 en `context.setOffline(true)` puis synchro au retour du réseau.
- [ ] Rechargement en pleine séance sans perte.
- [ ] Deux contextes = deux appareils : séance visible sur le second, reprise, lecture seule sur le premier.
- [ ] Minuteur juste après un saut d'horloge simulé (`page.clock`).
- [ ] Job CI (peut tourner seulement sur `main` si trop lent).

## 3. Finitions manquantes — `feat/finitions` (§19 spec technique, lot L9)
- [ ] Avertissement d'horloge décalée : écart > 5 min entre l'appareil et l'en-tête `Date` du serveur.
- [ ] Alerte de quota photos à 80 % du 1 Go (Storage).
- [ ] Budgets de performance + Lighthouse CI : écran de séance < 1 s, historique/statistiques < 2 s en 4G.
- [ ] Revue des exigences §F9 (pavé numérique, nombre de touchers, contraste, taille de texte iOS agrandie).

## 4. Déploiement prod — avec l'utilisateur (`DEPLOY.md` §2 à §7)
Bloqué sur l'utilisateur : accès et secrets (passer par `request_secret`, jamais dans le chat).
- [ ] Supabase `saiqhwqoibyqgdsdakuy` : migrations, seed du catalogue validé (point 0), extensions pg_cron/pg_net.
- [ ] Edge Functions + secrets VAPID / PUSH_SECRET.
- [ ] Auth : SMTP Brevo, URLs de redirection.
- [ ] Création du compte admin et premier code d'invitation.
- [ ] Cloudflare Pages (token Cloudflare à fournir).
- [ ] Secrets GitHub `SUPABASE_URL` / `SUPABASE_ANON_KEY` pour `health.yml` (ping tous les 3 jours).

## 5. Vérifications sur iPhone réel (iOS 27) — par l'utilisateur
- [ ] Rédiger le protocole écrit (`docs/protocole-iphone.md`) : URL, étapes, ce qu'il faut observer.
- [ ] Installation PWA et ouverture hors ligne.
- [ ] Notification de test (Paramètres › À propos, « Dans 10 s ») sur iPhone verrouillé.
- [ ] Minuteur de repos notifié écran verrouillé (critère n° 2).
- [ ] Séance de 6 exercices / 20 séries en mode avion (critère n° 1).
- [ ] Séance visible sur un 2e appareil en moins d'une minute (critère n° 3).
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
