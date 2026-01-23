-- Drop and recreate contacts table with array-based structure
DROP TABLE IF EXISTS "contacts";

CREATE TABLE "contacts" (
    "id" SERIAL PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    "emergency_contacts" TEXT[],
    "dependent_contacts" TEXT[],
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better array query performance
CREATE INDEX "idx_contacts_emergency_contacts" ON "contacts" USING GIN ("emergency_contacts");
CREATE INDEX "idx_contacts_dependent_contacts" ON "contacts" USING GIN ("dependent_contacts");