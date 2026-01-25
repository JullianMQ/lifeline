# WebSocket Integration Plan for Dashboard Monitoring

**Project**: Lifeline Emergency Monitoring System
**Scope**: Real-time WebSocket connection for dashboard monitoring
**Files**: `useWebSocket.ts`, `useDashboard.ts`, `DashboardContact.tsx`
**Backend Reference**: `@Lifeline_Backend/src/routes/websocket.ts`
**Design Document**: `@Lifeline_Backend/docs/lifeline-websocket-design.md`

---

## 1. Current State Analysis

### 1.1 Backend WebSocket Server ✅

**Location**: `@Lifeline_Backend/src/routes/websocket.ts`

**Features**:
- **Multi-room architecture** with single endpoint (`/ws`)
- **BetterAuth authentication** integration via session validation
- **Emergency contact auto-join** functionality
- **Room creation and management** with emergency contact pre-loading
- **Real-time location broadcasting** via REST + WebSocket integration
- **Emergency SOS system** with cross-room notifications
- **Comprehensive error handling** and logging
- **Room cleanup** and persistence

**Message Types Supported**:
```typescript
type BackendMessage = {
  type: "connected" | "room-created" | "join-approved" | "room-message" | 
        "emergency-sos" | "location-update" | "user-joined" | "user-left" |
        "emergency-alert" | "auto-joined" | "pong" | "error" | "get_users";
  // ... comprehensive fields with user info, timestamps, room data
}
```

### 1.2 Frontend BetterAuth Integration ✅

**Authentication Status**: **FULLY INTEGRATED**

**Key Components**:
- `auth-client.ts` - BetterAuth client configuration
- `ProtectedRoute.tsx` - Session validation and role-based access
- Session cookies with HTTP-only and JWE encryption
- Role-based access (dependent users blocked from web dashboard)

**Authentication Flow**:
```typescript
// Session validation via API
const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
  credentials: "include", // Automatically sends BetterAuth session cookies
});

// WebSocket will automatically include same session cookies
```

### 1.3 Current WebSocket Implementation ❌

**Location**: `@Lifeline_web/src/scripts/useWebSocket.ts`

**Problems**:
- **Wrong Endpoints**: Uses `/time` and `/message` instead of `/api/ws`
- **No BetterAuth Integration**: Doesn't leverage existing authentication
- **Single-Room Limitation**: Cannot handle multi-room emergency monitoring
- **Outdated Message Types**: Incompatible with backend message structure
- **No Real-time Features**: Missing location updates and emergency alerts

---

## 2. Implementation Goals

### 2.1 Primary Objectives

1. **Connect to Backend WebSocket Server**: Integrate with existing `/api/ws` endpoint
2. **Leverage BetterAuth Authentication**: Use existing session management
3. **Enable Real-time Dashboard Monitoring**: Replace fake data with live updates
4. **Support Multi-room Emergency Contact Monitoring**: Handle multiple dependents
5. **Implement Emergency SOS Notifications**: Real-time emergency alerts
6. **Remove Hardcoded Data**: Eliminate fake location data and polling

### 2.2 Success Metrics

✅ WebSocket connects with existing BetterAuth session  
✅ Auto-joins authorized emergency rooms as emergency contact  
✅ Real-time location updates replace fake data in dashboard  
✅ Emergency SOS notifications work immediately  
✅ User presence tracking displays correctly  
✅ Multi-room support for monitoring multiple dependents  

---

## 3. Detailed Implementation Plan

### Phase 1: WebSocket Service Core Integration

**File**: `@Lifeline_web/src/scripts/useWebSocket.ts`

#### Phase 1.1: WebSocket Connection Setup

**Tasks**:
- [ ] **TASK-WS-001**: Replace `/time` and `/message` endpoints with `/api/ws`
- [ ] **TASK-WS-002**: Implement BetterAuth session cookie handling
- [ ] **TASK-WS-003**: Add WebSocket URL configuration using existing API_BASE_URL
- [ ] **TASK-WS-004**: Implement connection retry logic
- [ ] **TASK-WS-005**: Add connection status monitoring

#### Phase 1.2: Message Type Implementation

**Tasks**:
- [ ] **TASK-WS-006**: Implement `connected` message handler for session confirmation
- [ ] **TASK-WS-007**: Implement `location-update` message handler for real-time locations
- [ ] **TASK-WS-008**: Implement `emergency-alert` message handler for SOS notifications
- [ ] **TASK-WS-009**: Implement `user-joined` and `user-left` for presence management
- [ ] **TASK-WS-010**: Implement `auto-joined` handler for emergency contact notifications
- [ ] **TASK-WS-011**: Implement `error` message handler with proper error states

