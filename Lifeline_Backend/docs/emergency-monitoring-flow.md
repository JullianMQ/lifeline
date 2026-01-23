# Simplified Emergency Monitoring System

## System Architecture Overview

The Lifeline emergency monitoring system consists of three main components:

1. **Mobile Application** - Location tracking with REST-based uploads
2. **Backend API** - WebSocket room management + location broadcasting  
3. **Frontend Dashboard** - Real-time emergency monitoring interface

## Simplified User Flow

### 1. Start Monitoring Flow

```
Mobile App (User)               Backend API                    Web Dashboard (Emergency Contact)
┌─────────────────────┐         ┌─────────────────┐             ┌─────────────────────┐
│ 1. Tap "Start       │         │                 │             │                     │
│    Monitoring"      │         │                 │             │                     │
└─────────┬───────────┘         └─────────┬───────┘             └─────────┬───────────┘
          │                               │                               │
          │ WebSocket Connect              │                               │
          │ ws://api/ws                    │                               │
          │──────────────────────────────►│                               │
          │◄──────────────────────────────│ Connected                    │
          │                               │                               │
          │ { type: "create-room" }        │                               │
          │──────────────────────────────►│                               │
          │◄──────────────────────────────│ Room Created                  │
          │ Room ID: abc123                │                               │
          │                               │                               │
          │ Notify Emergency Contacts      │ Emergency Contact             │
          │ via Push/SMS                  │ receives notification         │
          │                               │                               │
          │ Start Foreground Service       │ Emergency Contact Connects     │
          │ Location Updates:              │◄─────────────────────────────│ WebSocket Connect
          │ POST /api/location             │ { type: "request-join",       │
          │ {lat, lng, timestamp}         │   roomId: "abc123" }          │
          │──────────────────────────────►│─────────────────────────────►│
          │                               │ Auto-approve Emergency         │
          │◄──────────────────────────────│ Contact                       │
          │                               │◄─────────────────────────────│ Join Approved
          │                               │ Add to Room                  │
          │                               │─────────────────────────────►│ User Joined Room
          │                               │                               │
          │ Location Updates Continue    │                               │
          │ POST /api/location             │ Broadcast to Room             │
          │──────────────────────────────►│◄─────────────────────────────│ Location Update
          │                               │ { type: "location-update",    │
          │                               │   lat, lng, timestamp }       │
└─────────┴───────────┘         └─────────┴───────┘             └─────────┴───────────┘
```

### 2. Emergency SOS Flow

```
Mobile App (User in Distress)    Backend API                    Emergency Contact Dashboard
┌─────────────────────┐          ┌─────────────────┐            ┌─────────────────────┐
│ Emergency Situation │          │                 │            │                     │
│ User triggers SOS   │          │                 │            │                     │
└─────────┬───────────┘          └─────────┬───────┘            └─────────┬───────────┘
          │                                │                              │
          │ { type: "emergency-sos" }      │                              │
          │──────────────────────────────►│                              │
          │◄──────────────────────────────│ Emergency Confirmed          │
          │                                │                              │
          │                                │ Find User's Room             │
          │                                │ Get Emergency Contacts       │
          │                                │                              │
          │                                │ Send Immediate Alert         │
          │                                │ to all contacts              │
          │                                │◄─────────────────────────────│ WebSocket Connected
          │                                │ { type: "emergency-alert",  │
          │                                │   emergencyUserId: "u1",    │
          │                                │   emergencyUserName: "John",│
          │                                │   roomId: "abc123",          │
          │                                │   message: "SOS ACTIVATED" }│
          │                                │─────────────────────────────►│
          │                                │                              │ Emergency Alert
          │                                │                              │ Displayed
          │                                │                              │
          │                                │ Emergency Contacts          │
          │                                │ Auto-Join Room               │
          │                                │◄─────────────────────────────│ { type: "request-join",
          │                                │ { roomId: "abc123" }         │    roomId: "abc123" }
          │                                │─────────────────────────────►│
          │                                │ Auto-approve                 │
          │                                │◄─────────────────────────────│ { type: "join-approved" }
          │                                │ Add to Room                  │
          │                                │─────────────────────────────►│ User in Emergency Room
          │                                │                              │
          │ High-frequency Updates      │ Real-time Location           │
          │ POST /api/location             │ Broadcasting                 │
          │──────────────────────────────►│◄─────────────────────────────│ Live Location Updates
          │◄──────────────────────────────│ { type: "location-update",   │ on Map (every 10s)
          │                                │   lat, lng, timestamp,       │
          │                                │   accuracy }                 │
└─────────┴───────────┘          └─────────┴───────┘            └─────────┴───────────┘
```

### 3. Mobile Disconnection Handling

