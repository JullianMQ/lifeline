# Lifeline WebSocket Design - Simplified Capstone Version

**Project**: Emergency Monitoring & Assistance System (Lifeline)
**Scope**: WebSocket rooms, location streaming, emergency SOS
**Audience**: College capstone students
**Implementation Time**: 1-2 days (10-12 hours total)

---

## 1. System Philosophy

When a user clicks "Start Monitoring", they've already given consent to be monitored by their emergency contacts. The complex permission system is unnecessary for a college capstone.

**Core Insight**: Consent is implied when starting monitoring. Emergency contacts get immediate access.

---

## 2. System Goals (Simplified)

1. **Simple Monitoring**: User starts monitoring → emergency contacts can immediately join
2. **OS-Compliant Tracking**: Works when mobile screen is off (Android)
3. **Real-time Dashboards**: Emergency contacts receive live updates via WebSocket
4. **Emergency SOS**: Manual panic button for immediate alerts

---

## 3. Core Architectural Decisions

### 3.1 Mobile → Server: HTTPS REST
**Why**: WebSockets die when mobile app is backgrounded by Android

```javascript
// Mobile uploads location via REST
POST /api/location
{
  "latitude": 14.5995,
  "longitude": 120.9842,
  "timestamp": 1700000000,
  "accuracy": 12
}
```

### 3.2 Server → Dashboards: WebSockets
**Why**: Real-time updates for web dashboards

```javascript
// Single WebSocket endpoint
ws://api.example.com/ws
```

### 3.3 Room Model: Simple & Effective
- One room type (no complex modes)
- `isActive` flag instead of mode transitions
- Emergency contacts join immediately when user starts monitoring

---

## 4. Simplified Data Models

### 4.1 User Types
```javascript
enum UserType {
    USER,           // Regular user being monitored
    EMERGENCY_CONTACT  // Can monitor when user starts session
}
```

### 4.2 Simple Room Model
```javascript
interface Room {
    id: string;              // Auto-generated UUID
    ownerUserId: string;     // User being monitored
    emergencyContacts: string[];  // Array of authorized emergency contact IDs
    isActive: boolean;       // True when monitoring is active
    createdAt: timestamp;
    lastLocationUpdate?: timestamp;
}
```

**No More**: 
- Complex room modes (PRIVATE/EMERGENCY/MONITORED)
- Join approval workflows
- Multi-step permission systems

---

## 5. Room Lifecycle (Simplified)

```
CREATE → ACTIVE (when user clicks "Start Monitoring")
ACTIVE → INACTIVE (when user clicks "Stop Monitoring")
```

**Rules**:
- User creates room when starting monitoring
- Emergency contacts are auto-joined to ACTIVE rooms where they're authorized
- Emergency contacts can be in multiple rooms simultaneously (one per dependent)
- Rooms auto-expire after 24 hours of inactivity
- Rooms persist even when mobile disconnects (reconnect when back online)
- If the mobile device temporarily disconnects, the room remains active and resumes broadcasting when location updates resume.

---

## 6. WebSocket Events (Simplified)

### 6.1 Connection & Authentication
All WebSocket and REST requests use JWT authentication. The token is passed via query parameter for WebSocket connections and via Authorization header for REST APIs.

```javascript
// Connect with JWT token
ws://api.example.com/ws?token=<jwt>
```

### 6.2 Core Events

**start-monitoring** (User creates room)
```json
{
  "type": "start-monitoring"
}
```
Server response:
```json
{
  "type": "monitoring-started",
  "roomId": "abc-123-def",
  "shareWithEmergencyContacts": true
}
```



**location-update** (Broadcast to room)
```json
{
  "type": "location-update",
  "roomId": "abc-123-def",
  "data": {
    "latitude": 14.5995,
    "longitude": 120.9842,
    "timestamp": 1700000000,
    "accuracy": 12
  }
}
```

**emergency-sos** (Panic button)
```json
{
  "type": "emergency-sos",
  "roomId": "abc-123-def",
  "timestamp": 1700000000
}
```

---

## 7. Location Tracking (Critical)

### 7.1 Mobile Background Service
When user taps "Start Monitoring":
1. Start Foreground Service
2. Show persistent notification
3. Request location updates every 60 seconds
4. Upload via REST (works with screen OFF)

### 7.2 Server Location Handling
```javascript
// POST /api/location
app.post('/api/location', (req, res) => {
    // 1. Validate JWT token
    // 2. Find user's active room
    // 3. Store location (optional)
    // 4. Auto-join authorized emergency contacts to the room
    await autoJoinEmergencyContacts(roomId, userId);
    // 5. Broadcast to WebSocket room
    broadcastToRoom(roomId, {
        type: 'location-update',
        data: req.body
    });
});
```

