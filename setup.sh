#!/bin/bash
set -e

# ExterminApp - Full Reset & Setup Script for WSL
# Stops services, deletes database, reinstalls everything, and starts fresh.

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  ExterminApp - Full Reset & Setup${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# -----------------------------------------------
# 1. Stop running services
# -----------------------------------------------
echo -e "${YELLOW}[1/7] Stopping services...${NC}"

# Kill any running Next.js dev server
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

# Stop and remove Docker containers + volumes (deletes DB data)
docker compose down -v 2>/dev/null || docker-compose down -v 2>/dev/null || true

echo -e "${GREEN}  ✓ Services stopped${NC}"

# -----------------------------------------------
# 2. Clean build artifacts
# -----------------------------------------------
echo -e "${YELLOW}[2/7] Cleaning build artifacts...${NC}"

rm -rf apps/web/.next
rm -rf apps/web/node_modules/.cache
rm -rf .turbo
rm -rf node_modules/.cache

echo -e "${GREEN}  ✓ Build artifacts cleaned${NC}"

# -----------------------------------------------
# 3. Install dependencies
# -----------------------------------------------
echo -e "${YELLOW}[3/7] Installing dependencies...${NC}"

npm install

echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# -----------------------------------------------
# 4. Set up environment file
# -----------------------------------------------
echo -e "${YELLOW}[4/7] Setting up environment...${NC}"

if [ ! -f apps/web/.env ]; then
  cp .env.example apps/web/.env
  echo -e "${GREEN}  ✓ Created apps/web/.env from .env.example${NC}"
else
  echo -e "${GREEN}  ✓ apps/web/.env already exists${NC}"
fi

# -----------------------------------------------
# 5. Start PostgreSQL + PostGIS
# -----------------------------------------------
echo -e "${YELLOW}[5/7] Starting PostgreSQL database...${NC}"

docker compose up -d db

# Wait for DB to be ready
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
# 6. Run migrations and seed
# -----------------------------------------------
echo -e "${YELLOW}[6/7] Running database migrations...${NC}"

cd apps/web
npx drizzle-kit migrate
echo -e "${GREEN}  ✓ Migrations applied${NC}"

echo -e "${YELLOW}[7/7] Seeding database...${NC}"

npx tsx drizzle/seed.ts
echo -e "${GREEN}  ✓ Database seeded${NC}"

cd "$PROJECT_DIR"

# -----------------------------------------------
# Done!
# -----------------------------------------------
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Setup complete!${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "  Start the dev server with:"
echo -e "    ${BOLD}cd $PROJECT_DIR && npm run dev${NC}"
echo ""
echo -e "  Then open: ${BOLD}http://localhost:3000${NC}"
echo ""
echo -e "  Login credentials:"
echo -e "    Admin: ${BOLD}admin@exterminapp.com${NC} / ${BOLD}admin123${NC}"
echo -e "    Tech:  ${BOLD}tech@exterminapp.com${NC}  / ${BOLD}tech1234${NC}"
echo ""
