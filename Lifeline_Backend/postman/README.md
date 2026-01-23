# Postman Tests - Lifeline WebSocket Emergency Monitoring

## 📁 Files in This Directory

| File | Description |
|-------|-------------|
| `lifeline-api-tests.json` | Postman collection for REST API tests |
| `lifeline-environment.json` | Postman environment variables |
| `lifeline-websocket-messages.json` | WebSocket message templates |
| `websocket-test-client.html` | Browser-based WebSocket test client |
| `README.md` | This file - complete guide |

## 🚀 Quick Start

### Step 1: Import Collection & Environment

1. Open **Postman Desktop**
2. Click **Import** (top left)
3. Select all files in this directory:
   - `lifeline-api-tests.json`
   - `lifeline-environment.json`
4. Select **"Lifeline Test Environment"** from environment dropdown (top right)

### Step 2: Start Server

```bash
bun run dev
```

Server should run on `http://localhost:3000`

### Step 3: Run Tests

**Option A: Run All Tests**
1. Click **"Lifeline WebSocket Emergency Monitoring"** collection
2. Click **"Run Collection"**
3. Click **"Run"**

**Option B: Run Individual Tests**
1. Expand the collection
2. Click a folder (e.g., **"Authentication"**)
3. Click **"Run"**

## 📊 Test Collections

### 1. lifeline-api-tests.json (REST API Tests)

Tests the REST API endpoints:

| Folder | Tests | What It Tests |
|--------|--------|---------------|
| Authentication | 3 tests | Sign-in and session token extraction |
| Contacts API | 2 tests | Emergency and dependent contact retrieval |
| Location API | 3 tests | Location upload, validation, WebSocket broadcast |
| WebSocket Info | 1 test | Active rooms monitoring |

**Total: 9 API tests**

### 2. lifeline-websocket-messages.json (WebSocket Templates)

WebSocket message templates for testing:

| Message | Description |
|----------|-------------|
| Connect to WebSocket | Establish connection with auth cookie |
| Create Room | Create new room with emergency contacts |
| Join Room | Emergency contact joins room |
| Send Room Message | Broadcast message to room members |
| Get Room Users | List users in room |
| Trigger Emergency SOS | Activate emergency mode |
| Ping | Keep-alive check |

**Note:** Postman WebSocket support is limited. Use the HTML client for full testing.

### 3. websocket-test-client.html (Browser Test Client)

Full-featured WebSocket test client for browser testing.

**Features:**
- ✅ Connect/Disconnect
- ✅ Send all message types
- ✅ Auto-save room IDs
- ✅ Real-time message logging
- ✅ Color-coded logs (sent/received/error)
- ✅ Beautiful UI

**How to Use:**
1. Open `websocket-test-client.html` in browser
2. Get session token from:
   - Postman sign-in tests
   - Or browser DevTools → Application → Cookies
3. Paste token in "Session Token" field
4. Click **"Connect"**
5. Send messages and see logs

## 👥 Test Users

All users have password: `password`

| User | Email | Phone | Role | Emergency Contacts |
|-------|--------|--------|-------|-------------------|
| test 1 | test1@example.com | 09123456789 | mutual | test2, test3 |
| test 2 | test2@example.com | 09123456788 | mutual | test1, test4 |
| test 3 | test3@example.com | 09123456787 | mutual | test1, test4 |
| test 4 | test4@example.com | 09123456786 | dependent | test2, test3 |
| test 5 | test5@example.com | 09123456785 | dependent | test1 |

## 🧪 Recommended Test Flow

### REST API Testing (Postman)

1. **Authentication** - Sign in test users
   - Run: **Sign In - Test User 1**
   - Run: **Sign In - Test User 2**
   - Run: **Sign In - Test User 3**
   - ✅ Check: Tokens saved to environment

2. **Contacts** - Verify relationships
   - Run: **Get User Contacts - Test 1**
   - ✅ Check: Returns emergency contacts array

3. **Location** - Test location API
   - Run: **Upload Location - Test 1**
   - ✅ Check: Returns success, broadcasts to WebSocket
   - Run: **Upload Location - Invalid Coordinates**
   - ✅ Check: Returns 400 error

4. **Rooms** - Monitor WebSocket state
   - Run: **Get Active Rooms Info**
   - ✅ Check: Returns active rooms array

### WebSocket Testing (Browser Client)

1. **Connect to WebSocket**
   - Open `websocket-test-client.html`
   - Get session token (from Postman or browser cookies)
   - Paste token and click **"Connect"**
   - ✅ Check: Connection status shows "✅ Connected"

2. **Create Room**
   - Select: **"Create Room"** from dropdown
   - Click: **"Send Message"**
   - ✅ Check: Receives "room-created" message with room ID

3. **Send Message**
   - Select: **"Send Room Message"**
   - Enter: Room ID (from previous step)
   - Enter: Message content
   - Click: **"Send Message"**
   - ✅ Check: Message appears in logs

4. **Trigger Emergency**
   - Select: **"Emergency SOS"**
   - Click: **"Send Message"**
   - ✅ Check: Receives "emergency-confirmed" message

