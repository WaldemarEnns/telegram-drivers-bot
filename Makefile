.PHONY: help install build dev up down restart logs logs-db shell-bot shell-db adminer seed reset test test-watch test-coverage test-db-create test-db-drop shell-test-db

# Default target
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Setup"
	@echo "  install        Install npm dependencies"
	@echo "  build          Compile TypeScript → dist/"
	@echo ""
	@echo "Docker (dev)"
	@echo "  up             Start all containers (db + bot + adminer)"
	@echo "  down           Stop and remove containers"
	@echo "  restart        Rebuild bot image and restart it"
	@echo "  logs           Tail bot logs"
	@echo "  logs-db        Tail database logs"
	@echo ""
	@echo "Database"
	@echo "  shell-db       Open psql session in the db container"
	@echo "  adminer        Print Adminer URL"
	@echo "  seed           Insert test drivers around Rastatt, Germany"
	@echo "  reset          Drop all data and re-seed"
	@echo ""
	@echo "Local dev (no Docker)"
	@echo "  dev            Run bot directly with ts-node (requires local Postgres)"
	@echo "  shell-bot      Open a shell in the running bot container"
	@echo ""
	@echo "Testing (requires db container running)"
	@echo "  test           Run all tests once"
	@echo "  test-watch     Re-run tests on file change"
	@echo "  test-coverage  Run tests with coverage report"
	@echo "  test-db-create Create taxi_bot_test database manually"
	@echo "  test-db-drop   Drop taxi_bot_test database"
	@echo "  shell-test-db  Open psql session in taxi_bot_test"

# ── Setup ────────────────────────────────────────────────────────────────────

install:
	npm install

build:
	npm run build

# ── Docker ───────────────────────────────────────────────────────────────────

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose up -d --build bot

logs:
	docker compose logs -f bot

logs-db:
	docker compose logs -f db

shell-bot:
	docker exec -it taxi-bot-app sh

# ── Database ─────────────────────────────────────────────────────────────────

shell-db:
	docker exec -it taxi-bot-db psql -U taxibot -d taxi_bot

adminer:
	@echo "Adminer: http://localhost:8080"
	@echo "  System:   PostgreSQL"
	@echo "  Server:   db"
	@echo "  Username: taxibot"
	@echo "  Password: taxibot_dev_password"
	@echo "  Database: taxi_bot"

seed:
	docker exec -i taxi-bot-db psql -U taxibot -d taxi_bot < src/db/seed.sql

reset:
	docker exec -i taxi-bot-db psql -U taxibot -d taxi_bot -c \
	  "DELETE FROM referrals; DELETE FROM drivers WHERE telegram_id BETWEEN 1000000001 AND 1000000007;"
	$(MAKE) seed

# ── Local dev ────────────────────────────────────────────────────────────────

dev:
	npm run dev

# ── Testing ───────────────────────────────────────────────────────────────────

test:
	@echo "Requires db container: make up"
	npx vitest run

test-watch:
	npx vitest

test-coverage:
	npx vitest run --coverage

test-db-create:
	docker exec -i taxi-bot-db psql -U taxibot -d taxi_bot \
	  -c "CREATE DATABASE taxi_bot_test OWNER taxibot;" || true

test-db-drop:
	docker exec -i taxi-bot-db psql -U taxibot -d taxi_bot \
	  -c "DROP DATABASE IF EXISTS taxi_bot_test;"

shell-test-db:
	docker exec -it taxi-bot-db psql -U taxibot -d taxi_bot_test