#### Phase 1.3: Multi-room Support

**Tasks**:
- [ ] **TASK-WS-012**: Replace single room state with `roomIds: Set<string>`
- [ ] **TASK-WS-013**: Implement room state management for multiple monitoring sessions
- [ ] **TASK-WS-014**: Add room-specific message routing
- [ ] **TASK-WS-015**: Implement room cleanup on disconnection

#### Phase 1.4: Emergency Features

**Tasks**:
- [ ] **TASK-WS-016**: Remove `emergency-sos` message sending capability (web dashboard should only receive, not send SOS)
- [ ] **TASK-WS-017**: Implement `emergency-alert` message receiving and state management
- [ ] **TASK-WS-018**: Implement dashboard emergency alert display and notification handling

### Phase 2: Dashboard Hook Integration

**File**: `@Lifeline_web/src/scripts/useDashboard.ts`

#### Phase 2.1: WebSocket Integration

**Tasks**:
- [ ] **TASK-DB-001**: Import and integrate updated `useWebSocket` hook
- [ ] **TASK-DB-002**: Replace fake `contloc` data with real-time WebSocket location data
- [ ] **TASK-DB-003**: Add real-time contact state management
- [ ] **TASK-DB-004**: Implement emergency alert handling in dashboard

#### Phase 2.2: Data Flow Updates

**Tasks**:
- [ ] **TASK-DB-005**: Remove hardcoded location data (`contloc` and `userloc`)
- [ ] **TASK-DB-006**: Replace static contact data with WebSocket-powered updates
- [ ] **TASK-DB-007**: Add loading states for WebSocket connection
- [ ] **TASK-DB-008**: Add error handling for WebSocket disconnections

#### Phase 2.3: SOS Function Updates

**Tasks**:
- [ ] **TASK-DB-009**: Remove `handleSOS` emergency-sos sending (web dashboard should only receive alerts)
- [ ] **TASK-DB-010**: Replace with emergency alert receiving functionality
- [ ] **TASK-DB-011**: Add emergency alert acknowledgment and handling

#### Phase 2.4: User and Contact Management

**Tasks**:
- [ ] **TASK-DB-012**: Update user info display with real-time presence data
- [ ] **TASK-DB-013**: Add contact status indicators (online/offline/in-emergency)
- [ ] **TASK-DB-014**: Implement real-time contact location updates

### Phase 3: Dashboard Component Updates

**File**: `@Lifeline_web/src/components/DashboardContact.tsx`

#### Phase 3.1: Real-time Data Integration

**Tasks**:
- [ ] **TASK-COMP-001**: Add props for real-time location updates
- [ ] **TASK-COMP-002**: Add props for emergency alert status
- [ ] **TASK-COMP-003**: Add props for user presence information
- [ ] **TASK-COMP-004**: Implement real-time location display updates

#### Phase 3.2: Emergency Features UI

**Tasks**:
- [ ] **TASK-COMP-005**: Add emergency alert notification UI
- [ ] **TASK-COMP-006**: Add visual indicators for emergency status
- [ ] **TASK-COMP-007**: Implement emergency alert handling buttons/actions

#### Phase 3.3: User Experience Enhancements

**Tasks**:
- [ ] **TASK-COMP-008**: Add connection status indicator
- [ ] **TASK-COMP-009**: Add last update timestamp for location data
- [ ] **TASK-COMP-010**: Add loading states for real-time data

---

## 4. Technical Implementation Details

### 4.1 WebSocket Authentication Strategy

