# Telegram Taxi Bot

A Telegram bot that connects riders with nearby drivers in real time. Drivers register, share their live location, and manage their availability. Riders share their location and instantly see a sorted list of nearby drivers with direct call and WhatsApp links — no in-app booking, no payment processing.

---

## Project Overview

**Who it's for:** Independent taxi/tuk/van/SUV drivers and their riders in a local market.

**How it works:**
- Drivers register once, wait for admin approval, then go online by sharing their live location
- Riders share their location and see the nearest available drivers sorted by distance
- Contact happens directly via phone or WhatsApp — the bot is a discovery layer only

**V1 scope:** Registration, geo search, referral tracking, admin approval/broadcast. No booking flow, no payments, no ratings.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Telegram                                                │
│  Long polling (getUpdates) ←──────────────── Bot        │
│  edited_message:location ──────────────────► Bot        │
└─────────────────────────────────────────────────────────┘
                        │
              ┌─────────▼──────────┐
              │    src/bot.ts      │  Entry point
              │  Middleware chain  │  session → conversations
              │                   │  → loadDriver → handlers
              └─────────┬──────────┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
  handlers/         handlers/        handlers/
  driver.ts         rider.ts         admin.ts
  (registration,    (location,       (/approve,
   status, profile,  filter,          /disable,
   invite)           results)         /broadcast)
        │               │                │
        └───────────────┼────────────────┘
                        │
              ┌─────────▼──────────┐
              │     services/      │
              │  drivers.ts        │  CRUD
              │  location.ts       │  PostGIS queries
              │  referral.ts       │  Invite links
              │  riders.ts         │  Rider persistence
              │  jobs.ts           │  Background expiry jobs
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  PostgreSQL 16     │
              │  + PostGIS 3.4     │
              │                   │
              │  drivers           │
              │  riders            │
              │  referrals         │
              └────────────────────┘
```

**Key technical decisions:**

| Choice | Reason |
|--------|--------|
| **grammy.js** | Native `edited_message` support for live location updates; clean middleware pattern; conversations plugin for multi-step registration |
| **PostgreSQL + PostGIS** | `ST_DWithin` + GIST spatial index makes the "find nearby" query O(log n); geodesic accuracy within metres |
| **Long polling** | Simple, no webhook infrastructure needed for V1 scale |
| **Docker Compose** | Single command spins up PostgreSQL/PostGIS + bot + Adminer; identical across dev and prod |

---

## Project Structure

```
src/
├── bot.ts                  # Entry point — middleware chain, /start, edited_message
├── config.ts               # Env var validation and config object
├── types.ts                # Shared BotContext type
├── db/
│   ├── connection.ts       # pg.Pool singleton
│   ├── migrate.ts          # Migration runner (runs on startup)
│   └── migrations.sql      # Idempotent schema DDL
├── handlers/
│   ├── admin.ts            # /approve /disable /enable /broadcast /admin_drivers
│   ├── driver.ts           # Registration conversation, status buttons, profile
│   ├── keyboards.ts        # All keyboards + driver card / profile formatters
│   └── rider.ts            # Location share, search, vehicle filter
├── middleware/
│   └── auth.ts             # loadDriver (per-request) + adminOnly guard
└── services/
    ├── drivers.ts          # Driver CRUD
    ├── jobs.ts             # Background: expiry reset + reminder notifications
    ├── location.ts         # PostGIS updateDriverLocation + findNearbyDrivers
    ├── referral.ts         # Code generation, invite links, tracking
    └── riders.ts           # Rider upsert
```

---

## How It Works

### For Drivers

**First time — Registration**

1. Open the bot and send `/start`
2. Tap **🚗 I am a Driver**
3. The bot walks you through registration step by step:
   - Your full name
   - Phone number with country code (e.g. `+94771234567`)
   - Vehicle type (Car / Tuk / Van / SUV)
   - Number of seats
   - Vehicle plate number
4. After registration you will see: *"Your profile is pending admin approval."*
5. Once an admin approves you, you receive a notification and can go online

**Daily use — Going online**

1. Tap **🟢 Go Online**
2. The bot asks you to share your live location
3. In the Telegram mobile app: tap the 📎 attachment icon → **Location** → **Share Live Location** → select duration (up to 8 hours)
4. You are now visible to riders — Telegram updates your location automatically every ~30 seconds in the background

**Status buttons**

| Button | What it does |
|--------|-------------|
| 🟢 Go Online | Makes you visible to riders — requires live location share |
| 🟡 Busy | Hides you from rider search while you are on a trip |
| 🔴 Go Offline | Hides you from rider search entirely |
| 👤 My Profile | Shows your registration details, current status, and referral count |
| 🔗 Invite Drivers | Gives you a personal invite link to share with other drivers |

**Location expiry**

- Your live location lasts up to 8 hours (Telegram limit)
- You receive a reminder notification ~1 hour before it expires
- If it expires without renewal, your status is automatically set to Offline and you are notified
- To become visible again, tap **🟢 Go Online** and re-share your live location

**Invite other drivers**

- Tap **🔗 Invite Drivers** to get your personal referral link
- Share the link with other drivers — when they register via your link, they are counted as your referral
- View your referral count anytime in **👤 My Profile**

---

### For Riders

No registration required. Just start the bot and search.

1. Send `/start` and tap **🙋 I am a Rider**
2. Tap **🔍 Find Drivers**
3. The bot asks you to share your location — tap the 📎 attachment icon → **Location** → **Send Your Current Location**
4. You instantly see the nearest available drivers sorted by distance:

```
Drivers near you (All):

