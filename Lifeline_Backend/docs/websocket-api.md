# WebSocket API Documentation - Multi-Room Emergency Monitoring

## Overview

This WebSocket implementation provides a **multi-room emergency monitoring and real-time location sharing system**. It enables authenticated users to create emergency monitoring rooms, join rooms as emergency contacts, share location data, and trigger emergency SOS alerts across multiple rooms simultaneously.

## Key Features

- **Multi-Room Architecture**: Users can join multiple rooms simultaneously
- **Auto-Join Emergency Contacts**: Emergency contacts are automatically joined to authorized rooms on connection
- **Real-Time Location Sharing**: Location updates broadcast to all room members via REST + WebSocket integration
- **Emergency SOS**: Cross-room emergency activation that notifies all emergency contacts
- **Access Control**: Emergency contacts get immediate access without approval workflow
- **Updated Terminology**: Uses `room-message` and `content` instead of `chat` and `message`

## Base URL

```
WebSocket: ws://localhost:3000/api/ws
REST API: http://localhost:3000/api
Location: http://localhost:3000/api/location
Rooms Info: http://localhost:3000/api/rooms-info
```

## Authentication

All WebSocket connections and REST endpoints require valid Better Auth session authentication:

**WebSocket**: Session cookie required
**REST endpoints**: Session cookie or Bearer token (for mobile compatibility)

## Connection

### WebSocket Endpoint

```
ws://localhost:3000/api/ws
```

**Headers Required:**
- `cookie: better-auth.session_token=<your_session_token>`

