# Database Reference

PostgreSQL 16 with the PostGIS 3.4 extension. The schema is applied automatically on bot startup via `src/db/migrate.ts` — the migration file (`src/db/migrations.sql`) is fully idempotent and safe to run multiple times.

---

## ENUMs

### `vehicle_type`
```
'car' | 'tuk' | 'van' | 'suv'
```
Used on the `drivers.vehicle_type` column. Set during registration and editable via the profile editor.

### `driver_status`
```
'available' | 'busy' | 'offline'
```
Used on the `drivers.status` column. Controlled by the driver's menu buttons and reset automatically by the background expiry job.

---

## Tables

### `drivers`

The central table. One row per registered driver.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | No | auto | Primary key |
| `telegram_id` | `BIGINT` | No | — | Telegram user ID — unique, used as the lookup key on every update |
| `name` | `VARCHAR(100)` | No | — | Driver's full name |
| `phone` | `VARCHAR(20)` | No | — | Phone number with country code (e.g. `+94771234567`) |
| `vehicle_type` | `vehicle_type` | No | — | ENUM: `car`, `tuk`, `van`, `suv` |
| `seats` | `INTEGER` | No | — | Seat count, validated 1–20 |
| `vehicle_number` | `VARCHAR(20)` | No | — | Vehicle plate number |
| `status` | `driver_status` | No | `offline` | Current availability: `available`, `busy`, `offline` |
| `location` | `GEOGRAPHY(POINT, 4326)` | Yes | `NULL` | Last known position as a PostGIS geography point (WGS84). Stored as `ST_MakePoint(longitude, latitude)` — longitude first |
| `location_updated_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp of the last location update (refreshed every ~30s by Telegram live location) |
| `location_share_started_at` | `TIMESTAMPTZ` | Yes | `NULL` | Set once when the driver first shares live location after going online. Used by the background job to track the 8-hour Telegram live location window and send the 1-hour expiry reminder |
| `is_approved` | `BOOLEAN` | No | `false` | Set to `true` by an admin via `/approve`. Drivers cannot go online until approved |
| `is_enabled` | `BOOLEAN` | No | `true` | Set to `false` by an admin via `/disable`. Disabled drivers are hidden from search and cannot go online |
| `referral_code` | `VARCHAR(12)` | No | — | Unique 8-character hex code generated on registration. Used to build invite links |
| `referred_by` | `INTEGER` | Yes | `NULL` | FK → `drivers.id` of the driver who referred this driver. Set at registration if a referral deep link was used |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Registration timestamp |

**Indexes:**

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `idx_drivers_telegram_id` | B-tree | `telegram_id` | Fast lookup on every incoming update via `loadDriver` middleware |
| `idx_drivers_status` | B-tree | `status` | Filters `available` drivers in the nearby search |
| `idx_drivers_location` | GIST | `location` | Spatial index — enables `ST_DWithin` bounding-box pre-filter for O(log n) geo queries |
| `idx_drivers_referral_code` | B-tree | `referral_code` | Fast referral deep link lookup on `/start ref_XXXX` |

**Visibility rule:** A driver appears in rider search results only when all of the following are true:
- `status = 'available'`
- `is_approved = true`
- `is_enabled = true`
- `location IS NOT NULL`
- `location_updated_at > NOW() - INTERVAL 'LOCATION_EXPIRY_HOURS hours'`

---

### `riders`

One row per Telegram user who has identified as a rider. Persisted on first role selection.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | No | auto | Primary key |
| `telegram_id` | `BIGINT` | No | — | Telegram user ID |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | First seen timestamp |

Inserted with `ON CONFLICT DO NOTHING` — safe to call on every interaction.

---

### `referrals`

Tracks which driver referred which other driver. One row per referred driver (enforced by the unique constraint on `referred_driver_id`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | No | auto | Primary key |
| `referrer_driver_id` | `INTEGER` | No | — | FK → `drivers.id` — the driver who shared the invite link |
| `referred_driver_id` | `INTEGER` | No | — | FK → `drivers.id` — the driver who registered via that link |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Referral timestamp |

The `UNIQUE(referred_driver_id)` constraint ensures a driver can only ever be referred once. The insert uses `ON CONFLICT DO NOTHING` so duplicate events are harmless.

---

## Core Query — Find Nearby Drivers

Located in `src/services/location.ts → findNearbyDrivers()`.

```sql
SELECT
  d.id, d.name, d.phone, d.vehicle_type, d.seats, d.vehicle_number,
  ROUND(ST_Distance(
    d.location,
    ST_MakePoint($1, $2)::geography  -- $1 = longitude, $2 = latitude
  )::numeric, 0) AS distance_m
FROM drivers d
WHERE d.status = 'available'
  AND d.is_approved = true
  AND d.is_enabled = true
  AND d.location IS NOT NULL
  AND d.location_updated_at > NOW() - INTERVAL 'N hours'   -- LOCATION_EXPIRY_HOURS
  AND ST_DWithin(d.location, ST_MakePoint($1, $2)::geography, $3)  -- $3 = radius in metres
  AND ($4::vehicle_type IS NULL OR d.vehicle_type = $4::vehicle_type)  -- $4 = filter or NULL
ORDER BY distance_m ASC
LIMIT $5;  -- MAX_RESULTS
```

`ST_DWithin` uses the GIST spatial index for a fast bounding-box pre-filter, then `ST_Distance` computes the exact geodesic distance (in metres on the WGS84 spheroid) for sorting.

> **Coordinate order:** PostGIS always expects `(longitude, latitude)`. Telegram's `message.location` object provides `{ latitude, longitude }` — they are explicitly swapped before being passed to any PostGIS function.

---

## Useful Admin Queries

Run these in the Adminer SQL tab (`http://localhost:8080`) or via `psql`.

```sql
-- All drivers with their location and status
SELECT id, name, status, is_approved, is_enabled,
       ST_AsText(location::geometry) AS coords,
       location_updated_at,
       location_share_started_at
FROM drivers ORDER BY id;

-- Drivers currently visible to riders
SELECT id, name, vehicle_type, seats,
       ROUND(location_updated_at::text::timestamptz - NOW(), 0) AS last_seen
FROM drivers
WHERE status = 'available' AND is_approved = true AND is_enabled = true
  AND location_updated_at > NOW() - INTERVAL '1 hour';

-- Referral leaderboard
SELECT d.name, COUNT(r.id) AS referrals
FROM drivers d
LEFT JOIN referrals r ON r.referrer_driver_id = d.id
GROUP BY d.id, d.name
ORDER BY referrals DESC;

-- All riders
SELECT id, telegram_id, created_at FROM riders ORDER BY created_at DESC;
```
