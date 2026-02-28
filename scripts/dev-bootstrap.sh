#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Ensure docker group is active (avoids needing a re-login)
DOCKER_RUN="sg docker -c"

echo "🚀 Starting Supabase locally..."
$DOCKER_RUN "npx supabase start" 2>&1

echo "📋 Fetching Supabase status..."
eval "$($DOCKER_RUN "npx supabase status -o env" 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"

if [ -z "${API_URL:-}" ] || [ -z "${ANON_KEY:-}" ]; then
  echo "❌ Failed to extract Supabase credentials."
  exit 1
fi

echo "✏️  Updating .env.local..."
cat > "$PROJECT_DIR/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-}
EOF

echo "✅ .env.local updated with local Supabase credentials"
echo ""
echo "   API URL:  $API_URL"
echo "   Anon Key: ${ANON_KEY:0:20}..."
echo ""
echo "🌱 Running seed data..."
npx tsx scripts/seed.ts

echo "🔧 Starting Edge Functions..."
$DOCKER_RUN "npx supabase functions serve --no-verify-jwt" &

echo "🎉 All set! Starting Next.js dev server..."
npm run dev
