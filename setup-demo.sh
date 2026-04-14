#!/bin/bash
set -e

# ExterminApp - Demo Setup Script
# Wipes the database and reseeds it with Helsinki-area demo data
# (customers, sites, work orders, traps, visits, poison additions).
#
# Use this when you want a populated demo environment to explore the app.
# Unlike setup.sh, this does NOT reinstall dependencies or recreate the
# Docker volume — it assumes the stack is already installed. It just makes
# sure the DB is running, applies any pending migrations, and runs the
# demo seed (which TRUNCATEs all tables before inserting fresh data).

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  ExterminApp - Demo Data Setup${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# -----------------------------------------------
# 1. Ensure environment file exists
# -----------------------------------------------
echo -e "${YELLOW}[1/4] Checking environment...${NC}"

if [ ! -f apps/web/.env ]; then
  if [ -f .env.example ]; then
    cp .env.example apps/web/.env
    echo -e "${GREEN}  ✓ Created apps/web/.env from .env.example${NC}"
  else
    echo -e "${RED}  ✗ apps/web/.env not found and no .env.example to copy${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}  ✓ apps/web/.env exists${NC}"
fi

# -----------------------------------------------
# 2. Start PostgreSQL (if not already running)
# -----------------------------------------------
echo -e "${YELLOW}[2/4] Starting PostgreSQL database...${NC}"

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
# 3. Apply migrations
# -----------------------------------------------
echo -e "${YELLOW}[3/4] Applying database migrations...${NC}"

cd apps/web
npx drizzle-kit migrate
echo -e "${GREEN}  ✓ Migrations applied${NC}"

# -----------------------------------------------
# 4. Run demo seed (wipes + populates)
# -----------------------------------------------
echo -e "${YELLOW}[4/4] Seeding demo data...${NC}"

npx tsx drizzle/seed-demo.ts

cd "$PROJECT_DIR"

# -----------------------------------------------
# Done!
# -----------------------------------------------
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Demo setup complete!${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "  Start the dev server with:"
echo -e "    ${BOLD}cd $PROJECT_DIR && npm run dev${NC}"
echo ""
echo -e "  Then open: ${BOLD}http://localhost:3000${NC}"
echo ""
echo -e "  Login credentials:"
echo -e "    Admin: ${BOLD}admin@exterminapp.com${NC}  / ${BOLD}admin123${NC}"
echo -e "    Tech:  ${BOLD}tech@exterminapp.com${NC}   / ${BOLD}tech1234${NC}"
echo -e "    Tech:  ${BOLD}tech2@exterminapp.com${NC}  / ${BOLD}tech1234${NC}"
echo ""