**Leveraging Existing BetterAuth Setup**:
```typescript
// From /src/config/api.ts
export const API_BASE_URL = import.meta.env.VITE_NODE_ENV === 'production' 
  ? import.meta.env.VITE_HOSTED_BETTER_AUTH_URL 
  : import.meta.env.VITE_LOCAL_BETTER_AUTH_URL;

// WebSocket URL construction
const WS_BASE_URL = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
const wsUrl = `${WS_BASE_URL}/api/ws`;

// WebSocket connection will automatically include BetterAuth session cookies
const ws = new WebSocket(wsUrl);

// Browser automatically sends with connection:
// Cookie: better-auth.session_token=xxxxx; other-session-data...

// Backend validates session (already implemented in websocket.ts):
// Line 597-607 in /Lifeline_Backend/src/routes/websocket.ts
ws.use("*", async (c, next) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) {
            console.log(`[${new Date().toISOString()}] Unauthorized access attempt to ${c.req.path}`);
            return c.json({ error: "Unauthorized" }, 401);
        }
        c.set("user", session.user);
        return next();
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Auth error for ${c.req.path}:`, error);
        return c.json({ error: "Authentication failed" }, 401);
    }
});
```

**Authentication Flow Reference**:
```typescript
// 1. Frontend: ProtectedRoutes validates session (already implemented)
// File: /src/scripts/ProtectedRoute.tsx - Lines 20-40
const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
  credentials: "include", // Includes BetterAuth session cookies
});

// 2. Frontend: WebSocket connects with same session cookies
// File: /src/scripts/useWebSocket.ts - To be updated
const ws = new WebSocket(`${WS_BASE_URL}/api/ws`);
// Browser automatically includes same session cookies from fetch()

// 3. Backend: WebSocket middleware validates session
// File: /Lifeline_Backend/src/routes/websocket.ts - Lines 597-607
const session = await auth.api.getSession({ headers: c.req.raw.headers });

// 4. Backend: Session data available for room management
// File: /Lifeline_Backend/src/routes/websocket.ts - Lines 643-646
const user = c.get("user");
if (!user) return c.json({ error: "User not found" }, 401);
const clientId = user.id; // User ID used as WebSocket client identifier
```

### 4.2 Data Flow Architecture

```
useDashboard Hook → useWebSocket Hook → /api/ws (BetterAuth Authenticated)
                      ↓
                 Real-time Messages (location-update, emergency-alert, etc.)
                      ↓
            Update Dashboard State → DashboardContact Component
```

### 4.3 Message Type Mapping

**Backend → Frontend**:
```typescript
// Location Updates
{
  type: "location-update",
  data: {
    userId: string,
    userName: string,
    latitude: number,
    longitude: number,
    timestamp: string,
    accuracy?: number
  }
}

// Emergency Alerts
{
  type: "emergency-alert",
  emergencyUserId: string,
  emergencyUserName: string,
  roomId: string,
  message: string,
  timestamp: string
}

// User Presence
{
  type: "user-joined" | "user-left",
  clientId: string,
  user: {
    id: string,
    name: string,
    email: string,
    role: string,
    phone_no: string
  },
  timestamp: string
}
```

**Frontend → Backend**:
```typescript
// Room Management (handled automatically)
{
  type: "create-room",
  // optional: roomId: string
}

// Note: Web dashboard does NOT send emergency-sos messages
// Emergency alerts are only received from mobile clients
```

### 4.4 State Management Structure

```typescript
// useWebSocket Hook State
interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  roomIds: Set<string>;
  locationData: Map<string, LocationData>; // userId -> location
  emergencyAlerts: EmergencyAlert[];
  connectionError: string | null;
}

// Location Data Structure
interface LocationData {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  roomId: string;
}

// Emergency Alert Structure
interface EmergencyAlert {
  emergencyUserId: string;
  emergencyUserName: string;
  roomId: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}
```

---

## 5. Testing Strategy

### 5.1 Unit Testing

**Components**:
- [ ] **TEST-WS-001**: WebSocket connection establishment
- [ ] **TEST-WS-002**: Message parsing and handling
- [ ] **TEST-WS-003**: Room state management
- [ ] **TEST-DB-001**: Dashboard state updates
- [ ] **TEST-DB-002**: Emergency alert handling

### 5.2 Integration Testing

**Workflows**:
- [ ] **TEST-INT-001**: End-to-end WebSocket authentication
- [ ] **TEST-INT-002**: Real-time location updates flow
- [ ] **TEST-INT-003**: Emergency SOS notification flow
- [ ] **TEST-INT-004**: Multi-room emergency contact monitoring
- [ ] **TEST-INT-005**: Connection recovery and reconnection

### 5.3 User Acceptance Testing

**Scenarios**:
- [ ] **TEST-UAT-001**: Emergency contact can monitor dependent's location in real-time
- [ ] **TEST-UAT-002**: Emergency SOS triggers immediate notifications
- [ ] **TEST-UAT-003**: Multiple dependents can be monitored simultaneously
- [ ] **TEST-UAT-004**: Dashboard handles connection interruptions gracefully
- [ ] **TEST-UAT-005**: User presence status updates correctly

---

## 6. Deployment Considerations

### 6.1 Environment Configuration

**WebSocket URLs**:
```typescript
// Development
const WS_BASE_URL = "ws://localhost:3001/api/ws";