```
Mobile App                      Backend API                    Web Dashboard
┌─────────────┐                ┌─────────────┐               ┌─────────────┐
│ Background   │                │             │               │             │
│ Tracking     │                │             │               │             │
└──────┬──────┘                └──────┬──────┘               └──────┬──────┘
       │                             │                             │
       │ WebSocket Disconnected       │                             │
       │ (App Backgrounded)          │                             │
       │◄─────────────────────────────│ Connection Lost              │
       │                             │                             │
       │ Foreground Service          │                             │
       │ Continues Working           │                             │
       │                             │                             │
       │ POST /api/location           │                             │
       │ {lat, lng, timestamp}        │                             │
       │────────────────────────────►│ Broadcast to Room             │
       │◄─────────────────────────────│ Success                      │
       │                             │◄─────────────────────────────│ Location Update
       │                             │ { type: "location-update",  │
       │                             │   lat, lng, timestamp }     │
       │                             │                             │
       │ App Returns to              │                             │
       │ Foreground                  │                             │
       │                             │                             │
       │ WebSocket Reconnect         │                             │
       │ ws://api/ws                 │                             │
       │────────────────────────────►│                             │
       │◄─────────────────────────────│ Connected + Room History     │
       │                             │                             │
       │ Sync Location History       │                             │
       │ { type: "sync-history",     │                             │
       │   locations: [...] }       │                             │
       │────────────────────────────►│◄─────────────────────────────│ History Synced
└──────┴──────┘                └──────┴──────┘               └──────┴──────┘
```

## Technical Implementation Details

### Mobile Application Responsibilities

#### 1. Authentication & Session Management
```typescript
// Login and session handling
async function login(credentials: LoginCredentials) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const { sessionToken } = await response.json();
  return sessionToken;
}

// WebSocket connection with auth
function connectWebSocket(sessionToken: string) {
  const ws = new WebSocket('ws://api.example.com/ws', [], {
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`
    }
  });
  return ws;
}
```

#### 2. Room Creation & Management
```typescript
// Create monitoring room
function createMonitoringRoom(ws: WebSocket) {
  ws.send(JSON.stringify({
    type: 'create-room'
  }));
}

// Handle room creation response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'room-created') {
    startLocationTracking(data.roomId);
    notifyEmergencyContacts(data.roomId);
  }
};
```

#### 3. Background Location Tracking
```typescript
// Android Foreground Service
class LocationTrackingService extends Service {
  async onStartCommand() {
    // Start persistent notification
    startForeground(NOTIFICATION_ID, createNotification());
    
    // Request location updates
    this.locationManager.requestLocationUpdates(
      LocationProvider.GPS,
      60000, // 60 second intervals (normal mode)
      0, // minimum distance
      this.locationListener
    );
  }
  
  onLocationChanged(location: Location) {
    // Upload via REST (works in background)
    fetch('/api/location', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.time,
        accuracy: location.accuracy
      })
    });
  }
  
  // Emergency mode: high-frequency updates
  switchToEmergencyMode() {
    this.locationManager.requestLocationUpdates(
      LocationProvider.GPS,
      10000, // 10 second intervals (emergency mode)
      0,
      this.locationListener
    );
  }
}
```

#### 4. Emergency Handling
```typescript
// Emergency SOS trigger
function triggerEmergency(ws: WebSocket) {
  ws.send(JSON.stringify({
    type: 'emergency-sos'
  }));
  
  // Switch to high-frequency location updates
  switchToEmergencyMode();
}

// Panic button with immediate location
function triggerPanicButton(ws: WebSocket, currentLocation: Location) {
  ws.send(JSON.stringify({
    type: 'panic-button',
    location: {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude
    }
  }));
}
```

### Backend API Responsibilities

#### 1. WebSocket Connection Management
```typescript
// WebSocket endpoint with authentication
app.get('/ws', upgradeWebSocket((c) => {
  const user = c.get('user');
  const clientId = user.id;
  
  return {
    onOpen(_event, ws) {
      const clientInfo: ClientInfo = {
        id: clientId,
        ws: ws,
        rooms: new Set(),
        user: user
      };
      
      clients.set(clientId, clientInfo);
      
      ws.send(JSON.stringify({
        type: 'connected',
        clientId: clientId,
        user: {
          id: user.id,
          name: user.name
        }
      }));
    }
  };
}));
```

#### 2. Room Creation
```typescript
// Room creation handler
case 'create-room': {
  const roomId = crypto.randomBytes(16).toString('hex');
    
  const room: Room = {
    id: roomId,
    ownerUserId: clientId,
    users: new Map(),
    createdAt: new Date(),
    isEmergency: false
  };
  
  rooms.set(roomId, room);
  
  // Add creator to room
  room.users.set(clientId, new Set([clientInfo.ws]));
  clientInfo.rooms.add(roomId);
  
  ws.send(JSON.stringify({
    type: 'room-created',
    roomId: roomId
  }));
}
```

#### 3. Emergency Contact Auto-Approval
```typescript
// Room join request handler
case 'request-join': {
  const { roomId } = data;
  const room = rooms.get(roomId);
  
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room not found'
    }));
    return;
  }
  
  // Validate emergency contact relationship
  const isEmergencyContact = await validateEmergencyContact(clientId, room.ownerUserId);
  
  if (!isEmergencyContact) {
    ws.send(JSON.stringify({
      type: 'join-denied',
      reason: 'Not an emergency contact'
    }));
    return;
  }
  
  // Auto-approve all emergency contacts
  room.users.set(clientId, new Set([clientInfo.ws]));
  clientInfo.rooms.add(roomId);
  
  ws.send(JSON.stringify({
    type: 'join-approved',
    roomId: roomId
  }));
  
  broadcastToRoom(roomId, {
    type: 'user-joined',
    user: {
      id: user.id,
      name: user.name
    }
  }, clientId);
}

