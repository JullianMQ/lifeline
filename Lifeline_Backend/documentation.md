# Lifeline Backend Documentation

## Overview

This is the backend for the Lifeline application, built with Bun, Hono, Better Auth, and PostgreSQL. It provides authentication, user management, and emergency contacts functionality.

## PRE-REQUISITES

1. Bun package manager
2. Better-Auth
3. PostgreSQL
4. lifeline user and database
5. Commands to use:

```bash
 CREATE SCHEMA IF NOT EXISTS auth;
 GRANT ALL PRIVILEGES ON SCHEMA auth TO lifeline;
 GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO lifeline;
 ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO lifeline;
 pnpm dlx @better-auth/cli@latest generate
 pnpm dlx @better-auth/cli@latest migrate
 ```

## API Endpoints

### Authentication

- `POST /api/auth/sign-up/email` - User registration email/password
- `POST /api/auth/sign-in/email` - User login email/password
- `POST /api/auth/sign-up/social` - User registration social
- `POST /api/auth/sign-in/social` - User login social
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/session` - Get current session

### Contacts

- `GET /api/contacts` - Get user's contacts (raw phone numbers)
- `GET /api/contacts/users` - Get user's contacts with user details (name, email, phone)
- `GET /api/contacts/:phone` - Get user details by phone number
- `POST /api/contacts` - Update contacts (partial update)
- `PUT /api/contacts` - Update contacts (full update)
- `DELETE /api/contacts` - Clear all contacts
- `DELETE /api/contacts/:type/:index` - Remove contact by type and index (emergency/0, dependent/1)

### Locations

- `POST /api/location` - Add a location sample for the authenticated user
- `GET /api/locations` - Get recent location samples for the authenticated user
- `GET /api/locations/contacts` - Get recent locations for emergency contacts (grouped by user_id)

## Features

- Email/password authentication with Better Auth
- Google OAuth integration
- User roles: "mutual" or "dependent"
- Emergency and dependent contacts management (unlimited per user, stored in arrays)
- Location history storage with day-based FIFO retention window
- Emergency contacts can view a user's recent location history
- Phone number validation for Philippine formats
- Automatic contacts creation on user signup

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_URL` - Base URL for Better Auth (e.g., <http://localhost:3000>)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `LOCATION_RETENTION_DAYS` - default retention window in days (default: 3)
- `LOCATION_TIMEZONE` - timezone used for day boundaries (default: Asia/Singapore)

## Data Model

### user_locations

- `id` (bigserial, primary key)
- `user_id` (uuid, foreign key -> auth.user.id)
- `latitude` (decimal)
- `longitude` (decimal)
- `formatted_location` (text, optional) - from Google Maps formatted_address
- `formattedLocation` is accepted in REST/WebSocket inputs and stored as `formatted_location`
- `recorded_at` (timestamptz) - source timestamp from device
- `created_at` (timestamptz) - server insert timestamp

Indexes:
- (`user_id`, `created_at` desc)
- (`user_id`, `recorded_at` desc)

## Location Retention

- Soft limit: 10,000 entries per day per user (no hard enforcement yet, intended for future rate limiting).
- Retention window: 3 days by default; configurable per user (e.g., 7-15 days for premium users).
- Timezone for day boundaries: Asia/Singapore.
- Data is retained beyond the retention window until new data is added for a new day.
- FIFO behavior is day-based: on insert, if the user has more than the retention window days, delete the oldest day.
- Cleanup is only triggered on new insert; no manual delete endpoint.
- Emergency contacts can view their contacts' recent location history.

## Media File Longevity (Plan)

- Goal: Media files stored in Google Drive are intended to last indefinitely unless replaced by a new-day upload.
- Day boundary: Determined by the timezone embedded in each file's `createdAt` timestamp.
- Retention rule: When a user uploads media of a given type on a new calendar day, all files of that same media type not on that same day are deleted.
- Same-day uploads are additive; only a day change triggers deletion of prior files.
- Deletion is performed immediately after a successful upload + DB insert.
- Cleanup is triggered on upload; there is no scheduled cleanup job.
- Cleanup is best-effort with retries; it can be switched to atomic behavior later if needed.

## CHANGELOG

### 2025-12-13

- Initial setup with Better Auth, Hono, and PostgreSQL
- Added user additional fields: role (enum: mutual/dependent), phone_no
- Implemented emergency contacts table with foreign key to user
- Created CRUD operations for contacts with Zod validation
- Added Philippine phone number regex validation (09XXXXXXXXX or +639XXXXXXXXX)
- Implemented after-signup hook to create contacts record for new users
- Added Google OAuth integration with social providers
- Fixed various TypeScript and database issues
- Completed full authentication and contacts management system
- Migrated contacts table from hardcoded columns to array-based structure
- Added support for both emergency and dependent contacts with unlimited entries
- Updated all API endpoints to handle array-based contact storage