// Production
const WS_BASE_URL = "wss://api.lifeline.com/api/ws";
```

### 6.2 Fallback Strategies

**Connection Failures**:
- [ ] **DEPLOY-001**: Implement WebSocket connection retry with exponential backoff
- [ ] **DEPLOY-002**: Add fallback to HTTP polling for critical updates
- [ ] **DEPLOY-003**: Implement graceful degradation for real-time features

### 6.3 Performance Optimization

**Real-time Updates**:
- [ ] **PERF-001**: Implement debouncing for rapid location updates
- [ ] **PERF-002**: Add message batching for multiple updates
- [ ] **PERF-003**: Optimize re-render cycles in dashboard components

---

## 7. Rollout Plan

### 7.1 Phase 1: Core WebSocket Connection
**Duration**: 1-2 days
**Tasks**: TASK-WS-001 through TASK-WS-015
**Deliverable**: Functional WebSocket connection with BetterAuth authentication

### 7.2 Phase 2: Dashboard Integration
**Duration**: 1-2 days
**Tasks**: TASK-DB-001 through TASK-DB-014
**Deliverable**: Dashboard with real-time location updates

### 7.3 Phase 3: Emergency Features
**Duration**: 1 day
**Tasks**: TASK-COMP-001 through TASK-COMP-010
**Deliverable**: Full emergency monitoring and alert receiving system (web dashboard receives alerts, does not send SOS)

### 7.4 Phase 4: Testing and Polish
**Duration**: 1 day
**Tasks**: All TEST tasks
**Deliverable**: Production-ready real-time dashboard monitoring

---

## 8. Risk Mitigation

### 8.1 Technical Risks

**WebSocket Connection Issues**:
- **Risk**: Connection failures or authentication errors
- **Mitigation**: Implement retry logic and fallback mechanisms

**Performance Issues**:
- **Risk**: Too many real-time updates causing performance degradation
- **Mitigation**: Implement debouncing and message batching

### 8.2 User Experience Risks

**Connection Interruptions**:
- **Risk**: Users experience disconnects without clear indication
- **Mitigation**: Add connection status indicators and auto-reconnection

**Data Consistency**:
- **Risk**: Outdated or incorrect location data
- **Mitigation**: Add timestamp validation and data freshness indicators

---

## 9. Success Metrics and KPIs

### 9.1 Technical Metrics

- **Connection Success Rate**: >95% WebSocket connections established successfully
- **Message Delivery Rate**: >99% real-time messages delivered without loss
- **Connection Recovery Time**: <5 seconds average reconnection time

### 9.2 User Experience Metrics

- **Location Update Latency**: <2 seconds from mobile upload to dashboard display
- **Emergency Alert Delivery**: <1 second from SOS trigger to notification
- **Dashboard Responsiveness**: No UI freezing during real-time updates

---

## 10. Post-Implementation Monitoring

### 10.1 Analytics

**Connection Metrics**:
- WebSocket connection success/failure rates
- Connection duration and frequency
- Message throughput and latency

**User Engagement**:
- Real-time feature usage statistics
- Emergency alert response times
- Multi-room monitoring usage

### 10.2 Alerting

**System Health**:
- WebSocket connection failures
- High message latency alerts
- Unusual error rates in message handling

**User Impact**:
- Emergency alert delivery failures
- Extended connection interruptions
- Performance degradation incidents

---

## 11. Conclusion

This implementation plan leverages the existing BetterAuth infrastructure and production-ready backend WebSocket server to deliver real-time dashboard monitoring capabilities. The phased approach ensures systematic implementation with proper testing and validation at each stage.

**Key Advantages**:
- ✅ BetterAuth already integrated - no authentication changes needed
- ✅ Backend WebSocket server is production-ready
- ✅ Session cookies automatically handle WebSocket authentication
- ✅ Multi-room emergency monitoring architecture already designed
- ✅ Comprehensive message types and error handling in backend

**Expected Timeline**: 4-6 days total implementation time
**Success Criteria**: All tasks marked as completed with testing validation

This plan provides a clear roadmap for implementing real-time WebSocket dashboard monitoring that will significantly enhance the Lifeline emergency monitoring system's capabilities.
