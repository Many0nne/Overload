# Déploiement d'Overload

Production : projet Supabase `saiqhwqoibyqgdsdakuy` (offre Free) + Cloudflare Pages `overload` (https://overload-m8z.pages.dev). Toutes les commandes se lancent à la racine du dépôt, après `npm install` (outils racine).
État au 23/10/2026 : §2 à §7 faits.

## 1. Développement local

```bash
npm install                          # outils racine (CLI Supabase, tsx)
npx supabase start                   # Docker requis ; applique migrations + seed (catalogue + config locale)
npx tsx scripts/gen-vapid.ts         # copier la sortie dans supabase/functions/.env (modèle : .env.example)
npx supabase functions serve --env-file supabase/functions/.env
npx supabase status -o env           # API_URL, ANON_KEY, SERVICE_ROLE_KEY
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/create-admin.ts moi@exemple.fr <mdp> <Nom>
```

Puis dans `app/.env.local` :

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
VITE_VAPID_PUBLIC_KEY=<VAPID_PUBLIC_KEY>
```

et `cd app && npm run dev`. Tests base : `npx supabase test db`.

## 2. Base de production

```bash
npx supabase login
npx supabase link --project-ref saiqhwqoibyqgdsdakuy
npx supabase db push                 # migrations uniquement (les seeds ne sont pas appliqués)
```

Ensuite, les migrations partent automatiquement au merge sur `main` (§7). À la main en secours : `bash scripts/deploy-supabase.sh` (migrations puis fonctions).

Catalogue (une fois, puis à chaque régénération de `supabase/seed.sql`) : `npx supabase db query --linked -f supabase/seed.sql` (API de gestion, sans mot de passe de base), ou l'éditeur SQL du tableau de bord. Le seed est idempotent (UUID v5 stables) ; seul le type de mesure d'un exercice du catalogue ne peut plus changer.

Configuration de la notification (éditeur SQL, une fois) :

```sql
insert into private.config (key, value) values
  ('send_push_url', 'https://saiqhwqoibyqgdsdakuy.supabase.co/functions/v1/send-push'),
  ('purge_photos_url', 'https://saiqhwqoibyqgdsdakuy.supabase.co/functions/v1/purge-photos'),
  ('push_secret', '<SECRET_ALEATOIRE>')
on conflict (key) do update set value = excluded.value;
```

Vérifier dans Database › Extensions que `pg_cron` et `pg_net` sont actives, et dans Integrations › Cron que le job `dispatch-due-timers` tourne chaque seconde et `purge-orphan-photos` chaque nuit (photos orphelines, #61).

## 3. Edge Functions

```bash
npx tsx scripts/gen-vapid.ts         # paire de PRODUCTION (différente du local)
npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:<ton e-mail> PUSH_SECRET=<SECRET_ALEATOIRE>
npx supabase functions deploy        # toutes les fonctions ; options verify_jwt lues dans supabase/config.toml
```

Le déploiement des fonctions est automatique au merge sur `main` (§7) ; la commande ci-dessus ne sert qu'en secours.
Une nouvelle fonction se déclare dans `supabase/config.toml` (`[functions.<nom>]`, `verify_jwt`) : c'est là que vivent ses options.
`PUSH_SECRET` doit être identique à `private.config.push_secret` (secret partagé des appels pg_net : send-push, purge-photos). Sans CLI : Edge Functions › Secrets accepte un collage au format `.env`.
Les valeurs de production restent hors dépôt (`.tmp/prod-functions.env`, ignoré par git).

## 4. Authentification

Tableau de bord › Authentication :
- Sign In / Providers : désactiver « Allow new users to sign up » (l'inscription passe par `signup-with-invite`), garder Email activé.
- URL Configuration : Site URL = URL Cloudflare Pages ; Redirect URLs = `<URL>/reset`.
- SMTP (Brevo) : hôte `smtp-relay.brevo.com`, port 587, identifiant et clé SMTP Brevo, expéditeur vérifié dans Brevo. Sans SMTP personnalisé, Supabase n'envoie qu'aux membres de l'équipe du projet.
- Emails › Reset password : le lien `{{ .ConfirmationURL }}` redirige vers `/reset`.
- Connecteur Claude (docs/spec-mcp.md §5.1, lot M3) : OAuth Server › activer, chemin d'autorisation `/oauth/consent`, « Allow dynamic client registration » activé. JWT Keys : migrer vers des clés asymétriques (ES256) pour que l'Edge Function `mcp` vérifie les jetons sans appel réseau. URL à coller dans Claude : `https://<ref>.supabase.co/functions/v1/mcp` (affichée dans Paramètres › Claude).

## 5. Premier compte

```bash
SUPABASE_URL=https://saiqhwqoibyqgdsdakuy.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clé secrète sb_secret_…> \
  npx tsx scripts/create-admin.ts <email> <mdp> <Nom>
```

Sous PowerShell (la syntaxe `VAR=… commande` n'existe pas) :

```powershell
$env:SUPABASE_URL = "https://saiqhwqoibyqgdsdakuy.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<clé secrète sb_secret_…>"
npx tsx scripts/create-admin.ts <email> '<mdp>' "<Nom>"
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

Le script affiche le code d'invitation de l'admin. Lien à partager : `<URL>/i/<CODE>`.

## 6. Front (Cloudflare Pages)

- Projet **Pages** relié au dépôt GitHub, branche de production `main`, prévisualisation sur chaque branche.
  Attention : le bouton « Create » du tableau de bord propose d'abord un Worker, ce n'est pas ce qu'on veut.
- Build : répertoire racine `app`, commande `npm run build`, sortie `dist`.
- Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé `sb_publishable_…` en prod), `VITE_VAPID_PUBLIC_KEY`, et `NODE_VERSION=24`.
- Routage côté client : sans `404.html`, Pages sert `index.html` pour toute route inconnue. Pas de `_redirects` :
  la règle `/* /index.html 200` y est rejetée comme boucle infinie.

## 7. GitHub Actions

Secrets du dépôt : `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clé publishable ; ping `health()` tous les 3 jours, évite la pause du projet Free).

Déploiement du backend (`.github/workflows/deploy.yml`, #72) : à chaque push sur `main` touchant `supabase/migrations`, `supabase/functions`
ou `supabase/config.toml` (ou via « Run workflow »), `scripts/deploy-supabase.sh` vérifie la copie du domaine de `mcp`, lance `db push` puis
déploie toutes les fonctions. Réglages, une fois (Settings › Environments › New environment `production`) :
- Deployment branches : `main` uniquement ; en option, Required reviewers pour valider chaque déploiement.
- Secrets d'environnement : `SUPABASE_ACCESS_TOKEN` (jeton personnel, tableau de bord › Account › Access Tokens),
  `SUPABASE_DB_PASSWORD` (mot de passe de la base, Project Settings › Database).
- Variable d'environnement : `SUPABASE_PROJECT_REF` = `saiqhwqoibyqgdsdakuy`.

Cloudflare Pages construit le front au même moment, sans attendre ce workflow : une migration dont dépend le front
doit rester rétrocompatible (ajouts d'abord, suppressions dans une release ultérieure).

## 8. Vérifications après déploiement (iPhone, iOS 27)

1. Ouvrir `<URL>/i/<CODE>` dans Safari, ajouter à l'écran d'accueil, ouvrir depuis l'icône : le formulaire d'inscription a le code pré-rempli (sinon le coller).
2. Paramètres › À propos › « Tester une notification », verrouiller l'iPhone : la notification arrive en 1 à 2 s.
3. Mode avion pendant toute une séance, puis retour du réseau : la séance apparaît sur un autre appareil en moins d'une minute.
4. Écran allumé pendant la séance ; taille de texte agrandie (Réglages › Affichage).
