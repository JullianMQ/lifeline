# WebSocket API Documentation

## Overview

This WebSocket implementation enables real-time communication between authenticated users in shared rooms. It integrates with Better Auth for secure user authentication and provides chat, direct messaging, and user management features.

## Base URL

```
WebSocket: ws://localhost:3000/api/ws/{roomId}
REST API: http://localhost:3000/api
```

## Authentication

All WebSocket connections require valid Better Auth session authentication. Users must be logged in to connect.

## WebSocket Endpoints

### Connect to Room

```
ws://localhost:3000/api/ws/{roomId}
```

**Headers Required:**

- `cookie: better-auth.session_token=<your_session_token>`

**Connection Response:**

```json
{
  "type": "connected",
  "clientId": "user_id_from_auth",
  "roomId": "1",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

## Message Types

### Chat Message

Send a message to all users in the room.

**Send:**

```json
{
  "type": "chat",
  "message": "Hello everyone!"
}
```

**Broadcast to all users:**

```json
{
  "type": "chat",
  "message": "Hello everyone!",
  "clientId": "user_id",
  "userName": "John Doe",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

### Direct Message

Send a private message to a specific user.

**Send:**

```json
{
  "type": "direct_message",
  "targetClientId": "target_user_id",
  "message": "This is private"
}
```

**Received by target user:**

```json
{
  "type": "direct_message",
  "message": "This is private",
  "fromClientId": "sender_user_id",
  "fromName": "John Doe",
  "fromUser": {
    "id": "sender_user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

### Get Room Users

Request the list of all users currently in the room.

**Send:**

```json
{
  "type": "get_users"
}
```

**Response:**

```json
{
  "type": "room_users",
  "users": [
    {
      "id": "user_1_id",
      "name": "John Doe",
      "user": {
        "id": "user_1_id",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "mutual",
        "phone_no": "09123456789"
      }
    },
    {
      "id": "user_2_id",
      "name": "Jane Smith",
      "user": {
        "id": "user_2_id",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "role": "dependent",
        "phone_no": "09987654321"
      }
    }
  ],
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

### Ping/Pong

Check connection health.

**Send:**

```json
{
  "type": "ping"
}
```

**Response:**

```json
{
  "type": "pong",
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

## System Events

### User Joined

Broadcast when a new user joins the room.

```json
{
  "type": "user_joined",
  "clientId": "new_user_id",
  "user": {
    "id": "new_user_id",
    "name": "New User",
    "email": "new@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

### User Left

Broadcast when a user disconnects from the room.

```json
{
  "type": "user_left",
  "clientId": "disconnected_user_id",
  "userName": "User Name",
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

## REST API Endpoints

### Get Room Information

Get information about all active rooms and their users.

**Request:**

```
GET /api/rooms-info
```

**Headers Required:**

- `cookie: better-auth.session_token=<your_session_token>`

**Response:**

```json
{
  "rooms": [
    {
      "id": "1",
      "clientCount": 3,
      "clients": [
        {
          "id": "user_1_id",
          "name": "John Doe",
          "user": {
            "id": "user_1_id",
            "name": "John Doe",
            "email": "john@example.com",
            "role": "mutual",
            "phone_no": "09123456789"
          }
        }
      ]
    }
  ],
  "totalRooms": 1,
  "totalClients": 3
}
```

## Error Handling

### Error Response Format

```json
{
  "type": "error",
  "message": "Error description",
  "timestamp": "2026-01-09T06:00:00.000Z"
}
```

### Common Errors

- `401 Unauthorized` - Invalid or missing authentication
- `Client not found` - User session is no longer valid
- `Invalid message format` - Message is not valid JSON

## Frontend Integration Examples

### JavaScript Example

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://localhost:3000/api/ws/1", [], {
  headers: {
    cookie: document.cookie,
  },
});

ws.onopen = function (event) {
  console.log("Connected to room 1");
};

ws.onmessage = function (event) {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "chat":
      displayChatMessage(data.userName, data.message);
      break;
    case "user_joined":
      displayNotification(`${data.user.name} joined the room`);
      break;
    case "user_left":
      displayNotification(`${data.userName} left the room`);
      break;
    case "room_users":
      updateUsersList(data.users);
      break;
    case "direct_message":
      displayDirectMessage(data.fromName, data.message);
      break;
  }
};

// Send chat message
function sendChatMessage(message) {
  ws.send(
    JSON.stringify({
      type: "chat",
      message: message,
    }),
  );
}

// Send direct message
function sendDirectMessage(targetUserId, message) {
  ws.send(
    JSON.stringify({
      type: "direct_message",
      targetClientId: targetUserId,
      message: message,
    }),
  );
}
```

### React Hook Example

```javascript
import { useState, useEffect, useRef } from "react";

export function useWebSocket(roomId) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:3000/api/ws/${roomId}`);

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "room_users":
          setUsers(data.users);
          break;
        case "chat":
          setMessages((prev) => [...prev, data]);
          break;
        case "user_joined":
        case "user_left":
          ws.current.send(JSON.stringify({ type: "get_users" }));
          break;
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [roomId]);

  const sendMessage = (message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "chat",
          message: message,
        }),
      );
    }
  };

  return { connected, users, messages, sendMessage };
}
```

## Future Security Features

### Room Access Control (Planned)

**Note:** Currently, any authenticated user can join any room. Future implementations will include:

**Family/Organization-Based Access:**

- Users can only join rooms where they are family members
- Organization members can only join their organization's rooms
- Emergency contacts can join specific user's emergency rooms

**Implementation Plan:**

```typescript
// Future room validation logic
async function validateRoomAccess(
  userId: string,
  roomId: string,
): Promise<boolean> {
  // Check if user is family member of room owner
  const isFamilyMember = await checkFamilyRelationship(userId, roomId);

  // Check if user is in same organization
  const isOrgMember = await checkOrganizationMembership(userId, roomId);

  // Check if user is emergency contact
  const isEmergencyContact = await checkEmergencyContact(userId, roomId);

  return isFamilyMember || isOrgMember || isEmergencyContact;
}
```

**Room Types:**

- `family-{familyId}` - Family-only rooms
- `org-{orgId}` - Organization rooms
- `emergency-{userId}` - Emergency contact rooms
- `public-{roomId}` - Public rooms (current behavior)

**Access Levels:**

- **Family Members:** Full access to family rooms
- **Organization Members:** Access to org rooms
- **Emergency Contacts:** Access to specific emergency rooms
- **Public Users:** Access to public rooms only

This will ensure secure, context-aware room access while maintaining privacy and security boundaries.

