#!/usr/bin/env bash
# setup-supabase.sh
# Automates Supabase project creation for the golf tracker app.
#
# Prerequisites:
#   - curl (installed by default on macOS)
#   - jq  (brew install jq)
#   - gh  (brew install gh, then: gh auth login)   — only needed if you want
#          GitHub Actions variables set automatically
#
# Usage:
#   chmod +x scripts/setup-supabase.sh
#   ./scripts/setup-supabase.sh
#
# You will be prompted for:
#   1. Supabase Personal Access Token  (supabase.com → Account → Access Tokens)
#   2. Supabase Organisation ID        (auto-detected if you only have one org)
#   3. Database password               (for the new Supabase project)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_FILE="$ROOT_DIR/supabase-schema.sql"
ENV_FILE="$ROOT_DIR/.env.local"
API="https://api.supabase.com"

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
err() { echo "ERROR: $*" >&2; exit 1; }

need() {
  command -v "$1" &>/dev/null || err "'$1' is required but not installed. $2"
}

need curl "Install curl (should already be on macOS)."
need jq   "Run: brew install jq"

# ──────────────────────────────────────────────
# 1. Personal access token
# ──────────────────────────────────────────────
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo ""
  echo "Get your Personal Access Token from:"
  echo "  https://supabase.com/dashboard/account/tokens"
  echo ""
  read -rsp "Paste your Supabase Personal Access Token: " SUPABASE_ACCESS_TOKEN
  echo ""
fi

[[ -z "$SUPABASE_ACCESS_TOKEN" ]] && err "Token cannot be empty."

auth_header="Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

# ──────────────────────────────────────────────
# 2. Organisation ID
# ──────────────────────────────────────────────
echo ""
echo "Fetching your Supabase organisations…"

orgs_json=$(curl -sf -H "$auth_header" "$API/v1/organizations") \
  || err "Failed to reach Supabase API. Check your token."

org_count=$(echo "$orgs_json" | jq 'length')

if [[ "$org_count" -eq 0 ]]; then
  err "No organisations found. Create one at supabase.com first."
elif [[ "$org_count" -eq 1 ]]; then
  ORG_ID=$(echo "$orgs_json" | jq -r '.[0].id')
  ORG_NAME=$(echo "$orgs_json" | jq -r '.[0].name')
  echo "Using organisation: $ORG_NAME ($ORG_ID)"
else
  echo ""
  echo "Multiple organisations found:"
  echo "$orgs_json" | jq -r 'to_entries[] | "  [\(.key)] \(.value.name)  (\(.value.id))"'
  echo ""
  read -rp "Enter the number of the organisation to use [0]: " org_idx
  org_idx="${org_idx:-0}"
  ORG_ID=$(echo "$orgs_json" | jq -r ".[$org_idx].id")
  ORG_NAME=$(echo "$orgs_json" | jq -r ".[$org_idx].name")
  echo "Using: $ORG_NAME ($ORG_ID)"
fi

# ──────────────────────────────────────────────
# 3. Project name
# ──────────────────────────────────────────────
echo ""
read -rp "Project name [golf-tracker]: " PROJECT_NAME
PROJECT_NAME="${PROJECT_NAME:-golf-tracker}"

# ──────────────────────────────────────────────
# 4. Region
# ──────────────────────────────────────────────
echo ""
echo "Available regions (common choices):"
echo "  us-east-1       US East (N. Virginia)"
echo "  us-west-1       US West (N. California)"
echo "  eu-west-1       Europe (Ireland)"
echo "  ap-southeast-1  Asia Pacific (Singapore)"
echo "  ap-northeast-1  Asia Pacific (Tokyo)"
read -rp "Region [us-east-1]: " REGION
REGION="${REGION:-us-east-1}"