**Auto-Join Logic**:
When a room becomes active, the server automatically joins all authorized emergency contacts to that room. Emergency contacts never need to manually join rooms - the server handles all room assignment based on emergency contact relationships.

---

## 8. Emergency SOS Logic

**Trigger**: User presses panic button

```javascript
// Client sends SOS
ws.send({
    type: "emergency-sos",
    timestamp: Date.now()
});

// Server broadcasts to all room members
broadcastToRoom(roomId, {
    type: "emergency-sos",
    timestamp: Date.now()
});
```

**No More**: Complex anomaly detection, multi-step escalation, automated alerts.

---

## 8.1 Active Monitoring Endpoint

**GET /api/monitoring/active**

Returns rooms where the current user is an emergency contact and the room is active:

```javascript
// Response
{
  "activeRooms": [
    {
      "roomId": "abc-123-def",
      "ownerUserId": "user-123",
      "ownerName": "John Doe",
      "isActive": true,
      "lastLocationUpdate": 1700000000
    },
    {
      "roomId": "xyz-789-uvw", 
      "ownerUserId": "user-456",
      "ownerName": "Jane Smith",
      "isActive": true,
      "lastLocationUpdate": 1700000050
    }
  ]
}
```

This allows emergency contact dashboards to show all dependents they're currently monitoring.

---

## 9. Multi-Room Support for Emergency Contacts

Emergency contacts can monitor multiple users simultaneously. The server handles all room management automatically.

**Key Design Principles**:
1. **No Manual Room Management**: Emergency contacts never see or handle room IDs
2. **Auto-Join on Activation**: When a user starts monitoring, all authorized emergency contacts are automatically joined to that room
3. **Multi-Room State**: Emergency contacts can be in multiple room states simultaneously
4. **Server-Side Authorization**: All room access is validated server-side based on emergency contact relationships

**Emergency Contact Connection Flow**:
```
Emergency Contact Connects
    ↓
Server Queries: Find all active rooms where this user is an emergency contact
    ↓
Auto-Join: Join user to all relevant rooms
    ↓
Broadcast: Send current location data for all active rooms
```

**Updated State Diagram**:
```
Emergency Contact State:
├── Room A (User 1) - ACTIVE ←→ Receiving Location Updates
├── Room B (User 2) - ACTIVE ←→ Receiving Location Updates  
├── Room C (User 3) - INACTIVE - No Updates
└── Room D (User 4) - ACTIVE ←→ Receiving Location Updates
```

Each emergency contact can be in a different state for each room they're monitoring.

---

## 10. Implementation Priority (1-2 Days)

### Day 1 (6-8 hours):
1. **REST Location API** (2 hours)
   - POST /api/location endpoint
   - JWT authentication
   - Basic validation

2. **WebSocket Server** (3 hours)
   - Socket connection handling
   - Room management (Map<roomId, Set<socket>>)
   - Basic events (join, leave, message)

3. **Room Creation** (1-2 hours)
   - start-monitoring event
   - Emergency contact validation
   - Auto-join for emergency contacts
   - Multi-room support for emergency contacts

### Day 2 (4-6 hours):
1. **Location Broadcasting** (2 hours)
   - Connect REST → WebSocket
   - Real-time location updates
   - Error handling

2. **Emergency SOS** (1-2 hours)
   - Panic button handling
   - Emergency broadcast

3. **Active Monitoring Endpoint** (1 hour)
   - GET /api/monitoring/active
   - Emergency contact room listing
   - Multi-room state management

4. **Cleanup & Testing** (1-2 hours)
   - Room timeouts
   - Disconnect handling
   - Multi-room testing

---

## 11. Security (Simplified but Essential)

1. **JWT Authentication**: All API calls require valid token
2. **Emergency Contact Validation**: Only pre-approved emergency contacts can join. Emergency contacts are pre-defined in the database during user setup and validated server-side when joining a room.
3. **Room ID Security**: UUID-based room IDs (unguessable)
4. **Rate Limiting**: Prevent abuse of join requests

---

## 12. Technical Architecture Summary

```
Mobile App (REST) → Backend → WebSocket → Dashboard Web App
                     ↓
               Database (locations, users, contacts)
```

**Key Components**:
- Express.js server with Socket.io
- JWT authentication
- In-memory room storage (sufficient for capstone)
- Simple database (SQLite/PostgreSQL)

---

## 13. One-Sentence Summary

