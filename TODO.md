# TODO — reprise des prochaines sessions

État au 22/10/2026. Lire d'abord `CLAUDE.md`, `docs/contrat-serveur.md`, `DEPLOY.md`.

## Fait (sur `main`)
- PR #1 catalogue (218 exercices FR, `supabase/seed.sql`, `app/src/data/catalog.generated.json`).
- PR #2 domaine pur `app/src/domain/` (72 tests Vitest verts).
- PR #3 backend Supabase : migrations, RLS, RPC, pg_cron/pg_net, Edge Functions, 55 tests pgTAP verts, `DEPLOY.md`.
  Vérifié en local : seed, création admin + inscription par code, chaîne minuteur → send-push (VAPID).

## En cours : branche `feat/data-shell` (poussée, NE COMPILE PAS encore)
Contient : couche données (Dexie, outbox, sync push/pull, auth, push, export), shell (App, onglets, bandeau,
thème, SW, UpdatePrompt), écrans auth/invitation/reset/installation, onboarding, accueil, onglet Séance
(dossiers, routines), bibliothèque + création d'exercice, éditeur de routine (dnd-kit), séance en direct
(SetRow, ExerciseBlock, minuteur, reprise multi-appareil), récapitulatif, séance passée, détail d'historique,
paramètres (+ journal d'erreurs, suppression de compte), CI GitHub Actions (`.github/workflows`).

### Reste à faire pour fermer la branche
1. `app/src/features/profile/ProfilePage.tsx` (routes `/profile/*`) : profil (nom, nb séances, graphique hebdo
   durée/volume/séances via `weeklyAggregates`), liens Statistiques, Exercices et records, Mesures, Inviter,
   Paramètres (`features/settings/SettingsPage`), `settings/errors` (`ErrorLogPage`).
2. `features/stats/StatsPage.tsx` : calendrier (`monthGrid`, `trainingDays`, `weekStreak`), séries par muscle
   30 j (`muscleDistribution`), records récents (`recentRecords`).
3. `features/measurements/MeasurementsPage.tsx` : saisie datée + courbe par mesure (`measurementSeries`, `saveMeasurement`).
4. `features/exercise/ExercisePage.tsx` (`/exercise/:id`) : onglets Résumé/Historique/Consignes ; objectif de
   la prochaine séance, graphique uPlot lazy (`exerciseSeries`, `chartMetricsFor`, périodes) + tendance
   pointillée (`weeklyE1rmPoints`, `trainingOrigin`, `fitTrend`, `projectionPoints`, `currentRate`, `goalDate`),
   records (`bestRecords`, `criterionLabel`), réglages de progression (`saveExercisePrefs` : incrément,
   fourchette par défaut, objectif long terme), modifier/archiver un exercice perso (`ExerciseForm`, `removeExercise`),
   édition catalogue si `profile.is_admin`.
5. Routes dans `App.tsx` (SignedInRoutes) : `/workout/:id` (LiveWorkoutPage), `/workout/:id/summary`
   (SummaryPage), `/history/:id` (HistoryDetailPage), `/exercise/:id`, `/profile/*`.
6. `npm run typecheck && npm run lint -- --write && npm test && npm run build` dans `app/`, corriger.
7. SW : cache CacheFirst des photos indexé par chemin (param `p=` ajouté à l'URL signée dans `PhotoView.tsx`).
8. Squash-merge en PR (commits WIP sans Co-Authored-By à réécrire dans le message de squash).

## Ensuite
- Tests sync (Vitest + fake-indexeddb) et E2E Playwright (§17 spec technique).
- Test manuel local : `npx supabase start`, `npx supabase functions serve --env-file supabase/functions/.env`,
  `app/.env.local` déjà rempli (local), `cd app && npm run dev`. Compte local : admin@overload.local / motdepasse1,
  paul@overload.local / motdepasse1 (perdus après `db reset`).
- Déploiement prod (`DEPLOY.md`) : Supabase `saiqhwqoibyqgdsdakuy`, Cloudflare Pages (token à fournir via
  `request_secret`), Brevo SMTP, secrets VAPID/PUSH_SECRET, création admin.
- Budgets perf / Lighthouse CI.

## Décisions à valider par l'utilisateur
- Types de mesure du catalogue figés (Tractions, Dips en « poids du corps lesté », cardio, etc.) : relire
  `scripts/catalog-fr.json` avant le seed prod.
- Séance vide : un exercice ajouté reprend la structure de séries de la dernière fois (sinon 1 série).
- Fin de séance improvisée : proposition « Enregistrer comme routine » en feuille modale.

## Notes techniques
- `gh` : compte actif TerryBarillon non collaborateur → préfixer `GH_TOKEN=$(gh auth token --user Many0nne)`.
- Worktrees des sous-agents dans `.claude/worktrees/` (ignorés), supprimables (`git worktree remove`).
