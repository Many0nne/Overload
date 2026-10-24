# Overload

PWA personnelle de suivi de musculation, pensée **hors ligne d'abord** : on enregistre une séance à la salle (même sans réseau) aussi vite qu'avec un carnet papier, puis on suit sa progression. À installer sur l'écran d'accueil de l'iPhone, sans App Store. Aucune fonction sociale : les données de chaque compte sont isolées.

## Fonctionnalités

- **Comptes** sur invitation, export et suppression des données.
- **Bibliothèque d'exercices** : catalogue (muscles, équipement) et exercices personnalisés.
- **Routines** : modèles de séance rangés en dossiers, avec fourchettes de répétitions.
- **Séance en direct** : saisie des séries (valeurs de la dernière fois préremplies), minuteur de repos fiable écran verrouillé, notification de fin de repos.
- **Historique** des séances.
- **Statistiques** : records, graphiques, volume, calendrier, mesures corporelles.
- **Objectifs de progression** : suggestion pour la prochaine séance de chaque exercice, tenant compte de l'effort ressenti (RPE).
- **Connecteur Claude (MCP)** pour interroger ses données depuis Claude.

Détail dans [`SPEC.md`](SPEC.md).

## Stack

- **Front** (`app/`) : React 19, Vite, TypeScript, Dexie (IndexedDB, source de vérité locale), Zustand, service worker Workbox.
- **Backend** (`supabase/`) : Supabase, avec Postgres (migrations, RLS), Auth et Edge Functions, dont le connecteur MCP.
- **Domaine** (`app/src/domain/`) : logique métier pure et testée, partagée avec l'Edge Function `mcp`.
- **Qualité** : Vitest, Playwright (WebKit + Chromium), pgTAP, Biome.

## Démarrage local

Prérequis : Node.js, Docker (pour Supabase local).

```bash
npm ci                      # racine : CLI Supabase et scripts
npx supabase start          # Postgres, Auth, Edge Functions en local
cd app
npm ci
cp .env.example .env.local  # puis renseigner les variables ci-dessous
npm run dev                 # http://localhost:5173
```

Variables de `app/.env.local` (valeurs fournies par `npx supabase status` en local) :

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL de l'API Supabase |
| `VITE_SUPABASE_ANON_KEY` | clé publique (anon) |
| `VITE_VAPID_PUBLIC_KEY` | clé publique Web Push (`npm run gen:vapid` à la racine) |

L'inscription se fait sur invitation : `npm run create-admin` (racine) crée le compte administrateur et affiche son lien d'invitation (voir [`DEPLOY.md`](DEPLOY.md)). Ne jamais committer de fichier `.env`.

## Tests

Depuis `app/` (Supabase local démarré pour `test:sync` et `e2e`) :

```bash
npm run typecheck
npm run lint
npm test             # tests unitaires
npm run test:sync    # synchro et connecteur MCP contre Supabase local
npm run e2e          # Playwright (npx playwright install chromium webkit au premier lancement)
npm run build && npm run budget   # budget de poids du JS initial
```

Depuis la racine : `npx supabase test db` (pgTAP). Après toute modification du domaine, lancer `npm run edge:domain` dans `app/`. Sous Windows, redémarrer aussi le conteneur `supabase_edge_runtime_<projet>` après un changement dans `supabase/functions/` (voir [`CLAUDE.md`](CLAUDE.md)).

## Travail en parallèle

Sous Windows (PowerShell), chaque branche peut tourner dans son propre worktree avec un Supabase et un Vite isolés :

```powershell
.\scripts\overload-worktree.ps1 feature/x
```

Ports, options et nettoyage : voir [`CLAUDE.md`](CLAUDE.md).

## Documentation

| Document | Contenu |
|---|---|
| [`SPEC.md`](SPEC.md) | spécification fonctionnelle |
| [`SPEC-TECHNIQUE.md`](SPEC-TECHNIQUE.md) | architecture et choix techniques |
| [`docs/contrat-serveur.md`](docs/contrat-serveur.md) | contrat client/serveur |
| [`docs/spec-mcp.md`](docs/spec-mcp.md) | connecteur Claude (MCP) |
| [`DEPLOY.md`](DEPLOY.md) | déploiement |
| [`design/maquette.html`](design/maquette.html) | maquette de l'interface |
