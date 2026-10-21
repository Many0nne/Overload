# Overload

PWA de suivi de musculation. Specs : `SPEC.md` (fonctionnelle, §F), `SPEC-TECHNIQUE.md` (technique), maquette `design/maquette.html`.
Contrat client/serveur : `docs/contrat-serveur.md`. Déploiement : `DEPLOY.md`.

- Front : `app/` (React 19, Vite, Dexie, Zustand). `npm run typecheck | lint | test | build` depuis `app/`.
- Domaine pur et testé : `app/src/domain/` (types partagés dans `types.ts`).
- Backend : `supabase/` (migrations, Edge Functions, pgTAP). Local : `npx supabase start`, tests `npx supabase test db`.
- Catalogue : `scripts/build-catalog.ts` génère `supabase/seed.sql`.
- Langue de l'UI et des commentaires : français. Chaque nouvelle méthode a un commentaire « Cette méthode permet de… ».