# ──────────────────────────────────────────────
# 5. Database password
# ──────────────────────────────────────────────
echo ""
read -rsp "Choose a database password (min 8 chars, store it somewhere safe): " DB_PASS
echo ""
[[ ${#DB_PASS} -lt 8 ]] && err "Password must be at least 8 characters."

# ──────────────────────────────────────────────
# 6. Create project
# ──────────────────────────────────────────────
echo ""
echo "Creating Supabase project '$PROJECT_NAME' in $REGION…"

create_payload=$(jq -n \
  --arg name "$PROJECT_NAME" \
  --arg org  "$ORG_ID" \
  --arg reg  "$REGION" \
  --arg pass "$DB_PASS" \
  '{name: $name, organization_id: $org, region: $reg, db_pass: $pass}')

create_resp=$(curl -sf \
  -X POST \
  -H "$auth_header" \
  -H "Content-Type: application/json" \
  -d "$create_payload" \
  "$API/v1/projects") || err "Failed to create project. Response: $create_resp"

PROJECT_REF=$(echo "$create_resp" | jq -r '.id')
[[ -z "$PROJECT_REF" || "$PROJECT_REF" == "null" ]] && \
  err "Unexpected API response — could not extract project ref:\n$create_resp"

echo "Project created. Ref: $PROJECT_REF"

# ──────────────────────────────────────────────
# 7. Wait for ACTIVE_HEALTHY
# ──────────────────────────────────────────────
echo ""
echo "Waiting for database to become ready (this typically takes 1–2 minutes)…"

max_wait=180  # seconds
elapsed=0
interval=10

while true; do
  status=$(curl -sf \
    -H "$auth_header" \
    "$API/v1/projects/$PROJECT_REF" | jq -r '.status')

  echo "  status: $status  (${elapsed}s elapsed)"

  [[ "$status" == "ACTIVE_HEALTHY" ]] && break

  if [[ $elapsed -ge $max_wait ]]; then
    err "Project did not become ready within ${max_wait}s. Check supabase.com."
  fi

  sleep $interval
  elapsed=$((elapsed + interval))
done

echo "Database is ready."

# ──────────────────────────────────────────────
# 8. Apply schema
# ──────────────────────────────────────────────
echo ""
echo "Applying schema from supabase-schema.sql…"

[[ ! -f "$SCHEMA_FILE" ]] && err "Schema file not found: $SCHEMA_FILE"

sql=$(cat "$SCHEMA_FILE")

schema_resp=$(curl -sf \
  -X POST \
  -H "$auth_header" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$sql" '{query: $q}')" \
  "$API/v1/projects/$PROJECT_REF/database/query") || \
    err "Failed to apply schema. Check the SQL for errors."

echo "Schema applied successfully."

# ──────────────────────────────────────────────
# 9. Get anon key
# ──────────────────────────────────────────────
echo ""
echo "Fetching API keys…"

keys_resp=$(curl -sf \
  -H "$auth_header" \
  "$API/v1/projects/$PROJECT_REF/api-keys?reveal=true")

ANON_KEY=$(echo "$keys_resp" | jq -r '.[] | select(.name == "anon") | .api_key')
[[ -z "$ANON_KEY" || "$ANON_KEY" == "null" ]] && \
  err "Could not retrieve anon key. Keys response: $keys_resp"

PROJECT_URL="https://$PROJECT_REF.supabase.co"

echo "URL:  $PROJECT_URL"
echo "Key:  ${ANON_KEY:0:20}…"

# ──────────────────────────────────────────────
# 10. Write .env.local
# ──────────────────────────────────────────────
echo ""
cat > "$ENV_FILE" <<EOF
VITE_SUPABASE_URL=$PROJECT_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
EOF
echo "Written: .env.local"

# ──────────────────────────────────────────────
# 11. Set GitHub Actions variables (optional)
# ──────────────────────────────────────────────
echo ""
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  read -rp "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as GitHub Actions variables? [Y/n]: " set_gh
  set_gh="${set_gh:-Y}"
  if [[ "$set_gh" =~ ^[Yy] ]]; then
    gh variable set VITE_SUPABASE_URL  --body "$PROJECT_URL"
    gh variable set VITE_SUPABASE_ANON_KEY --body "$ANON_KEY"
    echo "GitHub Actions variables set."
  fi
else
  echo "GitHub CLI not logged in — skipping GitHub variable setup."
  echo "To set manually, run from the repo root:"
  echo "  gh variable set VITE_SUPABASE_URL --body \"$PROJECT_URL\""
  echo "  gh variable set VITE_SUPABASE_ANON_KEY --body \"$ANON_KEY\""
fi

# ──────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " Setup complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. npm run dev      — test locally (uses .env.local)"
echo "  2. Open the app → sign in with a magic-link email"
echo "  3. npm run build && npm run deploy  — push to GitHub Pages"
echo ""
echo "Your Supabase dashboard: https://supabase.com/dashboard/project/$PROJECT_REF"
echo ""