// Validate emergency contact relationship
async function validateEmergencyContact(contactId: string, userId: string): Promise<boolean> {
  const contacts = await getEmergencyContacts(userId);
  return contacts.includes(contactId);
}
```

#### 4. Location Ingestion & Broadcasting
```typescript
// Location upload endpoint
app.post('/api/location', async (c) => {
  const user = c.get('user');
  const { latitude, longitude, timestamp, accuracy } = await c.req.json();
  
  // Validate input
  if (!latitude || !longitude || !timestamp) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  // Find user's active room
  let userRoom: Room | undefined;
  for (const room of rooms.values()) {
    if (room.users.has(user.id)) {
      userRoom = room;
      break;
    }
  }
  
  if (userRoom) {
    // Broadcast location to room members
    broadcastToRoom(userRoom.id, {
      type: 'location-update',
      data: {
        userId: user.id,
        userName: user.name,
        latitude,
        longitude,
        timestamp: new Date(timestamp),
        accuracy
      }
    }, user.id); // Don't send to self
  }
  
  return c.json({
    success: true,
    received: new Date().toISOString(),
    roomId: userRoom?.id || null
  });
});
```

#### 5. Emergency Escalation
```typescript
// Emergency SOS handler
case 'emergency-sos': {
  // Find user's room
  let userRoom: Room | undefined;
  for (const room of rooms.values()) {
    if (room.users.has(clientId)) {
      userRoom = room;
      break;
    }
  }
  
  if (!userRoom) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Not in any room'
    }));
    return;
  }
  
  // Mark room as emergency
  userRoom.isEmergency = true;
  
  // Notify all emergency contacts
  const emergencyContacts = await getEmergencyContacts(clientId);
  
  for (const contactId of emergencyContacts) {
    const contactClient = clients.get(contactId);
    if (contactClient) {
      contactClient.ws.send(JSON.stringify({
        type: 'emergency-alert',
        emergencyUserId: clientId,
        emergencyUserName: user.name,
        roomId: userRoom.id,
        message: 'SOS ACTIVATED - Immediate access granted'
      }));
    } else {
      // Contact is offline - send push notification
      await sendPushNotification(contactId, {
        type: 'emergency-alert',
        message: `${user.name} has triggered an emergency SOS`,
        roomId: userRoom.id
      });
    }
  }
  
  // Broadcast to all room members
  broadcastToRoom(userRoom.id, {
    type: 'emergency-activated',
    triggeredBy: clientId,
    message: 'Emergency mode activated'
  });
}
```

### Frontend Dashboard Responsibilities

#### 1. WebSocket Connection & Room Management
```typescript
// Dashboard WebSocket connection
function connectToDashboard(sessionToken: string) {
  const ws = new WebSocket('ws://api.example.com/ws', [], {
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`
    }
  });
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleDashboardMessage(data);
  };
  
  return ws;
}

// Handle incoming dashboard messages
function handleDashboardMessage(data: any) {
  switch (data.type) {
    case 'connected':
      updateDashboardState({ connected: true, user: data.user });
      break;
      
    case 'emergency-alert':
      showEmergencyAlert(data);
      autoJoinEmergencyRoom(data.roomId);
      break;
      
    case 'location-update':
      updateMapWithLocation(data.data);
      break;
      
    case 'user-joined':
      updateParticipantsList(data.user);
      break;
  }
}
```

#### 2. Emergency Auto-Join
```typescript
// Auto-join emergency room
function autoJoinEmergencyRoom(roomId: string) {
  ws.send(JSON.stringify({
    type: 'request-join',
    roomId: roomId
  }));
}

// Handle emergency approval
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'join-approved') {
    switchToEmergencyMode(data.roomId);
  }
});
```

#### 3. Real-time Location Display
```typescript
// Update map with user location
function updateMapWithLocation(locationData: LocationData) {
  const { userId, userName, latitude, longitude, timestamp, accuracy } = locationData;
  
  // Update map marker
  map.updateMarker(userId, {
    lat: latitude,
    lng: longitude,
    title: userName,
    timestamp: new Date(timestamp),
    accuracy: accuracy
  });
  
  // Update user info panel
  updateUserInfoPanel(userId, {
    lastSeen: new Date(timestamp),
    coordinates: { latitude, longitude },
    accuracy: accuracy
  });
  
  // Update location history
  addLocationToHistory(userId, locationData);
}
```

#### 4. Emergency UI State Management
```typescript
// Emergency mode activation
function switchToEmergencyMode(roomId: string) {
  // Update UI to emergency state
  document.body.classList.add('emergency-mode');
  
  // Show emergency controls
  showEmergencyControls({
    roomId: roomId,
    callEmergency: () => initiateEmergencyCall(),
    shareLocation: () => shareWithEmergencyServices(),
    contactHelp: () => contactNearbyHelp()
  });
  
  // Enable emergency recording
  startEmergencyRecording();
  
  // Show high-frequency location updates indicator
  showEmergencyTrackingIndicator();
}
```

## Edge Case Handling

### 1. Mobile WebSocket Disconnect During Movement
```typescript
// Reconnection logic with exponential backoff
class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  
  connect() {
    this.ws = new WebSocket('ws://api.example.com/ws');
    
    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.reconnectDelay *= 2;
          this.connect();
        }, this.reconnectDelay);
      }
    };
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.syncLocationHistory();
    };
  }
  
  syncLocationHistory() {
    // Sync missed location updates during disconnect
    this.ws.send(JSON.stringify({
      type: 'sync-history',
      fromTimestamp: this.lastSyncTimestamp
    }));
  }
}
```

### 2. Emergency Contacts Offline When Emergency Triggered
```typescript
// Offline notification handling
async function handleOfflineEmergencyContacts(roomId: string, userId: string) {
  const emergencyContacts = await getEmergencyContacts(userId);
  
  for (const contactId of emergencyContacts) {
    const contactClient = clients.get(contactId);
    
    if (!contactClient) {
      // Contact is offline - send push notification
      await sendPushNotification(contactId, {
        type: 'emergency-alert',
        message: `${userName} needs your help immediately`,
        roomId: roomId,
        actionUrl: `/emergency/${roomId}`
      });
      
      // Fallback SMS for critical emergencies
      if (userRoom?.isEmergency) {
        await sendSMSEmergencyAlert(contactId, {
          message: `EMERGENCY: ${userName} needs immediate help`,
          location: getLastKnownLocation(userId),
          roomId: roomId
        });
      }
    }
  }
}
```

### 3. Network Connectivity Issues
```typescript
// Location queuing for offline scenarios
class LocationQueue {
  private queuedLocations: LocationData[] = [];
  private isOnline = navigator.onLine;
  
  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  uploadLocation(location: LocationData) {
    if (this.isOnline) {
      this.sendLocation(location);
    } else {
      this.queueLocation(location);
    }
  }
  
  queueLocation(location: LocationData) {
    this.queuedLocations.push({
      ...location,
      queueTimestamp: Date.now()
    });
    
    // Limit queue size to prevent memory issues
    if (this.queuedLocations.length > 100) {
      this.queuedLocations.shift();
    }
  }
  
  async flushQueue() {
    while (this.queuedLocations.length > 0) {
      const location = this.queuedLocations.shift();
      try {
        await this.sendLocation(location);
      } catch (error) {
        // Re-queue if upload fails
        this.queuedLocations.unshift(location);
        break;
      }
    }
  }
}
```

## Security Considerations

### 1. Room Access Validation
```typescript
// Emergency contact validation
async function validateEmergencyContact(
  contactId: string,
  userId: string
): Promise<boolean> {
  const contacts = await getEmergencyContacts(userId);
  return contacts.includes(contactId);
}
```

### 2. Rate Limiting
```typescript
// Rate limiting for location uploads
const locationTracker = new Map<string, { count: number; resetTime: number }>();

function rateLimitLocationUpload(userId: string): boolean {
  const now = Date.now();
  const tracker = locationTracker.get(userId);
  
  if (!tracker || now > tracker.resetTime) {
    locationTracker.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (tracker.count >= 60) { // Max 60 uploads per minute (1 per second in emergency)
    return false;
  }
  
  tracker.count++;
  return true;
}
```

This simplified approach focuses on the core emergency monitoring functionality while removing unnecessary complexity around permissions and room modes. The system is now easier to understand and implement for a college capstone project while maintaining all essential features for real-time emergency monitoring.