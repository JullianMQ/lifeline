CREATE TABLE IF NOT EXISTS user_locations (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    formatted_location TEXT,
    sos BOOLEAN NOT NULL DEFAULT false,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS user_locations_user_created_at_idx
    ON user_locations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_locations_user_recorded_at_idx
    ON user_locations (user_id, recorded_at DESC);