**Connection Response:**
```json
{
  "type": "connected",
  "clientId": "user_id_from_auth",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "roomIds": ["abc123", "def456"],
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

**Auto-Join on Connection:**
Emergency contacts automatically join authorized rooms on connection:

```json
{
  "type": "auto-joined",
  "roomId": "abc123",
  "roomOwner": "owner_user_id",
  "message": "Auto-joined as emergency contact",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

**Auto-Join Summary:**
```json
{
  "type": "auto-join-summary",
  "roomsJoined": [
    { "roomId": "abc123", "owner": "owner_user_id" },
    { "roomId": "def456", "owner": "another_owner_id" }
  ],
  "message": "Auto-joined to 2 room(s) as emergency contact",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

## Message Types

### Client-to-Server Messages

#### Create Room

Create a new emergency monitoring room with pre-loaded emergency contacts.

**Send:**
```json
{
  "type": "create-room",
  "roomId": "optional_custom_room_id"
}
```

**Response:**
```json
{
  "type": "room-created",
  "roomId": "abc123def456",
  "owner": "user_id",
  "emergencyContacts": ["09123456789", "09987654321"],
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### Join Room

Request to join a specific room. Emergency contacts get immediate access.

**Send:**
```json
{
  "type": "join-room",
  "roomId": "abc123def456"
}
```

**Response (Approved):**
```json
{
  "type": "join-approved",
  "roomId": "abc123def456",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

**Response (Denied):**
```json
{
  "type": "join-denied",
  "message": "Room not found",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

**Access Rules:**
- Room owner: Always allowed
- Emergency contacts (phone number in room's emergency contacts list): Immediate access
- Non-contacts: Denied

#### Request Join (Optional Approval Flow)

For non-emergency contacts who need explicit approval.

**Send:**
```json
{
  "type": "request-join",
  "roomId": "abc123def456"
}
```

Room owner receives:
```json
{
  "type": "join-request",
  "requesterId": "requester_user_id",
  "requesterName": "Jane Smith",
  "requesterUser": {
    "id": "requester_user_id",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "mutual",
    "phone_no": "09987654321"
  },
  "roomId": "abc123def456",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### Approve Join

Room owner approves a join request.

**Send:**
```json
{
  "type": "approve-join",
  "roomId": "abc123def456",
  "requesterId": "requester_user_id"
}
```

#### Room Message

Send a message to all users in a specific room.

**Send:**
```json
{
  "type": "room-message",
  "roomId": "abc123def456",
  "content": "Hello everyone!"
}
```

**Broadcast to all room members:**
```json
{
  "type": "room-message",
  "roomId": "abc123def456",
  "content": "Hello everyone!",
  "clientId": "user_id",
  "userName": "John Doe",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### Emergency SOS

Trigger emergency mode across all rooms owned by the user.

**Send:**
```json
{
  "type": "emergency-sos"
}
```

**Response:**
```json
{
  "type": "emergency-confirmed",
  "activatedRooms": ["abc123def456", "def456ghi789"],
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

**Emergency alerts sent to all emergency contacts in all rooms:**
```json
{
  "type": "emergency-alert",
  "emergencyUserId": "user_id",
  "emergencyUserName": "John Doe",
  "roomId": "abc123def456",
  "message": "Emergency activated - immediate access granted",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

**Emergency activated broadcast to all room members:**
```json
{
  "type": "emergency-activated",
  "roomId": "abc123def456",
  "clientId": "user_id",
  "userName": "John Doe",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### Get Users

Request the list of all users currently in a specific room.

**Send:**
```json
{
  "type": "get_users",
  "roomId": "abc123def456"
}
```

**Response:**
```json
{
  "type": "room-users",
  "roomId": "abc123def456",
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
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### Ping/Pong

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
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

### Server-to-Client System Events

#### User Joined

Broadcast when a new user joins a room.

```json
{
  "type": "user-joined",
  "clientId": "new_user_id",
  "user": {
    "id": "new_user_id",
    "name": "New User",
    "email": "new@example.com",
    "role": "mutual",
    "phone_no": "09123456789"
  },
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### User Left

Broadcast when a user disconnects from a room.

```json
{
  "type": "user-left",
  "clientId": "disconnected_user_id",
  "userName": "User Name",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### Emergency Contact Joined

Broadcast when an emergency contact joins a room.

```json
{
  "type": "emergency-contact-joined",
  "contactId": "contact_user_id",
  "contactName": "Jane Smith",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

#### Location Update

Broadcast to all room members when a user's location is updated via REST API.

```json
{
  "type": "location-update",
  "data": {
    "userId": "user_id",
    "userName": "John Doe",
    "latitude": 14.5995,
    "longitude": 120.9842,
    "timestamp": "2026-01-18T10:00:00.000Z",
    "accuracy": 12
  },
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

## Location API

### POST /api/location

Upload user location data, which is then broadcast to all room members.

**Headers Required:**
- `cookie: better-auth.session_token=<session_token>` or `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "latitude": 14.5995,
  "longitude": 120.9842,
  "timestamp": "2026-01-18T10:00:00.000Z",
  "accuracy": 12
}
```

**Validation:**
- `latitude`: number between -90 and 90
- `longitude`: number between -180 and 180
- `timestamp`: string (ISO 8601) or number (Unix timestamp)
- `accuracy`: optional number

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-18T10:00:00.000Z",
  "rooms": ["abc123def456", "def456ghi789"]
}
```

**Error Response:**
```json
{
  "error": "User is not in any active room"
}
```

**Location Update Broadcast:**
After successful upload, all room members receive a `location-update` message via WebSocket.

## Rooms Info API

### GET /api/rooms-info

Get information about all active rooms and their users.

**Headers Required:**
- `cookie: better-auth.session_token=<session_token>`

**Response:**
```json
{
  "rooms": [
    {
      "id": "abc123def456",
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

## Multi-Room Architecture

### Room Structure

Each room contains:
- `id`: Unique room identifier (cryptographically random hex string)
- `clients`: Map of client IDs to ClientInfo
- `owner`: User ID of the room owner
- `emergencyContacts`: Array of phone numbers (strings)
- `isActive`: Boolean indicating if room is active

### Client Structure

Each client can be in multiple rooms simultaneously:
- `id`: User ID from auth
- `ws`: WebSocket connection
- `roomIds`: Set of room IDs (multi-room support)
- `user`: User object from auth

### Auto-Join Logic

When an emergency contact connects:
1. Server checks all existing rooms
2. Finds rooms where contact's phone number is in `emergencyContacts` array
3. Automatically adds contact to those rooms
4. Sends `auto-joined` message for each room
5. Sends `auto-join-summary` with count of rooms joined
6. Notifies existing room members with `emergency-contact-joined`

### Emergency Contact Access Control

**Immediate Access (No Approval):**
- User's phone number is in room's `emergencyContacts` array

**Requires Approval:**
- Non-emergency contact users must use `request-join` flow

**Always Denied:**
- Non-contacts without emergency relationship

### Emergency SOS Flow

When `emergency-sos` is triggered:
1. System finds all rooms owned by the triggering user
2. Sets `isActive` to true for all owned rooms
3. For each room:
   - Sends `emergency-alert` to all online emergency contacts
   - Broadcasts `emergency-activated` to all room members
4. Sends `emergency-confirmed` to triggering user with list of activated rooms

### Room Cleanup

**On User Disconnect:**
1. User removed from all their rooms
2. `user-left` broadcast to remaining room members
3. If room becomes empty, room is deleted after 1 hour delay

**Empty Room Cleanup:**
- Empty rooms are deleted after 1 hour of inactivity
- This prevents memory accumulation

## Security & Access Control

### Authentication
- All connections require valid Better Auth session
- Middleware validates session on WebSocket connection
- REST endpoints accept both session cookie and Bearer token

### Room Access Rules
1. **Owner**: Full access to room
2. **Emergency Contact**: Immediate access, can join on connection
3. **Regular User**: Must be explicitly approved via `request-join` flow
4. **Non-Contact**: Access denied

### Emergency Contact Validation
- Emergency contacts are identified by phone number
- Room owners' emergency contacts are loaded from `/api/contacts/contacts/users?phone={userId}`
- Contacts include both `emergency_contacts` and `dependent_contacts`

### Security Features
- Cryptographically random room IDs (16 bytes → 32 hex characters)
- Emergency contact validation before room access
- Room activity state (`isActive`) for access control
- Aggressive cleanup of empty rooms (1 hour timeout)
- Error handling and logging for debugging

## Error Handling

### Error Response Format

```json
{
  "type": "error",
  "message": "Error description",
  "timestamp": "2026-01-18T10:00:00.000Z"
}
```

### Common Errors

| Error Message | Cause |
|---------------|-------|
| `Unauthorized` | Invalid or missing authentication |
| `Client not found` | User session is no longer valid |
| `Invalid message format` | Message is not valid JSON |
| `Room not found` | Room ID does not exist |
| `Room is not active` | Room is deactivated |
| `Not authorized to join this room` | User is not owner or emergency contact |
| `Already in room` | User is already a member of the room |
| `Room already exists` | Room ID collision |
| `No owned rooms found` | User has no rooms to trigger emergency |
| `Failed to create room` | Server error during room creation |
| `Failed to process emergency SOS` | Server error during emergency processing |

## Frontend Integration Examples

### JavaScript Example

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://localhost:3000/api/ws", [], {
  headers: {
    cookie: document.cookie,
  },
});

ws.onopen = function (event) {
  console.log("Connected to WebSocket server");
};

ws.onmessage = function (event) {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "connected":
      console.log(`Connected as ${data.user.name}`);
      console.log(`Auto-joined to ${data.roomIds.length} rooms`);
      break;

    case "auto-joined":
      console.log(`Auto-joined to room ${data.roomId}`);
      break;

    case "auto-join-summary":
      console.log(`Auto-joined to ${data.roomsJoined.length} rooms total`);
      break;

    case "room-message":
      displayChatMessage(data.userName, data.content);
      break;

    case "user-joined":
      displayNotification(`${data.user.name} joined the room`);
      break;

    case "user-left":
      displayNotification(`${data.userName} left the room`);
      break;

    case "emergency-alert":
      displayEmergencyAlert(`EMERGENCY: ${data.emergencyUserName} needs help!`);
      break;

    case "location-update":
      updateLocationOnMap(data.data);
      break;

    case "room-users":
      updateUsersList(data.users);
      break;
  }
};

// Create a room
function createRoom() {
  ws.send(JSON.stringify({ type: "create-room" }));
}

// Join a room
function joinRoom(roomId) {
  ws.send(JSON.stringify({ type: "join-room", roomId: roomId }));
}

// Send room message
function sendRoomMessage(roomId, content) {
  ws.send(JSON.stringify({
    type: "room-message",
    roomId: roomId,
    content: content
  }));
}

// Trigger emergency SOS
function triggerEmergencySOS() {
  ws.send(JSON.stringify({ type: "emergency-sos" }));
}

// Upload location
async function uploadLocation(latitude, longitude) {
  const response = await fetch("/api/location", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      latitude: latitude,
      longitude: longitude,
      timestamp: new Date().toISOString(),
      accuracy: 10
    })
  });

  const result = await response.json();
  console.log("Location uploaded:", result);
}
```

### React Hook Example

```javascript
import { useState, useEffect, useRef } from "react";

export function useEmergencyMonitoring() {
  const [connected, setConnected] = useState(false);
  const [roomIds, setRoomIds] = useState([]);
  const [messages, setMessages] = useState([]);
  const [location, setLocation] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:3000/api/ws`);

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "connected":
          setRoomIds(data.roomIds);
          break;

        case "room-message":
          setMessages((prev) => [...prev, data]);
          break;

        case "location-update":
          setLocation(data.data);
          break;

        case "emergency-alert":
          // Handle emergency alert
          break;
      }
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const createRoom = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "create-room" }));
    }
  };

  const joinRoom = (roomId) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "join-room", roomId }));
    }
  };

  const sendMessage = (roomId, content) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "room-message",
        roomId,
        content
      }));
    }
  };

  const triggerSOS = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "emergency-sos" }));
    }
  };

  return {
    connected,
    roomIds,
    messages,
    location,
    createRoom,
    joinRoom,
    sendMessage,
    triggerSOS
  };
}
```

### Mobile Integration (Background Location)

```javascript
// Mobile App - Background Location Tracking
class EmergencyMonitoringService {
  constructor(authToken) {
    this.authToken = authToken;
    this.ws = null;
    this.locationInterval = null;
  }

  async startMonitoring() {
    // Connect to WebSocket for real-time alerts
    this.ws = new WebSocket("ws://localhost:3000/api/ws");

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "emergency-alert") {
        this.showEmergencyAlert(data);
      }
    };

    // Start background location updates
    this.locationInterval = setInterval(() => {
      this.uploadLocation();
    }, 60000); // Every 60 seconds
  }

  async uploadLocation() {
    try {
      const position = await this.getCurrentPosition();

      const response = await fetch("/api/location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: position.coords.accuracy
        })
      });

      if (!response.ok) {
        console.error("Location upload failed");
      }
    } catch (error) {
      console.error("Error uploading location:", error);
    }
  }

  triggerSOS() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "emergency-sos" }));
    }
  }

  stopMonitoring() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  showEmergencyAlert(data) {
    // Show emergency notification to user
    alert(`EMERGENCY: ${data.emergencyUserName} needs help!`);
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  }
}
```

## Performance Considerations

### Connection Management
- WebSocket connections are stateless after authentication
- Each client maintains a Set of room IDs for multi-room support
- Auto-join processes all rooms on connection (< 200ms per room)

### Broadcasting
- Messages are broadcast to all room members excluding sender
- Failed sends result in immediate client removal from room
- Room deletion when empty prevents memory accumulation

### Location Updates
- REST endpoint for location uploads (mobile-friendly, works in background)
- WebSocket broadcast to all room members
- Location data includes timestamp and accuracy for filtering

### Room Cleanup
- Empty rooms deleted after 1 hour delay
- Prevents memory accumulation from abandoned rooms
- Graceful cleanup on disconnect

## Testing

Run the integration test suite:

```bash
bun test tests/websocket-integration.test.ts
```

The test suite covers:
- Multi-room creation with emergency contact loading
- Emergency contact multi-room immediate access
- Multi-room location broadcasting
- Cross-room emergency SOS triggers
- Non-contact multi-room access denied
- Auto-join on connection
- Room cleanup and persistence

## Mobile Compatibility

### Background Execution
- Location uploads use REST API (works with screen OFF)
- WebSocket for real-time dashboard updates only
- Adaptive intervals: 60-second polling for background

### Battery Optimization
- REST for location: Reliable background execution, OS-compliant
- WebSocket for UI: Real-time dashboard updates only
- No continuous WebSocket polling required

### OS Compliance
- Foreground Service with persistent notification for location tracking
- Works with Doze mode and App Standby
- No background execution restrictions

---

**Status**: ✅ Multi-Room Emergency Monitoring System Fully Implemented
