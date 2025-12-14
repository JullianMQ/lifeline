CREATE TABLE "contacts" (
    "id" SERIAL PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    "emergency_contact_1" TEXT,
    "emergency_contact_2" TEXT,
    "emergency_contact_3" TEXT,
    "emergency_contact_4" TEXT,
    "emergency_contact_5" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
