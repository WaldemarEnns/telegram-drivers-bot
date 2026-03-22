# Product Requirements Document (PRD)
# Telegram Taxi Bot — V1

**Version:** 1.0
**Date:** March 22, 2026
**Status:** In Development

---

## 1. Overview

### 1.1 Purpose

A Telegram bot that connects riders with nearby drivers in real time. Drivers register, share their live location, and set their availability status. Riders share their location and receive a list of nearby available drivers sorted by distance, with options to call or WhatsApp them directly.

### 1.2 Scope (V1)

This is a minimal viable product. No web app, no payment processing, no ride booking flow. The bot acts as a discovery layer — riders find drivers, then contact them directly via phone or WhatsApp.

### 1.3 Out of Scope

- In-app ride booking or dispatch
- Payment processing or fare calculation
- Rating/review system
- Multi-language support
- Web or mobile companion app
- Push notifications beyond Telegram
- Ride history or tracking

---

## 2. User Roles

### 2.1 Rider

Any Telegram user who selects "I am a Rider" on first interaction. No registration required. Riders can search for nearby drivers and contact them directly.

### 2.2 Driver

A Telegram user who selects "I am a Driver" and completes the registration flow. Drivers must be approved by an admin before appearing in search results.

### 2.3 Admin

Operators identified by their Telegram user ID (configured in environment variables). Admins manage driver approvals, can disable drivers, and broadcast messages.

---

## 3. Functional Requirements

### 3.1 Bot Entry Point

| Action | Behavior |
|--------|----------|
| User sends `/start` | Bot shows role selection: "I am a Driver" / "I am a Rider" |
| `/start` with referral deep link (`?start=ref_XXXX`) | Stores referral code, then shows role selection |
| Returning registered driver sends `/start` | Skips role selection, shows driver menu directly |

### 3.2 Rider Flow

**FR-R1: Find Drivers**
- Rider taps "Find Drivers" button
- Bot requests rider's current location (one-time share, not live)
- Bot presents optional vehicle type filter (All / Car / Tuk / Van / SUV) via inline keyboard
- Bot queries database for nearby available drivers within configured radius
- Bot returns sorted list (nearest first), limited to top N results

**FR-R2: Driver Result Card**
Each result displays:
```
1. Sunil – 0.6 km
   🚗 Car | Seats: 4
   📞 Call | 💬 WhatsApp
```
- Name and distance in km (1 decimal)
- Vehicle type emoji + type + seat count
- Clickable call link (`tel:` URI) and WhatsApp link (`https://wa.me/`)

**FR-R3: No Results**
If no drivers are found, display: "No drivers found nearby. Try again later."

### 3.3 Driver Flow

**FR-D1: Registration**
Sequential conversational flow collecting:
1. Full name (text input)
2. Phone number with country code (text input, e.g., +94771234567)
3. Vehicle type (inline keyboard: Car / Tuk / Van / SUV)
4. Number of seats (numeric text input, validated 1–20)
5. Vehicle plate number (text input)

On completion:
- Driver record created in database with status "offline" and `is_approved = false`
- Unique 8-character referral code generated
- If registration originated from a referral link, the referral is tracked
- Driver notified that profile is pending admin approval

**FR-D2: Driver Menu**
Reply keyboard with buttons:
| Button | Action |
|--------|--------|
| 🟢 Go Online | Set status to "available", prompt for live location sharing |
| 🟡 Busy | Set status to "busy" (hidden from rider search) |
| 🔴 Go Offline | Set status to "offline" (hidden from rider search) |
| 👤 My Profile | Display current profile info + referral count |
| 🔗 Invite Drivers | Display unique referral/invite link |

**FR-D3: Go Online Flow**
1. Status updated to "available" in database
2. Bot sends a keyboard button requesting live location share
3. Driver taps and selects "Share Live Location for 8 hours" in Telegram
4. Bot receives initial location → stores in database → confirms
5. Subsequent live location updates (via `edited_message`) silently update the database
6. Driver is now visible in rider search results

