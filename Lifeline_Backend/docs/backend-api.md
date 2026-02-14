# Lifeline Backend API Documentation

Scan-friendly API reference that mirrors BetterAuth/Scalar-style structure.

## Introduction

This document covers the Lifeline Backend API, including REST routes, WebSocket messages, and database schemas.

## Base URL

- REST: `/api`
- WebSocket: `ws://<host>/api/ws`

## Authentication

- BetterAuth session cookie is required for most endpoints.
- Mobile clients may use `Authorization: Bearer <token>` for REST and WebSocket.
- BetterAuth handler: `GET/POST /api/auth/*`.

---

## Auth

### POST `/api/check/email`

Check if an email is already registered.

#### Body (application/json)

```json
{
  "email": "user@example.com"
}
```

#### Responses

**200**
```json
{ "message": "Email is available" }
```

**422**
```json
{ "error": "Email already in use" }
```

**400/500**
```json
{ "error": "Email is required" }
```

---

### POST `/api/check/phone`

Check if a phone number is already registered.

#### Body (application/json)

```json
{
  "phone": "09123456789"
}
```

#### Responses

**200**
```json
{ "message": "Phone is available" }
```

**422**
```json
{ "error": "Phone already in use" }
```

---

### POST `/api/auth/magic-link/qr`

Trigger BetterAuth magic-link sign-in (QR flow).

#### Body (application/json)

```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "callbackURL": "http://localhost:3000",
  "newUserCallbackURL": "",
  "errorCallbackURL": ""
}
```

#### Response

```json
{
  "url": "...",
  "token": "..."
}
```

---

### PUT `/api/update-user`

Update user profile fields and sync contacts on phone change.

#### Auth

- Session cookie required.

#### Body (application/json)

```json
{
  "name": "Jane Doe",
  "phone_no": "+639123456789",
  "role": "dependent"
}
```

#### Notes

- Phone format: `09XXXXXXXXX` or `+639XXXXXXXXX` or empty string.
- Mutual users cannot change role.
- Phone changes update contacts arrays.

#### Responses

**200**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "role": "mutual",
    "phone_no": "+639123456789",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### GET `/api/auth/google/callback/success`
### GET `/api/auth/google/callback/error`

OAuth callback endpoints.

---

## Contacts

All contacts routes require auth.

### GET `/api/contacts/users`

Fetch contact lists with full user details and latest location IDs.

#### Response

```json
{
  "id": 1,
  "user_id": "user_123",
  "emergency_contacts": [
    {
      "user_id": "user_456",
      "phone_no": "+639123456789",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "mutual",
      "image": "https://...",
      "latest_location_id": 123
    }
  ],
  "dependent_contacts": []
}
```

---

### GET `/api/contacts`

Fetch raw contacts row for current user.

#### Response

