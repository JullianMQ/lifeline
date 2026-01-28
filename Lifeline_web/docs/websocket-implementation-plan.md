# WebSocket Integration Plan (Capstone Scope)

**Project**: Lifeline Emergency Monitoring System  
**Goal**: Deliver a demo-ready dashboard that joins the backend WebSocket, streams live contact data, and surfaces emergency alerts for multiple dependents per contact (one active dependent per contact required for the thesis defense, multi-room extensible).  
**Primary Files**: `useWebSocket.ts`, `useDashboard.ts`, `DashboardContact.tsx`  
**Backend Reference**: `@Lifeline_Backend/src/routes/websocket.ts`

---

## 1. Ground Truth

- Backend `/api/ws` endpoint already authenticates BetterAuth sessions and auto-joins emergency contacts when a dependent’s mobile client creates a room. Frontend never creates rooms; it only connects and listens.
- Current frontend hooks still point at mock `/time`/`/message` endpoints and store hardcoded location/contact data. UI components consume fake structures that do not map to backend messages.
- We must replace the mocked data flow with the real socket feed while keeping the dashboard multi-card layout so multiple contacts can be monitored simultaneously.

---

## 2. Success Criteria

- Web dashboard connects to `/api/ws` using existing BetterAuth cookies (no extra auth work).
- The app displays live contact cards containing latest location, presence (online/offline), and alert state for every dependent assigned to the logged-in emergency contact. One active dependent is required for demo; state shape must support more without redesign.
- Emergency alerts sent from mobile trigger visible UI changes (badge + toast/modal) within the dashboard.
- Tests/metrics for thesis: automated unit coverage of message reducers, one integration test for the dashboard hook, and a manual measurement checklist that records connection success, average reconnection time, and alert latency during demo runs.

---

## 3. Implementation Overview

### Phase A – WebSocket Hook (`useWebSocket.ts`)

| Deliverable | Description |
| --- | --- |
| Connection & Auth | Build the socket URL from `API_BASE_URL`, rely on browser cookies for BetterAuth, add retry with exponential backoff (3 attempts) and expose `connectionStatus` + last error. |
| Shared State | Maintain a single source of truth: `rooms` (Set of room IDs we have joined/read), `locations` (Map keyed by dependent ID), `alerts` (array ordered by timestamp), `presence` (Map of userId → "online"/"offline"). Export these plus helper dispatchers through the hook. |
| Message Handling | Parse backend payloads for `connected`, `location-update`, `emergency-alert`, `user-joined`, `user-left`, `auto-joined`, `error`. Unknown types log a warning but do not crash. |
| Room Awareness | Since backend auto-joins, simply track whatever `roomId` arrives in messages and add/remove from `rooms`. No UI for create/join. |
| Type Sharing | Move message/DTO interfaces to `@Lifeline_web/src/types/realtime.ts` so `useDashboard` and components consume the same shapes as the hook. |

### Phase B – Dashboard Hook & Components (`useDashboard.ts`, `DashboardContact.tsx`)

| Deliverable | Description |
| --- | --- |
| Hook Integration | Replace fake `contloc`/`userloc` with selectors reading the `useWebSocket` state. Provide memoized getters: `getContactCards()`, `activeAlerts`, `connectionMeta`. |
| Multi-card Rendering | Map every dependent assigned to the emergency contact into a `DashboardContact` card. For now assume one dependent but keep array-based rendering and highlight the card for future multiple dependents. |
| Emergency UI | `DashboardContact` receives `location`, `presence`, and `alert` props. Add inline indicators (status chip + last update timestamp) and a global alert toast/list so multiple alerts can be acknowledged. |
| Read-only Join | Remove `handleSOS`/room creation buttons. Show a “Joined room: <roomId>” badge to reinforce backend-driven join logic. |
| Error/Loading | Display spinner until `connectionStatus === "connected"`. When disconnected, show a retry CTA that calls the hook’s manual reconnect method. |

### Phase C – Validation & Metrics

| Item | Details |
| --- | --- |
| Unit Tests | (1) Reducer for `useWebSocket` state transitions given sample messages. (2) `useDashboard` selectors mapping hook state to UI props. |
| Integration Test | Render dashboard with mocked hook that emits a location + alert; verify cards update and alert toast appears. |
| Manual Checklist | Scripted demo steps: connect dashboard, verify presence for dependent, start mock location streaming, trigger SOS from mobile, record measured latency (stopwatch) and reconnection behavior after manual network toggle. Capture metrics in thesis appendix. |

---

## 4. Technical Notes

### 4.1 Socket Construction & Auth