**FR-D4: Status Management**
- Only approved and enabled drivers can go online
- Unapproved drivers see "Pending approval" message
- Disabled drivers see "Your account has been disabled"
- Status changes take effect immediately in search results

**FR-D5: My Profile**
Displays:
- Name, phone, vehicle type, seats, plate number
- Current status with colored indicator
- Approval status
- Referral code
- Total referral count

**FR-D6: Invite Drivers**
Displays:
- Deep link: `https://t.me/<bot_username>?start=ref_<code>`
- Current referral count

### 3.4 Admin Functions

All admin commands are restricted to Telegram IDs listed in the `ADMIN_IDS` environment variable.

| Command | Description |
|---------|-------------|
| `/admin_help` | List all admin commands |
| `/admin_drivers` | List all registered drivers with ID, name, status, approval state |
| `/approve <id>` | Approve a driver (enables them to go online); driver receives notification |
| `/disable <id>` | Disable a driver (sets offline, hidden from search) |
| `/enable <id>` | Re-enable a previously disabled driver |
| `/broadcast <message>` | Send a message to all registered drivers; reports delivery/failure count |

### 3.5 Referral System

- Each driver receives a unique 8-character hex referral code on registration
- Invite link format: `https://t.me/<bot_username>?start=ref_<code>`
- When a new driver registers via a referral link:
  - `referred_by` is set on the new driver's record
  - A row is inserted into the `referrals` table
- Drivers can view their referral count via "My Profile" or "Invite Drivers"
- V1 has no reward/incentive mechanism (tracking only)

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Nearby driver query must return in < 500ms for up to 1,000 active drivers
- PostGIS spatial index ensures O(log n) distance queries
- Bot should handle 50+ concurrent users without degradation

### 4.2 Reliability
- Bot process managed by PM2 (bare metal) or Docker restart policy
- Database uses persistent volume (Docker) or standard PG data directory
- Graceful error handling — individual handler failures don't crash the bot

### 4.3 Security
- Admin commands restricted by Telegram user ID whitelist
- No sensitive data exposed in rider search results (only name, distance, vehicle info, phone)
- Database credentials stored in environment variables, never in code
- Admin panel (if used) protected by secret token

