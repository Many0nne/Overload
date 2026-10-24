# Overload

PWA de suivi de musculation. Specs : `SPEC.md` (fonctionnelle, §F), `SPEC-TECHNIQUE.md` (technique), maquette `design/maquette.html`.
Contrat client/serveur : `docs/contrat-serveur.md`. Déploiement : `DEPLOY.md`. Connecteur Claude (MCP) : `docs/spec-mcp.md`.

- Front : `app/` (React 19, Vite, Dexie, Zustand). `npm run typecheck | lint | test | build` depuis `app/`.
  Tests de synchro contre Supabase local (démarré) : `npm run test:sync` (`app/tests/sync/`).
  E2E Playwright (WebKit + Chromium, viewport iPhone) contre Supabase local : `npm run e2e` (`app/tests/e2e/`,
  build de prod servi par `vite preview` sur :4173 ; navigateurs : `npx playwright install chromium webkit`).
  Budgets (§15) : `npm run budget` après `vite build` (JS initial < 180 Ko gzip), `npm run lighthouse` (indicatif).
- Domaine pur et testé : `app/src/domain/` (types partagés dans `types.ts`). L'Edge Function `mcp` en embarque une copie
  (`supabase/functions/_shared/domain/`, générée) : après toute modification du domaine, `npm run edge:domain` (un test unitaire échoue sinon).
  Tests du connecteur (Edge Function) : `npm run test:sync` (`app/tests/mcp/`). Le runtime edge local ne recharge pas le code sous Windows :
  `docker restart supabase_edge_runtime_<projet>` après une modification de `supabase/functions/`.
- Backend : `supabase/` (migrations, Edge Functions, pgTAP). Local : `npx supabase start`, tests `npx supabase test db`.
- Catalogue : `scripts/build-catalog.ts` génère `supabase/seed.sql`.
- Langue de l'UI et des commentaires : français. Chaque nouvelle méthode a un commentaire « Cette méthode permet de… ».

## Branches et PR

- Branche d'intégration : `dev`. Les branches de travail partent de `dev` et les PR visent `dev` (`gh pr create --base dev`), jamais `main`.
- Merge automatique autorisé : une fois typecheck, lint et tests verts, merger la PR sans demander (`gh pr merge`).

## Worktrees (travail en parallèle)

Une branche = un worktree `worktrees/overload-<slug>/` (slug = branche avec `/` → `-`) = un Supabase local isolé + son Vite.
Script idempotent, à relancer au début de chaque tâche (PowerShell, depuis la racine du checkout principal) :

```powershell
.\scripts\overload-worktree.ps1 feature/x            # crée/réutilise, npm ci, supabase start + vite, vérifie [OK (200)]
.\scripts\overload-worktree.ps1 fix/y -Base feature/x # nouvelle branche depuis une autre base (défaut : dev)
.\scripts\overload-worktree.ps1 feature/x -NoUp       # sans démarrer ; -Studio : avec Supabase Studio
.\scripts\overload-worktree.ps1 feature/x -Stop       # arrête Vite + Supabase (données gardées)
.\scripts\overload-worktree.ps1 feature/x -Remove     # arrête, efface la base, supprime le worktree (branche gardée)
```

- Ports par slot N (checkout principal = slot 0) : API Supabase `54321+100N` (base `54322+100N`, mails `54324+100N`),
  Vite `5173+100N`, preview E2E `4173+100N`, inspecteur edge `8083+N`.
- L'isolation passe par des fichiers non versionnés du worktree : `supabase/.env` (`SUPABASE_PROJECT_ID`, ports, lus par la CLI)
  et `app/.env.local` (`VITE_SUPABASE_URL`, `E2E_PORT`). Ne pas modifier `supabase/config.toml` pour changer de port.
- Lancer les commandes `npx supabase …`, `npm run test:sync` et `npm run e2e` depuis le worktree concerné : elles visent alors sa stack.
- Ne pas lire ni recopier le `.env` d'un worktree (ni `supabase/functions/.env`, copié du principal).
- Nettoyage auto (registre `worktrees/.owners.json`) : `scripts/overload-worktree-cleanup.ps1` arrête la stack quand les threads T3
  du worktree sont settled, supprime le worktree quand ils sont archivés, ou settled avec la PR de la branche mergée ; tâche planifiée : `scripts/install-cleanup-task.ps1`.