```typescript
import { API_BASE_URL } from "@/config/api";

const WS_BASE_URL = API_BASE_URL
  .replace("https://", "wss://")
  .replace("http://", "ws://");

const SOCKET_URL = `${WS_BASE_URL}/api/ws`;

const socket = new WebSocket(SOCKET_URL); // browser sends BetterAuth cookies automatically
```

Retry/backoff: wait 1s, 3s, 5s between attempts, then surface failure and require user click to retry again.

### 4.2 Shared Types (`src/types/realtime.ts`)

```typescript
export type BackendMessageType =
  | "connected"
  | "location-update"
  | "emergency-alert"
  | "user-joined"
  | "user-left"
  | "auto-joined"
  | "error";

export interface LocationUpdateMessage {
  type: "location-update";
  roomId: string;
  data: {
    userId: string;
    userName: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy?: number;
  };
}

export interface EmergencyAlertMessage {
  type: "emergency-alert";
  roomId: string;
  emergencyUserId: string;
  emergencyUserName: string;
  message: string;
  timestamp: string;
}
```

Continue defining presence and error messages similarly so both hooks import the same interfaces. Include derived frontend structures:

```typescript
export interface LocationData {
  userId: string;
  roomId: string;
  coords: { lat: number; lng: number };
  timestamp: string;
}

export interface EmergencyAlert {
  userId: string;
  roomId: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}
```

### 4.3 Hook State

```typescript
interface WebSocketState {
  connectionStatus: "connecting" | "connected" | "reconnecting" | "error";
  lastError?: string;
  rooms: Set<string>;
  locations: Map<string, LocationData>;
  presence: Map<string, "online" | "offline">;
  alerts: EmergencyAlert[];
}
```

Expose helper actions: `acknowledgeAlert(alertId)`, `manualReconnect()`, `clearError()` so the dashboard can remain presentation-focused.

### 4.4 Data Flow

```
Mobile App → Backend /api/ws → useWebSocket (state) → useDashboard (selectors) → DashboardContact components
```

`useDashboard` should not duplicate socket logic; it simply derives view models and merges them with whatever static contact metadata already exists (name, avatar, relationship).

---

## 5. Testing & Metrics Plan

1. **Automated Unit Tests**  
   - `useWebSocket.test.ts`: feed sample messages into the reducer and assert state updates for rooms, locations, presence, alerts.  
   - `useDashboard.test.ts`: mock hook output and ensure selectors format cards correctly (status chips, timestamps, alert badge).  

2. **Integration Test**  
   - Using React Testing Library, render `Dashboard` with a mocked `useWebSocket` provider that emits a `location-update` followed by an `emergency-alert`. Assert the contact card updates and the alert toast renders.  

3. **Manual Metrics Collection (for thesis appendix)**  
   - Record `connection success rate` across 5 launches (expected ≥4/5).  
   - Measure `alert latency` using stopwatch (mobile SOS button → dashboard alert). Target <2 seconds.  
   - Measure `reconnect time` by disabling/enabling network and timing until `connectionStatus` returns to `connected`. Target <5 seconds.  
   - Document results with screenshots/log excerpts.

---

## 6. Operational Notes

- **Environments**:  
  - Dev: `ws://localhost:<api-port>/api/ws` (likely 3001).  
  - Prod: `wss://<hosted-domain>/api/ws`.  
- **Retry Strategy**: automatic for first three failures, then UI button. Log every failure with timestamp for debugging.  
- **Graceful Degradation**: if socket stays down, show cached last known location and a banner explaining that data may be stale; no HTTP polling fallback needed for capstone.  
- **Multi-room Future Work**: once more than one dependent per contact is common, extend selectors to group by roomId and add UI grouping. Backend already sends room IDs, so ensure we store them today even if UI ignores grouping.

---

## 7. Timeline (4 days total)

1. **Day 1 – Phase A**: socket hookup, shared types, reducer + unit tests.  
2. **Day 2 – Phase B**: dashboard hook wiring, component updates, emergency UI.  
3. **Day 3 – Phase C**: integration test, manual metrics dry run, fix polish issues.  
4. **Day 4 – Buffer**: rehearse demo, capture screenshots/logs for thesis.

---

## 8. Definition of Done

- `useWebSocket` replaces mock endpoints, exposes stable typed state, and passes unit tests.
- `useDashboard`/`DashboardContact` render real data for at least one dependent and gracefully handle multiple entries without code changes.
- Emergency alerts raised from mobile appear on the web UI with latency recorded in the manual metrics log.
- Integration test and manual checklist results documented for inclusion in the thesis report.

This trimmed plan keeps the capstone focused on delivering a working demo while proving the necessary technical rigor (authentication, multi-contact readiness, and documented testing/metrics) without over-investing in production analytics tooling.
