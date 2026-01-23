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
 db=>CREATE USER lifeline WITH PASSWORD 'password' CREATEDB;
 CREATE SCHEMA IF NOT EXISTS auth;
 GRANT ALL PRIVILEGES ON SCHEMA auth TO lifeline;
 GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO lifeline;
 ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO lifeline;
 ALTER USER lifeline SET search_path TO auth;
 pnpm dlx @better-auth/cli@latest generate
 pnpm dlx @better-auth/cli@latest migrate
```

## Installation and Running

To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

Open <http://localhost:3000>

## API Endpoints

### WebSocket

- `GET /api/ws` - WebSocket endpoint for real-time emergency monitoring
  - Multi-room support
  - Auto-join for emergency contacts
  - Emergency SOS triggers
  - Location broadcasting
  - See `docs/websocket-api.md` for full WebSocket API documentation

### Authentication

### Authentication

- `POST /api/auth/sign-up` - User registration (email/password or social)
- `POST /api/auth/sign-in` - User login (email/password or social)
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/session` - Get current session

### Contacts

- `GET /api/contacts` - Get user's emergency contacts
- `POST /api/contacts` - Update emergency contacts (partial)
- `PUT /api/contacts` - Update emergency contacts (full)
- `DELETE /api/contacts` - Clear all emergency contacts
- `DELETE /api/contacts/:id` - Clear specific emergency contact (1-5)

## Features

- Email/password authentication with Better Auth
- Google OAuth integration
- User roles: "mutual" or "dependent"
- Emergency contacts management (up to 5 per user)
- Phone number validation for Philippine formats
- Automatic contacts creation on user signup

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_URL` - Base URL for Better Auth (e.g., <http://localhost:3000>)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

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

### 2026-01-19

- Implemented multi-room WebSocket emergency monitoring system
- Added location REST endpoint with WebSocket broadcasting
- Created comprehensive integration test suite
- Implemented auto-join functionality for emergency contacts
- Updated all message types and terminology
- Added complete WebSocket API documentation

## Testing

### Integration Tests

Real integration tests that use actual codebase, database, and WebSocket server:

```bash
# Option 1: Run tests with server already running
bun run dev  # Terminal 1
bun run test:real  # Terminal 2

# Option 2: Automated (starts server, runs tests, stops server)
bun run test:real:auto
```

**Test Features:**
- Real WebSocket connections to actual server
- Real authentication with Better Auth
- Real database queries
- Real message broadcasting
- Real emergency scenarios
- Multi-room architecture validation

**Documentation:**
- `tests/README-REAL-TESTS.md` - Complete testing guide
- `tests/QUICK-START.md` - Quick start instructions
- `docs/websocket-api.md` - WebSocket API documentation
- `docs/websocket-implementation-notes.md` - Implementation details

**Test Users:**
All test users have password: `password`
- test1@example.com (mutual, 09123456789)
- test2@example.com (mutual, 09123456788)
- test3@example.com (mutual, 09123456787)
- test4@example.com (dependent, 09123456786)
- test5@example.com (dependent, 09123456785)