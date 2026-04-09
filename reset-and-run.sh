#!/bin/bash
set -e

# ExterminApp - Reset, Pull, Setup & Run
#
# Destroys all local state (containers, DB volume, build artifacts,
# uncommitted git changes), fetches and checks out the requested git
# ref, reinstalls dependencies, runs migrations + seed, then starts
# the dev server.
#
# Usage:
#   ./reset-and-run.sh                    # defaults to claude/v0.3.0
#   ./reset-and-run.sh main               # checkout main
#   ./reset-and-run.sh some-branch -y     # skip confirmation prompt
#   ./reset-and-run.sh -y some-tag
#
# WARNING: this is destructive. It will:
#   - docker compose down -v (deletes the DB volume)
#   - git reset --hard (discards uncommitted changes)
#   - git clean -fd (removes untracked files)

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# -----------------------------------------------
# Parse args
# -----------------------------------------------
REF="claude/v0.3.0"
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help)
      sed -n '3,22p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo -e "${RED}Unknown flag: $arg${NC}"
      exit 1
      ;;
    *) REF="$arg" ;;
  esac
done

echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  ExterminApp - Reset, Pull & Run${NC}"
echo -e "${BOLD}========================================${NC}"
echo -e "  Target ref: ${BOLD}${REF}${NC}"
echo -e "  Project:    ${PROJECT_DIR}"
echo ""

if [ "$ASSUME_YES" -ne 1 ]; then
  echo -e "${YELLOW}This will DESTROY:${NC}"
  echo "  - the Postgres container and its volume (all DB data)"
  echo "  - any uncommitted git changes and untracked files"
  echo "  - .next build artifacts and caches"
  echo ""
  read -r -p "Continue? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# -----------------------------------------------
# 1. Stop running services
# -----------------------------------------------
echo -e "${YELLOW}[1/8] Stopping services...${NC}"

pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

docker compose down -v 2>/dev/null || docker-compose down -v 2>/dev/null || true

echo -e "${GREEN}  ✓ Services stopped${NC}"

# -----------------------------------------------
# 2. Clean build artifacts
# -----------------------------------------------
echo -e "${YELLOW}[2/8] Cleaning build artifacts...${NC}"

rm -rf apps/web/.next
rm -rf apps/web/node_modules/.cache
rm -rf .turbo
rm -rf node_modules/.cache

echo -e "${GREEN}  ✓ Build artifacts cleaned${NC}"

# -----------------------------------------------
# 3. Fetch + checkout requested ref
# -----------------------------------------------
echo -e "${YELLOW}[3/8] Fetching and checking out ${BOLD}${REF}${NC}${YELLOW}...${NC}"

git fetch --all --prune --tags

# Discard any uncommitted work before switching
git reset --hard HEAD
git clean -fd

# If the ref matches a remote branch, check it out as a tracking branch;
# otherwise fall back to a detached checkout (works for tags and SHAs).
if git show-ref --verify --quiet "refs/remotes/origin/${REF}"; then
  git checkout -B "${REF}" "origin/${REF}"
  git reset --hard "origin/${REF}"
else
  git checkout --detach "${REF}"
fi

echo -e "${GREEN}  ✓ Now on $(git describe --all --always)${NC}"

# -----------------------------------------------
# 4. Install dependencies
# -----------------------------------------------
echo -e "${YELLOW}[4/8] Installing dependencies...${NC}"

npm install

echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# -----------------------------------------------
# 5. Ensure .env exists
# -----------------------------------------------
echo -e "${YELLOW}[5/8] Checking environment file...${NC}"

if [ ! -f apps/web/.env ]; then
  if [ -f .env.example ]; then
    cp .env.example apps/web/.env
    echo -e "${GREEN}  ✓ Created apps/web/.env from .env.example${NC}"
  else
    cat > apps/web/.env <<'EOF'
DATABASE_URL=postgresql://dev:dev@localhost:5432/exterminapp
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-change-in-production-please
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    echo -e "${GREEN}  ✓ Created apps/web/.env with defaults${NC}"
  fi
else
  echo -e "${GREEN}  ✓ apps/web/.env already exists${NC}"
fi

# -----------------------------------------------
# 6. Start PostgreSQL
# -----------------------------------------------
echo -e "${YELLOW}[6/8] Starting PostgreSQL database...${NC}"

docker compose up -d db

echo -n "  Waiting for database"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U dev -d exterminapp >/dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}  ✓ Database is ready${NC}"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo ""
    echo -e "${RED}  ✗ Database failed to start after 30s${NC}"
    echo "  Check: docker compose logs db"
    exit 1
  fi
done

# -----------------------------------------------
# 7. Migrate + seed
# -----------------------------------------------
echo -e "${YELLOW}[7/8] Running migrations and seeding...${NC}"

(
  cd apps/web
  npx drizzle-kit migrate
  npx tsx drizzle/seed.ts
)

echo -e "${GREEN}  ✓ Database migrated and seeded${NC}"

# -----------------------------------------------
# 8. Run dev server (foreground)
# -----------------------------------------------
echo -e "${YELLOW}[8/8] Starting dev server...${NC}"
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Ready!${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "  URL:    ${BOLD}http://localhost:3000${NC}"
echo -e "  Admin:  ${BOLD}admin@exterminapp.com${NC} / ${BOLD}admin123${NC}"
echo -e "  Tech:   ${BOLD}tech@exterminapp.com${NC}  / ${BOLD}tech1234${NC}"
echo ""
echo -e "  Press Ctrl+C to stop the dev server."
echo ""

exec npm run dev
