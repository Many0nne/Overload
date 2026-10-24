#!/usr/bin/env bash
# Déploiement du backend de production (#72) : migrations puis Edge Functions, dans cet ordre.
# Lancé par .github/workflows/deploy.yml ; utilisable à la main depuis la racine du dépôt (CLI Supabase installée).
# Variables : SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD (lue par `supabase db push`).
# Les options des fonctions (verify_jwt) sont versionnées dans supabase/config.toml ([functions.<nom>]) :
# `supabase functions deploy` sans nom déploie tous les dossiers de supabase/functions/ (hors _shared) avec ces options.
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN manquant}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF manquant}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD manquant}"
SUPABASE="${SUPABASE_CLI:-npx supabase}"

# La copie du domaine embarquée par la fonction mcp doit être à jour (sinon : npm run edge:domain dans app/).
node app/scripts/build-edge-domain.mjs --check

$SUPABASE link --project-ref "$SUPABASE_PROJECT_REF"

echo "::group::Migrations"
$SUPABASE db push --dry-run
$SUPABASE db push
echo "::endgroup::"

echo "::group::Edge Functions"
$SUPABASE functions deploy --project-ref "$SUPABASE_PROJECT_REF" --use-api
echo "::endgroup::"
