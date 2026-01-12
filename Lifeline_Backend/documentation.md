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

## Features

- Email/password authentication with Better Auth
- Google OAuth integration
- User roles: "mutual" or "dependent"
- Emergency and dependent contacts management (unlimited per user, stored in arrays)
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
- Migrated contacts table from hardcoded columns to array-based structure
- Added support for both emergency and dependent contacts with unlimited entries
- Updated all API endpoints to handle array-based contact storage