5. **Multi-Room Test** (Open browser in another tab)
   - Sign in as test2 in another tab
   - Connect with test2's session token
   - ✅ Check: Auto-joins to test1's rooms

## 🔧 Environment Variables

Set automatically by tests:

| Variable | Description |
|-----------|-------------|
| `base_url` | http://localhost:3000/api |
| `ws_url` | ws://localhost:3000/api/ws |
| `better_auth_token` | Session token (auto from sign-in) |
| `test2_token` | Test user 2 session token |
| `test3_token` | Test user 3 session token |
| `test_room_id` | Room ID (auto from WebSocket) |
| `test_user_id` | Test user 1 ID |
| `test_user_phone` | Test user 1 phone number |

## 🎯 Test Coverage

### REST API (Postman)
- ✅ Email/password authentication
- ✅ Session token extraction
- ✅ Contact relationship queries
- ✅ Location upload with validation
- ✅ Location broadcasting to WebSocket
- ✅ Active rooms monitoring

### WebSocket (Browser Client)
- ✅ Connection with authentication
- ✅ Room creation with emergency contacts
- ✅ Room joining (emergency contact access)
- ✅ Room message broadcasting
- ✅ Emergency SOS triggers
- ✅ Multi-room auto-join
- ✅ Real-time message logging

## 📝 WebSocket Message Reference

### Client → Server

```json
// Create room
{"type": "create-room"}

// Join room (emergency contact)
{"type": "join-room", "roomId": "room-id-here"}

// Send message
{"type": "room-message", "roomId": "room-id-here", "content": "Hello!"}

// Get users
{"type": "get_users", "roomId": "room-id-here"}

// Emergency SOS
{"type": "emergency-sos"}

// Ping
{"type": "ping"}
```

### Server → Client

```json
// Connected
{"type": "connected", "clientId": "...", "user": {...}, "roomIds": [...]}

// Room created
{"type": "room-created", "roomId": "...", "emergencyContacts": 2}

// Auto-joined
{"type": "auto-joined", "roomId": "...", "roomOwner": "..."}

// Join approved
{"type": "join-approved", "roomId": "..."}

// Room message
{"type": "room-message", "roomId": "...", "content": "...", "senderName": "..."}

// Emergency alert
{"type": "emergency-alert", "emergencyUserId": "...", "roomId": "..."}

// Location update (from REST API)
{"type": "location-update", "data": {...}}

// Pong
{"type": "pong"}
```

## 🐛 Troubleshooting

### Postman Tests Fail

**Issue: Connection Refused**
```
Fix: Start server - bun run dev
```

**Issue: Authentication Failed**
```
Fix: 
- Check test users exist in database
- Verify password is "password"
- Check environment variables
```

**Issue: Tests Timeout**
```
Fix:
- Check server logs
- Verify server is running
- Check base_url in environment
```

### Browser WebSocket Client Issues

**Issue: Connection Failed**
```
Fix:
- Check session token is correct
- Verify WebSocket URL: ws://localhost:3000/api/ws
- Check server is running
```

**Issue: No Messages Received**
```
Fix:
- Check console for errors
- Verify session token hasn't expired
- Check server logs for WebSocket errors
```

**Issue: How to Get Session Token?**
```
Method 1 (Postman):
1. Run "Sign In - Test User 1"
2. Open "Test Results" tab
3. Check environment variable: better_auth_token

Method 2 (Browser):
1. Sign in via web app
2. Open DevTools (F12)
3. Go to Application → Cookies
4. Copy better-auth.session_token value
```

### Location Tests Don't Broadcast

**Issue: No WebSocket broadcast on location upload**

```
Fix:
- User must be in active room (create room via WebSocket first)
- Check WebSocket connections are active
- Verify room was created and user joined
- Monitor server logs for broadcast attempts
```

## 📚 Additional Documentation

- **WebSocket API**: `docs/websocket-api.md`
- **Implementation Notes**: `docs/websocket-implementation-notes.md`
- **Task Documentation**: `docs/websocket-todos.md`
- **Integration Tests**: `tests/README-REAL-TESTS.md`

## ✨ Features Tested

✅ **Authentication** - Email/password sign-in, session management
✅ **Contacts** - Emergency and dependent contact relationships
✅ **Location API** - Upload, validation, WebSocket broadcast
✅ **WebSocket** - Connection, messaging, room management
✅ **Multi-Room** - Emergency contacts in multiple rooms
✅ **Emergency** - SOS triggers, alerts, cross-room broadcasting
✅ **Auto-Join** - Emergency contacts auto-join on connection
✅ **Access Control** - Immediate access for contacts, denied for others

## 🎓 Summary

This directory provides:

1. **Postman Collection** - For REST API testing
2. **Environment File** - For variable management
3. **WebSocket Templates** - For message structure reference
4. **Browser Client** - For full WebSocket testing
5. **Complete Guide** - This file

Run tests to validate the complete WebSocket emergency monitoring system! 🚀
