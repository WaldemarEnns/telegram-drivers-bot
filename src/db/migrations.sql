CREATE EXTENSION IF NOT EXISTS postgis;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('car', 'tuk', 'van', 'suv');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE driver_status AS ENUM ('available', 'busy', 'offline');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS drivers (
  id                   SERIAL PRIMARY KEY,
  telegram_id          BIGINT UNIQUE NOT NULL,
  name                 VARCHAR(100) NOT NULL,
  phone                VARCHAR(20) NOT NULL,
  vehicle_type         vehicle_type NOT NULL,
  seats                INTEGER NOT NULL,
  vehicle_number       VARCHAR(20) NOT NULL,
  status               driver_status NOT NULL DEFAULT 'offline',
  location             GEOGRAPHY(POINT, 4326),
  location_updated_at  TIMESTAMPTZ,
  is_approved          BOOLEAN NOT NULL DEFAULT false,
  is_enabled           BOOLEAN NOT NULL DEFAULT true,
  referral_code        VARCHAR(12) UNIQUE NOT NULL,
  referred_by          INTEGER REFERENCES drivers(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS location_share_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_drivers_telegram_id   ON drivers(telegram_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status        ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_location      ON drivers USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_drivers_referral_code ON drivers(referral_code);

CREATE TABLE IF NOT EXISTS riders (
  id          SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id                  SERIAL PRIMARY KEY,
  referrer_driver_id  INTEGER NOT NULL REFERENCES drivers(id),
  referred_driver_id  INTEGER NOT NULL REFERENCES drivers(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_driver_id)
);
