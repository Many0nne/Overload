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

Catalogue (une fois, puis à chaque régénération de `supabase/seed.sql`) : `npx supabase db query --linked -f supabase/seed.sql` (API de gestion, sans mot de passe de base), ou l'éditeur SQL du tableau de bord. Le seed est idempotent (UUID v5 stables) ; seul le type de mesure d'un exercice du catalogue ne peut plus changer.

Configuration de la notification (éditeur SQL, une fois) :

```sql
insert into private.config (key, value) values
  ('send_push_url', 'https://saiqhwqoibyqgdsdakuy.supabase.co/functions/v1/send-push'),
  ('push_secret', '<SECRET_ALEATOIRE>')
on conflict (key) do update set value = excluded.value;
```

Vérifier dans Database › Extensions que `pg_cron` et `pg_net` sont actives, et dans Integrations › Cron que le job `dispatch-due-timers` tourne chaque seconde.

## 3. Edge Functions

```bash
npx tsx scripts/gen-vapid.ts         # paire de PRODUCTION (différente du local)
npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:<ton e-mail> PUSH_SECRET=<SECRET_ALEATOIRE>
npx supabase functions deploy signup-with-invite --no-verify-jwt
npx supabase functions deploy send-push --no-verify-jwt
npx supabase functions deploy delete-account
```

`PUSH_SECRET` doit être identique à `private.config.push_secret`. Sans CLI : Edge Functions › Secrets accepte un collage au format `.env`.
Les valeurs de production restent hors dépôt (`.tmp/prod-functions.env`, ignoré par git).

## 4. Authentification

Tableau de bord › Authentication :
- Sign In / Providers : désactiver « Allow new users to sign up » (l'inscription passe par `signup-with-invite`), garder Email activé.
- URL Configuration : Site URL = URL Cloudflare Pages ; Redirect URLs = `<URL>/reset`.
- SMTP (Brevo) : hôte `smtp-relay.brevo.com`, port 587, identifiant et clé SMTP Brevo, expéditeur vérifié dans Brevo. Sans SMTP personnalisé, Supabase n'envoie qu'aux membres de l'équipe du projet.
- Emails › Reset password : le lien `{{ .ConfirmationURL }}` redirige vers `/reset`.

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

## 8. Vérifications après déploiement (iPhone, iOS 27)

1. Ouvrir `<URL>/i/<CODE>` dans Safari, ajouter à l'écran d'accueil, ouvrir depuis l'icône : le formulaire d'inscription a le code pré-rempli (sinon le coller).
2. Paramètres › À propos › « Tester une notification », verrouiller l'iPhone : la notification arrive en 1 à 2 s.
3. Mode avion pendant toute une séance, puis retour du réseau : la séance apparaît sur un autre appareil en moins d'une minute.
4. Écran allumé pendant la séance ; taille de texte agrandie (Réglages › Affichage).