```json
{
  "id": 1,
  "user_id": "user_123",
  "emergency_contacts": ["+639123456789"],
  "dependent_contacts": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### GET `/api/contacts/:phone`

Lookup user by phone number.

#### Response

```json
{
  "id": "user_456",
  "email": "jane@example.com",
  "name": "Jane Doe",
  "role": "mutual",
  "phone_no": "+639123456789"
}
```

---

### POST `/api/contacts`

Append emergency/dependent contacts with validation and bidirectional updates.

#### Body (application/json)

```json
{
  "emergency_contacts": ["+639123456789"],
  "dependent_contacts": ["+639987654321"]
}
```

#### Responses

**200**
```json
{
  "success": true,
  "message": "New contacts added successfully",
  "added": {
    "emergency_contacts": ["+639123456789"],
    "dependent_contacts": []
  }
}
```

---

### PUT `/api/contacts`

Replace entire contact arrays with validation and bidirectional cleanup.

#### Body (application/json)

```json
{
  "emergency_contacts": ["+639123456789"],
  "dependent_contacts": []
}
```

---

### DELETE `/api/contacts`

Clear all contacts with bidirectional cleanup.

#### Response

```json
{ "success": true }
```

---

### DELETE `/api/contacts/:type/:index`

Remove contact by index. `type` is `emergency` or `dependent`.

#### Response

```json
{ "success": true }
```

---

## Location & SOS

All location routes require auth.

### POST `/api/location`

Save a location and broadcast to WebSocket rooms.

#### Body (application/json)

```json
{
  "latitude": 14.5995,
  "longitude": 120.9842,
  "timestamp": "2026-01-18T10:00:00.000Z",
  "accuracy": 12,
  "formattedLocation": "Manila, Metro Manila",
  "roomId": "optional_room_id",
  "sos": false
}
```

#### Notes

- If `roomId` is provided, validates by phone number membership.
- If omitted, broadcasts to all rooms where user is owner or emergency contact.

#### Response

```json
{
  "success": true,
  "timestamp": "2026-01-18T10:00:00.000Z",
  "rooms": ["room_id_1"]
}
```

---

### POST `/api/sos`

Save SOS location, broadcast, and send emergency emails.

#### Body (application/json)

```json
{
  "latitude": 14.5995,
  "longitude": 120.9842,
  "formattedLocation": "Manila, Metro Manila",
  "timestamp": "2026-01-18T10:00:00.000Z",
  "roomId": "optional_room_id"
}
```

#### Response

```json
{
  "success": true,
  "timestamp": "2026-01-18T10:00:00.000Z",
  "rooms": ["room_id_1"]
}
```

---

### GET `/api/locations`

Fetch recent locations for the authenticated user.

#### Response

```json
{
  "locations": [
    {
      "id": 123,
      "user_id": "user_123",
      "latitude": 14.5995,
      "longitude": 120.9842,
      "formatted_location": "Manila, Metro Manila",
      "sos": false,
      "acknowledged": false,
      "timestamp": "2026-01-18T10:00:00.000Z",
      "created_at": "2026-01-18T10:00:01.000Z"
    }
  ]
}
```

---

### GET `/api/locations/contacts`

Fetch recent locations for emergency contacts, grouped by user.

#### Response

```json
{
  "locations_by_user": {
    "user_456": {
      "user_name": "Jane Doe",
      "user_phone": "+639123456789",
      "locations": [
        {
          "id": 456,
          "latitude": 14.5995,
          "longitude": 120.9842,
          "formatted_location": "Manila, Metro Manila",
          "sos": false,
          "acknowledged": false,
          "timestamp": "2026-01-18T10:00:00.000Z",
          "created_at": "2026-01-18T10:00:01.000Z"
        }
      ]
    }
  }
}
```

---

### PATCH `/api/locations/:id/acknowledge`

Acknowledge a location (owner or emergency contact).

#### Response

```json
{
  "success": true,
  "id": 123,
  "acknowledged": true
}
```

---

## Media

All media routes require auth.

### POST `/api/media/upload`

Upload media to Google Drive and store metadata.

#### Body (multipart/form-data)

```text
file: <binary>
media_type: picture | video | voice_recording
description: optional string
```

#### Response (201)

```json
{
  "success": true,
  "file": {
    "id": 1,
    "drive_file_id": "1abc123def456",
    "file_name": "1706123456789_photo.jpg",
    "original_name": "photo.jpg",
    "mime_type": "image/jpeg",
    "media_type": "picture",
    "file_size": 245678,
    "web_view_link": "https://drive.google.com/file/d/1abc123def456/view",
    "web_content_link": "https://drive.google.com/uc?id=1abc123def456&export=download",
    "description": "Emergency photo",
    "createdAt": "2024-01-25T10:30:00.000Z"
  }
}
```

---

### GET `/api/media/files`

List all accessible files (own + connected contacts).

#### Query

```text
media_type: picture | video | voice_recording (optional)
user_id: user id or phone number (optional)
```

---

### GET `/api/media/files/own`

List only the authenticated user’s files.

---

### GET `/api/media/files/:id`

Fetch metadata for a specific file by ID.

---

### GET `/api/media/files/:id/download`

Download or stream a file (binary response).

---

### DELETE `/api/media/files/:id`

Delete a file (owner only).

---

### PUT `/api/media/files/:id`

Update file metadata (owner only).

#### Body (application/json)

```json
{
  "description": "Updated description"
}
```

---

### GET `/api/media/connected-users`

List users whose files are accessible to the current user.

---

### GET `/api/media/stats`

File counts and sizes by media type.

---

## WebSocket

### GET (upgrade) `/api/ws`

WebSocket endpoint for rooms, location updates, and SOS.

#### Connection Response

```json
{
  "type": "connected",
  "clientId": "user_id",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "mutual",
    "phone_no": "0912..."
  },
  "roomIds": ["..."],
  "timestamp": "..."
}
```

### Client → Server Messages

```json
{ "type": "create-room", "roomId": "optional_custom" }
```

```json
{ "type": "join-room", "roomId": "room_id" }
```

Join behavior (current implementation):

- `join-room` is immediately approved if the client is the room owner or is listed in the room owner’s `emergency_contacts`.
- Non-owners who are not emergency contacts are denied (`join-denied`).
- `request-join` / `approve-join` exist, but they are not required for emergency contacts and are only relevant if you want an explicit owner approval flow.

Future/optional approval flow (fallback):

- If automatic join fails or you want an explicit approval step, send `request-join` first.
- The room owner receives `join-request` and can respond with `approve-join`.
- On approval, the requester receives `join-approved` and the room broadcasts `user-joined`.

```json
{ "type": "request-join", "roomId": "room_id" }
```

```json
{ "type": "approve-join", "roomId": "room_id", "requesterId": "user_id" }
```

```json
{ "type": "room-message", "roomId": "room_id", "content": "Hello" }
```

```json
{
  "type": "emergency-sos",
  "latitude": 14.5995,
  "longitude": 120.9842,
  "timestamp": "2026-01-18T10:00:00.000Z",
  "accuracy": 12,
  "formattedLocation": "Manila, Metro Manila",
  "roomId": "optional_room_id"
}
```

```json
{
  "type": "location-update",
  "roomId": "optional_room_id",
  "latitude": 14.5995,
  "longitude": 120.9842,
  "timestamp": "2026-01-18T10:00:00.000Z",
  "accuracy": 12,
  "formattedLocation": "Manila, Metro Manila"
}
```

```json
{ "type": "get_users", "roomId": "room_id" }
```

```json
{ "type": "ping" }
```

### Server → Client Events

- `auto-joined`
- `auto-join-summary`
- `join-approved` / `join-denied`
- `user-joined` / `user-left`
- `emergency-contact-joined`
- `emergency-alert`
- `emergency-activated`
- `location-update`
- `location-update-confirmed`
- `room-users`
- `pong`

---

## Rooms Info

### GET `/api/rooms-info`

List rooms visible (where they are a contact) to the requesting user.

#### Response

```json
{
  "rooms": [
    {
      "id": "room_id",
      "clientCount": 2,
      "clients": [
        {
          "id": "user_1",
          "name": "John Doe",
          "user": { "id": "user_1", "name": "John Doe", "role": "mutual" }
        }
      ]
    }
  ],
  "totalRooms": 1,
  "totalClients": 2
}
```

---

## Database Schemas

### BetterAuth (`better-auth_migrations/*.sql`)

#### `role_enum`

```text
mutual | dependent
```

#### `user`

```text
id (PK)
name
email (unique)
emailVerified
image
role
phone_no (unique)
emergency_contact
createdAt
updatedAt
```

#### `session`

```text
id (PK)
expiresAt
token (unique)
createdAt
updatedAt
ipAddress
userAgent
userId (FK → user)
```

#### `account`

```text
id (PK)
accountId
providerId
userId (FK → user)
accessToken
refreshToken
idToken
accessTokenExpiresAt
refreshTokenExpiresAt
scope
password
createdAt
updatedAt
```

#### `verification`

```text
id (PK)
identifier
value
expiresAt
createdAt
updatedAt
```

---

### App Tables (`migrations/*.sql`)

#### `contacts`

```text
id (PK)
user_id (FK → user)
emergency_contacts (TEXT[])
dependent_contacts (TEXT[])
createdAt
updatedAt
```

Indexes:

```text
GIN idx_contacts_emergency_contacts
GIN idx_contacts_dependent_contacts
```

#### `user_locations`

```text
id (PK)
user_id (FK → user)
latitude
longitude
formatted_location
sos
acknowledged
recorded_at
created_at
```

Indexes:

```text
user_locations_user_created_at_idx
user_locations_user_recorded_at_idx
```

#### `media_files`

```text
id (PK)
user_id (FK → user)
drive_file_id (unique)
file_name
original_name
mime_type
media_type
file_size
web_view_link
web_content_link
description
deleting
createdAt
updatedAt
```

Indexes:

```text
idx_media_files_user_id
idx_media_files_media_type
idx_media_files_drive_file_id
idx_media_files_created_at
```
