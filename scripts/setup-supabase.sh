#!/usr/bin/env bash
# One-time (and repeatable) Supabase setup for ExitIQ:
#   1. links the CLI to the ExitIQ project
#   2. applies all database migrations
#   3. deploys the generate-narrative Edge Function
#   4. stores the Anthropic API key as a function secret (if given)
#
# Usage (from the repository root):
#   ANTHROPIC_API_KEY=sk-ant-... bash scripts/setup-supabase.sh
#
# The CLI asks you to log in (browser) and for the database password the
# first time. Nothing here is stored in the repository.
set -euo pipefail
cd "$(dirname "$0")/.."
REF=elpjwoujqzskgydytvob

echo "== Logging in to Supabase (skipped if already logged in)"
npx --yes supabase@latest projects list >/dev/null 2>&1 || npx --yes supabase@latest login

echo "== Linking project $REF"
npx --yes supabase@latest link --project-ref "$REF"

echo "== Applying database migrations"
npx --yes supabase@latest db push

echo "== Deploying the generate-narrative function"
npx --yes supabase@latest functions deploy generate-narrative --project-ref "$REF"

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "== Storing ANTHROPIC_API_KEY as a function secret"
  npx --yes supabase@latest secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" --project-ref "$REF"
else
  echo "!! ANTHROPIC_API_KEY not set: the written summary stays unavailable until you add it"
  echo "   (Dashboard -> Edge Functions -> Secrets, or rerun this script with the variable set)."
fi

cat <<'EOF'

Done with the database and function. Still to check in the dashboards:
  - Supabase -> Authentication -> Sign In / Providers: "Allow anonymous sign-ins" ON
  - Supabase -> Authentication -> Attack Protection: if CAPTCHA is ON, Vercel needs
    VITE_TURNSTILE_SITE_KEY and the Turnstile widget must allow your Vercel domain;
    otherwise turn CAPTCHA OFF
  - Vercel: redeploy after changing any VITE_ variable
EOF
