# TODO — reprise des prochaines sessions

État au 22/10/2026. Lire d'abord `CLAUDE.md`, `docs/contrat-serveur.md`, `DEPLOY.md`.

## Fait (sur `main`)
- PR #1 catalogue (218 exercices FR, `supabase/seed.sql`, `app/src/data/catalog.generated.json`).
- PR #2 domaine pur `app/src/domain/` (72 tests Vitest verts).
- PR #3 backend Supabase : migrations, RLS, RPC, pg_cron/pg_net, Edge Functions, 55 tests pgTAP verts, `DEPLOY.md`.
  Vérifié en local : seed, création admin + inscription par code, chaîne minuteur → send-push (VAPID).

## Branche `feat/data-shell` : terminée (PR ouverte, à squash-merger)
Couche données, shell, écrans auth/onboarding, accueil, onglet Séance, bibliothèque, éditeur de routine,
séance en direct, récapitulatif, historique, paramètres, profil (histogramme hebdo), statistiques (calendrier,
muscles, records récents), mesures corporelles, fiche exercice (objectif, courbe uPlot + tendance, records,
réglages de progression, édition/archivage), cache SW des photos par chemin, CI.
typecheck, lint, 72 tests et build verts ; parcours vérifiés sur Supabase local.
Message de squash : réécrire les commits WIP en un seul message avec Co-Authored-By.

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
