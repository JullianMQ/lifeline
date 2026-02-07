-- Create media_files table to track uploaded files
CREATE TABLE IF NOT EXISTS "media_files" (
    "id" SERIAL PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    "drive_file_id" TEXT NOT NULL UNIQUE,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "media_type" TEXT NOT NULL CHECK (media_type IN ('picture', 'video', 'voice_recording')),
    "file_size" BIGINT NOT NULL,
    "web_view_link" TEXT,
    "web_content_link" TEXT,
    "description" TEXT,
    "deleting" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX "idx_media_files_user_id" ON "media_files" ("user_id");
CREATE INDEX "idx_media_files_media_type" ON "media_files" ("media_type");
CREATE INDEX "idx_media_files_drive_file_id" ON "media_files" ("drive_file_id");
CREATE INDEX "idx_media_files_created_at" ON "media_files" ("createdAt" DESC);