### 4.4 Data Integrity
- Driver location entries older than `LOCATION_EXPIRY_HOURS` are excluded from search
- Unique constraints prevent duplicate driver registrations
- Referral self-loops prevented by design (referred_by references a different driver)

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Bot Framework | grammy.js |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| DB Admin UI | Adminer (web-based, for debugging & test verification) |
| Containerization | Docker + Docker Compose |
| Process Manager | PM2 (bare metal) or Docker restart policy |
| Admin Panel | Express.js (minimal, optional) |
| Hosting (Dev/Staging) | Coolify on Hetzner (developer's instance) |

### 5.2 Why These Choices

**grammy.js over Telegraf/node-telegram-bot-api:**
Modern, actively maintained, clean middleware pattern, native support for `edited_message` (critical for live location updates), conversation plugin for multi-step flows.

**PostgreSQL + PostGIS over MongoDB:**
Native geospatial indexing with `ST_DWithin()` and `ST_Distance()` makes the core "find nearby drivers" query a single indexed SQL call. MongoDB's `$geoNear` works but PostGIS is more mature and precise for distance calculations on a spheroid.

**Docker Compose:**
Single `docker compose up` spins up both PostgreSQL/PostGIS and the bot. No manual database installation. Consistent across dev and production.

**Adminer:**
Lightweight single-file PHP database admin UI, included as a Docker service. Used during development and stage testing to directly inspect and verify database state — driver records, location data, referral entries, approval flags. Accessible at `http://localhost:8080`. Not included in production/client deployment.

### 5.3 Database Schema

```
┌──────────────────────────────────────┐
│ drivers                              │
├──────────────────────────────────────┤
│ id              SERIAL PK            │
│ telegram_id     BIGINT UNIQUE        │
│ name            VARCHAR(100)         │
│ phone           VARCHAR(20)          │
│ vehicle_type    ENUM(car,tuk,van,suv)│
│ seats           INTEGER              │
│ vehicle_number  VARCHAR(20)          │
│ status          ENUM(avail,busy,off) │
│ location        GEOGRAPHY(POINT)     │
│ location_updated_at  TIMESTAMPTZ     │
│ is_approved     BOOLEAN              │
│ is_enabled      BOOLEAN              │
│ referral_code   VARCHAR(12) UNIQUE   │
│ referred_by     FK → drivers(id)     │
│ created_at      TIMESTAMPTZ          │
├──────────────────────────────────────┤
│ INDEXES: telegram_id, status,        │
│          location (GIST), referral   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ riders                               │
├──────────────────────────────────────┤
│ id              SERIAL PK            │
│ telegram_id     BIGINT UNIQUE        │
│ created_at      TIMESTAMPTZ          │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ referrals                            │
├──────────────────────────────────────┤
│ id                    SERIAL PK      │
│ referrer_driver_id    FK → drivers   │
│ referred_driver_id    FK → drivers   │
│ created_at            TIMESTAMPTZ    │
│ UNIQUE(referred_driver_id)           │
└──────────────────────────────────────┘
```

### 5.4 Core Query — Find Nearby Drivers

```sql
SELECT
  d.id, d.name, d.phone, d.vehicle_type, d.seats, d.vehicle_number,
  ROUND(ST_Distance(
    d.location,
    ST_MakePoint(:lng, :lat)::geography
  )::numeric, 0) AS distance_m
FROM drivers d
WHERE d.status = 'available'
  AND d.is_approved = true
  AND d.is_enabled = true
  AND d.location IS NOT NULL
  AND d.location_updated_at > NOW() - INTERVAL ':expiry hours'
  AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radius_m)
ORDER BY distance_m ASC
LIMIT :max_results;
```

`ST_DWithin` uses the GIST spatial index for fast bounding-box pre-filtering, then `ST_Distance` computes exact geodesic distance for sorting.

### 5.5 Project Structure

```
telegram-taxi-bot/
├── docker-compose.yml        # Dev: PostgreSQL + Bot + Adminer
├── docker-compose.prod.yml   # Production: PostgreSQL + Bot (no Adminer)
├── Dockerfile                # Bot container image
├── .env.example              # Environment template
├── .dockerignore
├── package.json
├── README.md
├── PRD.md                    # This document
└── src/
    ├── bot.js                # Entry point — wires handlers, middleware, starts bot
    ├── config.js             # Loads and validates environment variables
    ├── db/
    │   ├── connection.js     # PostgreSQL connection pool (pg)
    │   ├── migrate.js        # Migration runner
    │   └── migrations.sql    # Full schema DDL
    ├── handlers/
    │   ├── admin.js          # /approve, /disable, /broadcast, /admin_drivers
    │   ├── driver.js         # Registration flow, status, profile, location, referral
    │   ├── keyboards.js      # All keyboard definitions + text formatters
    │   └── rider.js          # Find drivers flow, filter, results display
    ├── middleware/
    │   └── auth.js           # loadDriver (per-request), adminOnly guard
    └── services/
        ├── drivers.js        # Driver CRUD (create, findByTelegramId, updateStatus, etc.)
        ├── location.js       # PostGIS geo queries (updateDriverLocation, findNearbyDrivers)
        └── referral.js       # Code generation, invite links, tracking, stats
```

---

## 6. Deployment

### 6.1 Development (Local Docker)

Primary development environment. Includes Adminer for database inspection.

```bash
# 1. Clone the repo
git clone <repo_url> && cd telegram-taxi-bot

# 2. Configure environment
cp .env.example .env
# Edit .env: set BOT_TOKEN, ADMIN_IDS, DB_PASSWORD

# 3. Start everything (bot + PostgreSQL + Adminer)
docker compose up -d

# 4. Verify
docker compose logs -f bot

# 5. Inspect database via Adminer
# Open http://localhost:8080
# System: PostgreSQL | Server: db | User: taxibot | Password: <DB_PASSWORD> | Database: taxi_bot
```

This starts PostgreSQL with PostGIS, the bot, and Adminer. The database migration runs automatically on bot startup.

**Adminer usage during testing:**
Adminer is the primary tool for verifying stage deliverables at the database level. Use it to:
- Confirm driver records are created correctly after registration (Stage 2)
- Verify location coordinates update on live location share (Stage 2)
- Check that status changes persist (Stage 2)
- Validate distance query results by inspecting raw location data (Stage 3)
- Confirm referral rows are inserted when a referred driver registers (Stage 4)
- Verify approval/disable flags after admin commands (Stage 5)

Direct SQL can also be run in Adminer's SQL tab for ad-hoc checks, e.g.:
```sql
-- Check all drivers with their location and status
SELECT id, name, status, is_approved, ST_AsText(location::geometry) as coords, location_updated_at
FROM drivers ORDER BY id;
```

### 6.2 Staging (Coolify on Hetzner)

Once all stages are implemented and locally verified, the project is deployed to the developer's private Coolify instance for client testing. This is the **last step before final delivery** — the client tests against the staging deployment, not the local dev environment.

**Deployment flow:**
1. Push final code to a Git repository (GitHub/Gitea)
2. In Coolify, create a new project with a Docker Compose resource pointing to the repo
3. Configure environment variables in Coolify's UI (BOT_TOKEN, ADMIN_IDS, DB_PASSWORD, etc.)
4. Coolify builds and deploys the containers automatically
5. Adminer is accessible via Coolify's auto-generated domain (protected — dev use only)
6. Client receives the bot's Telegram handle to begin testing

**Why Coolify for staging:**
- Developer already has a running Coolify instance on Hetzner — no extra infra cost
- Coolify handles SSL, reverse proxy, and container management
- Easy to tear down after project handoff
- Client tests against a real server, not localhost — catches environment-specific issues

**Important:** The Coolify staging deployment is temporary. After client approval and final payment, the source code and setup instructions are delivered to the client for deployment on their own server. The Coolify instance is torn down.

### 6.3 Production (Client's Server)

Final delivery to the client's own server. Adminer is **not** included in the production compose file — the client receives a stripped-down `docker-compose.prod.yml` or deploys bare metal.

**Option A: Docker (Recommended)**
```bash
# Client's server
git clone <repo_url> && cd telegram-taxi-bot
cp .env.example .env && nano .env
docker compose -f docker-compose.prod.yml up -d
```

**Option B: Bare Metal**
```bash
# Install Node.js 18+, PostgreSQL 16+, PostGIS
sudo apt install -y nodejs postgresql postgis

# Create database
sudo -u postgres psql -c "CREATE USER taxibot WITH PASSWORD 'password';"
sudo -u postgres psql -c "CREATE DATABASE taxi_bot OWNER taxibot;"
sudo -u postgres psql -d taxi_bot -c "CREATE EXTENSION postgis;"

# Deploy
npm install
cp .env.example .env && nano .env
npm start

# Keep running
pm2 start src/bot.js --name taxi-bot
pm2 save && pm2 startup
```

---

## 7. Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | — | Telegram bot token from @BotFather |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ADMIN_IDS` | Yes | — | Comma-separated Telegram user IDs for admin access |
| `DB_PASSWORD` | Docker only | `taxibot_dev_password` | PostgreSQL password (used in docker-compose) |
| `SEARCH_RADIUS_KM` | No | `10` | Maximum radius for rider search (km) |
| `MAX_RESULTS` | No | `10` | Maximum drivers returned per search |
| `LOCATION_EXPIRY_HOURS` | No | `1` | Exclude drivers who haven't updated location in N hours |
| `ADMIN_PORT` | No | `3000` | Port for optional admin panel |
| `ADMIN_SECRET` | No | `change_this` | Auth token for admin panel |

---

## 8. Delivery Stages & Testing Criteria

### Stage 1: Basic Bot Setup
**Deliverables:**
- Bot responds to `/start`
- Role selection keyboard (Driver / Rider)
- Driver menu and Rider menu display correctly
- Menus persist across messages

**Test criteria:**
- `/start` shows two role buttons
- Selecting "Driver" shows driver menu (5 buttons)
- Selecting "Rider" shows rider menu (1 button)
- Bot responds to all menu buttons (even if functionality is placeholder)

### Stage 2: Driver System
**Deliverables:**
- Full registration flow (name → phone → vehicle → seats → plate)
- Input validation (seats 1–20, required fields)
- Status toggling (Online / Busy / Offline)
- Live location sharing and background updates
- Location stored in PostGIS and updates on `edited_message`

**Test criteria:**
- New driver can register with all fields
- Duplicate registration is prevented
- Status changes reflect immediately in database (verify via Adminer → `drivers` table)
- Live location updates are stored (verify via Adminer: `SELECT ST_AsText(location::geometry), location_updated_at FROM drivers`)
- Unapproved driver cannot go online

### Stage 3: Rider Search
**Deliverables:**
- Rider shares location → receives nearby drivers
- Distance calculation is accurate (PostGIS geodesic)
- Results sorted by distance ascending
- Driver card format matches spec (name, distance, type, seats, call/WhatsApp)
- "No drivers found" message when none are available

**Test criteria:**
- With 2+ test drivers online at known locations, verify distances are correct (±50m)
- Verify sort order (nearest first)
- Verify driver who went offline does NOT appear
- Verify unapproved driver does NOT appear
- Call and WhatsApp links work correctly

### Stage 4: Core Features
**Deliverables:**
- Vehicle type filter on rider search
- Referral link generation per driver
- Referral tracking (new driver registered via link → counted)
- Driver profile display with all info

**Test criteria:**
- Filter by "Car" shows only cars
- Filter by "All" shows all types
- Referral link opens bot with correct deep link parameter
- New driver registering via link → referrer's count increments
- Profile shows accurate data

### Stage 5: Final Delivery
**Deliverables:**
- Admin commands: `/admin_drivers`, `/approve`, `/disable`, `/enable`, `/broadcast`
- Non-admin users are blocked from admin commands
- Bug fixes from all prior stages
- Full end-to-end flow works

**Test criteria:**
- Admin can list, approve, disable drivers
- Approved driver receives notification
- Broadcast delivers to all drivers, reports count
- Non-admin gets "not authorized" for admin commands
- Full flow: driver registers → admin approves → driver goes online → rider finds driver

### Stage 6: Staging Deployment & Client Testing
**Deliverables:**
- Project deployed to developer's Coolify instance (Hetzner)
- Bot is live and accessible via Telegram
- Client receives bot handle for testing
- Adminer available for developer to debug any client-reported issues
- `docker-compose.prod.yml` prepared for client's own server

**Test criteria (client performs):**
- Client can interact with the bot on Telegram (all roles)
- Full end-to-end flow works on a real server (not localhost)
- Client confirms all 5 functional stages pass
- Any bugs found are fixed and re-deployed via Coolify

**After client approval:**
- Source code delivered to client (GitHub repo or zip)
- `docker-compose.prod.yml` + setup instructions provided
- Coolify staging deployment torn down

---

## 9. Assumptions & Constraints

- Telegram's live location sharing lasts up to 8 hours; drivers need to re-share after expiry
- Distance calculations use geodesic (great circle) distance, accurate to within meters
- Bot uses long polling (not webhooks) for simplicity; sufficient for V1 scale
- No rate limiting implemented in V1; Telegram's own limits apply (~30 msgs/sec)
- Role selection is one-time per `/start`; a user cannot be both rider and driver simultaneously in the same session (but can restart and pick the other role)
- The client's server must support Docker or have Node.js 18+ and PostgreSQL 16+ with PostGIS

---

## 10. Future Considerations (Post-V1)

These are explicitly out of scope but noted for context:
- Webhook mode for higher throughput
- Ride booking with fare estimation
- Driver rating system
- Multi-language (i18n)
- Web-based admin dashboard
- Payment integration
- Ride history and analytics
- Auto-approve for referred drivers
- Driver earnings tracking tied to referrals