1. Sunil – 0.6 km
   🚗 Car | Seats: 4
   📞 Call | 💬 WhatsApp

2. Kasun – 1.2 km
   🛺 Tuk | Seats: 3
   📞 Call | 💬 WhatsApp
```

5. Tap **📞 Call** or **💬 WhatsApp** to contact the driver directly
6. Use the filter buttons to narrow by vehicle type: **All · Car · Tuk · Van · SUV** — filtering re-uses your shared location, no need to share it again

**Important:** The bot shows only drivers who are currently online and have shared their live location recently. If no drivers appear, try again in a few minutes.

---

### For Admins

Your Telegram user ID must be listed in the `ADMIN_IDS` environment variable. All commands are sent directly in your bot chat — they are silently blocked for non-admin users.

**Typical workflow**

```
New driver registers
       │
       ▼
/admin_drivers          ← see the new driver and their ID
       │
       ▼
/approve <id>           ← driver is notified and can go online
       │
       ▼
(monitor ongoing)
       │
  ┌────┴────┐
  ▼         ▼
/disable   /enable      ← if a driver causes issues or returns
```

**Command reference**

---

#### `/admin_help`
Lists all available admin commands in the chat. Use this as a quick reference at any time.

---

#### `/admin_drivers`
Shows all registered drivers with their current state.

```
Registered Drivers (3)

[1] Sunil | CAR | available | ✅
[2] Kasun | TUK | offline   | ✅
[3] Priya | VAN | offline   | ⏳
```

Column meanings:
- `[id]` — the ID used in all other commands
- `available / busy / offline` — current status
- `✅` — approved and enabled
- `⏳` — registered but not yet approved
- `🚫` — disabled

---

#### `/approve <id>`

Approves a pending driver. They receive an instant notification and can immediately tap **🟢 Go Online**.

```
/approve 3
```

> Use `/admin_drivers` first to get the correct ID.

---

#### `/disable <id>`

Disables a driver. Their status is immediately set to Offline and they disappear from all rider searches. The driver receives a notification. Use this for drivers who violate rules or need to be suspended.

```
/disable 2
```

A disabled driver cannot go online until re-enabled. They see *"Your account has been disabled"* when they try.

---

#### `/enable <id>`

Re-enables a previously disabled driver. They receive a notification and can go online again.

```
/enable 2
```

---

#### `/broadcast <message>`

Sends a message to every registered driver. Useful for announcements, rule reminders, or service updates. The bot reports how many messages were delivered and how many failed (e.g. drivers who have blocked the bot).

```
/broadcast Tomorrow the service will be unavailable from 2–4pm for maintenance.
```

```
📢 Broadcast complete.
Delivered: 12 | Failed: 1
```

---

## Setup Instructions

### Prerequisites

- Node.js 22+
- Docker and Docker Compose

### 1. Clone and install

```bash
git clone <repo_url>
cd telegram-drivers-bot
npm install
```

### 2. Create your Telegram bot

1. Open Telegram and message `@BotFather`
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
BOT_TOKEN=your_token_from_botfather
ADMIN_IDS=your_telegram_user_id
```

> **Tip:** To find your Telegram user ID, message `@userinfobot` on Telegram.

---

## Deployment with Docker Compose

### Development (with Adminer)

Starts PostgreSQL/PostGIS, the bot, and Adminer (database admin UI at `http://localhost:8080`).

```bash
docker compose up -d --build
```

**Verify everything is running:**

```bash
docker compose ps
docker compose logs -f bot
```

**Adminer login** — open `http://localhost:8080`:
- System: `PostgreSQL`
- Server: `db`
- Username: `taxibot`
- Password: value of `DB_PASSWORD` in your `.env` (default: `taxibot_dev_password`)
- Database: `taxi_bot`

### Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The production compose file excludes Adminer and does not expose the database port.

### Stopping

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers and delete database volume
```

### Rebuilding after code changes

```bash
docker compose up -d --build bot
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | — | Telegram bot token from @BotFather |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ADMIN_IDS` | Yes | — | Comma-separated Telegram user IDs for admin access |
| `DB_PASSWORD` | Docker only | `taxibot_dev_password` | PostgreSQL password used in docker-compose |
| `SEARCH_RADIUS_KM` | No | `10` | Maximum search radius for riders (km) |
| `MAX_RESULTS` | No | `10` | Maximum drivers shown per search |
| `LOCATION_EXPIRY_HOURS` | No | `1` | Exclude drivers with no location update in N hours |

---

## Admin Commands

Send these from your Telegram account (your ID must be in `ADMIN_IDS`):

| Command | Description |
|---------|-------------|
| `/admin_help` | List all admin commands |
| `/admin_drivers` | List all registered drivers with status and approval state |
| `/approve <id>` | Approve a driver — they are notified and can go online |
| `/disable <id>` | Disable a driver — set offline, hidden from search |
| `/enable <id>` | Re-enable a previously disabled driver |
| `/broadcast <message>` | Send a message to all registered drivers |

---

## Troubleshooting

**Bot not responding**
Check the token is correct and the container is running:
```bash
docker compose logs bot
```

**No drivers found in search**
Drivers must be: approved (`/approve <id>`), have status `available` (Go Online tapped), and have shared live location within the last `LOCATION_EXPIRY_HOURS` hour(s).

**Migration fails on startup**
Ensure PostGIS is available. With Docker Compose this is automatic — the bot waits for the `db` container to be healthy before starting.

**Live location not updating**
Drivers must share **live** location (not a static pin). In the Telegram mobile app: tap the 📎 attachment icon → Location → Share Live Location → select duration.

---

## License

MIT
