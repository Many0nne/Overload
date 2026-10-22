# Overload

PWA de suivi de musculation. Specs : `SPEC.md` (fonctionnelle, §F), `SPEC-TECHNIQUE.md` (technique), maquette `design/maquette.html`.
Contrat client/serveur : `docs/contrat-serveur.md`. Déploiement : `DEPLOY.md`.

- Front : `app/` (React 19, Vite, Dexie, Zustand). `npm run typecheck | lint | test | build` depuis `app/`.
  Tests de synchro contre Supabase local (démarré) : `npm run test:sync` (`app/tests/sync/`).
  E2E Playwright (WebKit + Chromium, viewport iPhone) contre Supabase local : `npm run e2e` (`app/tests/e2e/`,
  build de prod servi par `vite preview` sur :4173 ; navigateurs : `npx playwright install chromium webkit`).
  Budgets (§15) : `npm run budget` après `vite build` (JS initial < 180 Ko gzip), `npm run lighthouse` (indicatif).
- Domaine pur et testé : `app/src/domain/` (types partagés dans `types.ts`).
- Backend : `supabase/` (migrations, Edge Functions, pgTAP). Local : `npx supabase start`, tests `npx supabase test db`.
- Catalogue : `scripts/build-catalog.ts` génère `supabase/seed.sql`.
- Langue de l'UI et des commentaires : français. Chaque nouvelle méthode a un commentaire « Cette méthode permet de… ».