"The system uses REST-based background location uploads from mobile devices combined with simple WebSocket rooms for real-time emergency monitoring, where clicking 'Start Monitoring' gives immediate access to emergency contacts."

---

## TL;DR (Mental Model)

**Emergency contacts don't "join rooms" manually.**
**They are automatically attached to every active monitoring session they're authorized for, and that can be multiple rooms at the same time.**

A single WebSocket connection can be in N rooms concurrently.

### 1️⃣ Key Rule That Makes This Simple

**One WebSocket connection ≠ one room**

Instead:

```
1 WebSocket connection
        ↓
    many rooms
```

Just like Socket.IO or Slack:

- One socket
- Multiple room memberships

### 2️⃣ What a "Room" Represents (Very Important)

A room is not a chat lobby.

A room is:
- **One monitoring session for one dependent/mutual user**

So if:
- Dependent A starts monitoring → Room A
- Dependent B starts monitoring → Room B  
- Mutual C starts monitoring → Room C

An emergency contact E may be authorized for:
- Room A
- Room B
- Room C

➡️ E is joined to all three simultaneously

### 3️⃣ Exact Flow: Emergency Contact with Multiple Dependents

**Scenario:**
- User E = emergency contact
- Users D1, D2, D3 = dependents
- All three press Start Monitoring

**Step 1: Emergency contact connects once**
```
WebSocket CONNECT (JWT authenticated)
```

**Step 2: Server auto-discovers active rooms**

On connection (or reconnection), server runs:
```javascript
const activeRooms = rooms.filter(room =>
  room.isActive &&
  room.emergencyContacts.includes(user.id)
);
```

Example result:
```
[
  room(D1),
  room(D2), 
  room(D3)
]
```

**Step 3: Server joins socket to ALL rooms**

```javascript
for (const room of activeRooms) {
  room.users.add(socket);
  socket.rooms.add(room.id);
}
```

- No client involvement
- No room IDs sent  
- No join messages

### 4️⃣ How Messages Flow with Multiple Rooms

**Location update from D2:**
```javascript
broadcastToRoom(roomD2, {
  type: "location-update",
  userId: "D2", 
  lat, lng
});
```

**Emergency contact E receives it because their socket is in that room.**

**Location update from D1?**

➡️ Same socket  
➡️ Different room  
➡️ Same WebSocket connection

### 5️⃣ Client-Side Perspective (Very Simple)

The emergency contact frontend just receives events like:
```json
{
  "type": "location-update",
  "ownerUserId": "D2",
  "latitude": 14.59,
  "longitude": 120.98
}
```

Frontend groups by ownerUserId:

```
📍 D1
📍 D2  
📍 D3
```

**The client never cares about rooms.**

### 6️⃣ What Happens When a Monitoring Session Ends?

**Dependent clicks Stop Monitoring:**

```javascript
room.isActive = false;
```

**Server:**
```javascript
for (const socket of room.users) {
  socket.rooms.delete(room.id);
}
rooms.delete(room.id);
```

**Emergency contact automatically stops receiving updates for that user.**

### 7️⃣ Why This Scales Cleanly (Even Conceptually)

| Concern | Result |
|---------|--------|
| Emergency contact has 10 dependents | 10 rooms |
| One socket per contact | ✅ |
| No reconnect needed | ✅ |
| No room selection UI | ✅ |
| No join/leave spam | ✅ |

### 8️⃣ The Golden Rule (Put This in Your Docs)

**Rooms are owned by monitored users, not emergency contacts.**
**Emergency contacts are passive observers automatically attached to all active rooms they are authorized to view.**

### 9️⃣ One-Line Capstone Defense Answer

**"An emergency contact maintains a single WebSocket connection that can belong to multiple monitoring rooms at once, allowing them to observe several dependents simultaneously without manual room selection."**

---

## 14. Success Criteria for Capstone

✅ **Working Features**:
- User can start/stop monitoring
- Emergency contacts see real-time location
- Emergency SOS button works
- Mobile app works in background

✅ **Technical Requirements**:
- REST API for location uploads
- WebSocket rooms for real-time updates
- JWT authentication
- Basic data persistence

✅ **Simplified Scope**:
- No complex permission workflows
- No anomaly detection
- No multi-step escalation
- Focus on core functionality

**Total Implementation Time**: 10-12 hours for 2-3 students

---

## 15. Removed Features & Rationale

| Removed Feature | Why That's Good |
| --------------- | --------------- |
| Room modes | Unnecessary for implied consent |
| Join approvals | Slows emergency response |
| Anomaly detection | Out of scope for capstone |
| Complex escalation | Focused on core safety feature |
| Persistent sockets on mobile | OS-incompatible |
