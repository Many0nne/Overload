#!/usr/bin/env bash
# Déploiement du backend de production (#72) : migrations puis Edge Functions, dans cet ordre.
# Lancé par .github/workflows/deploy.yml ; utilisable à la main depuis la racine du dépôt (CLI Supabase installée).
# Variables : SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD, SUPABASE_POOLER_HOST.
# Pas de `supabase link` : il exige un jeton capable de lire les clés secrètes du projet (service_role).
# Les migrations passent par le pooler (mot de passe seul), les fonctions par le jeton (permission Edge Functions seule).
# Les options des fonctions (verify_jwt) sont versionnées dans supabase/config.toml ([functions.<nom>]) :
# `supabase functions deploy` sans nom déploie tous les dossiers de supabase/functions/ (hors _shared) avec ces options.
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN manquant}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF manquant}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD manquant}"
: "${SUPABASE_POOLER_HOST:?SUPABASE_POOLER_HOST manquant}"
SUPABASE="${SUPABASE_CLI:-npx supabase}"

# La copie du domaine embarquée par la fonction mcp doit être à jour (sinon : npm run edge:domain dans app/).
node app/scripts/build-edge-domain.mjs --check

# Session pooler (IPv4, port 5432) : la connexion directe est en IPv6, pas toujours joignable depuis les runners.
DB_PASSWORD_ENC="$(node -e 'process.stdout.write(encodeURIComponent(process.env.SUPABASE_DB_PASSWORD))')"
DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${DB_PASSWORD_ENC}@${SUPABASE_POOLER_HOST}:5432/postgres"
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::${DB_PASSWORD_ENC}"

echo "::group::Migrations"
$SUPABASE db push --db-url "$DB_URL" --dry-run
$SUPABASE db push --db-url "$DB_URL"
echo "::endgroup::"

echo "::group::Edge Functions"
$SUPABASE functions deploy --project-ref "$SUPABASE_PROJECT_REF" --use-api
echo "::endgroup::"
