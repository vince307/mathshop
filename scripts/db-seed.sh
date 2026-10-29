#!/usr/bin/env bash
# Re-apply supabase/seed.sql to the running local stack, without the full
# `supabase db reset` (which also re-runs every migration). The seed deletes and
# recreates its own account first, so this is safe to run repeatedly.
#
# Local only — it targets whatever `npx supabase status` reports, i.e. the
# Docker stack on this machine.
set -euo pipefail

cd "$(dirname "$0")/.."
SEED="supabase/seed.sql"
[ -f "$SEED" ] || { echo "missing $SEED" >&2; exit 1; }

if ! npx supabase status >/dev/null 2>&1; then
  echo "Local Supabase stack is not running — start it with 'npx supabase start'." >&2
  exit 1
fi

if command -v psql >/dev/null 2>&1; then
  DB_URL="$(npx supabase status -o env | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SEED"
else
  # No local psql client: use the one inside the stack's database container.
  # Container name is `supabase_db_<project_id>` (supabase/config.toml).
  PROJECT_ID="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' supabase/config.toml | head -1)"
  docker exec -i "supabase_db_${PROJECT_ID}" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SEED"
fi

echo "Seeded: rodzic@mathshop.test / haslo123 (PIN rodzica: 1234)"
