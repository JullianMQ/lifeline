# Postman Tests - Complete ✅

## 📁 Files Created

| File | Size | Description |
|------|-------|-------------|
| `lifeline-api-tests.json` | 15KB | Main Postman collection - REST API tests |
| `lifeline-environment.json` | 1.6KB | Postman environment variables |
| `lifeline-websocket-messages.json` | 3.3KB | WebSocket message templates |
| `websocket-test-client.html` | 15KB | Browser-based WebSocket test client |
| `README.md` | 9.4KB | Complete testing guide |
| `POSTMAN-TESTS-SUMMARY.md` | This file | Quick overview |

## 🚀 How to Use

### Import into Postman

1. **Open Postman Desktop**
2. **Click Import** (top left)
3. **Select these files:**
   - `lifeline-api-tests.json` - API tests
   - `lifeline-environment.json` - Environment
4. **Select environment**: "Lifeline Test Environment" (top right dropdown)

### Start Server

```bash
bun run dev
```

### Run Tests

**Option 1: Run All Tests**
1. Click collection name: "Lifeline WebSocket Emergency Monitoring"
2. Click "Run Collection" button
3. Click "Run"

**Option 2: Run Individual Folders**
1. Expand collection
2. Click folder name (e.g., "Authentication")
3. Click "Run"

## 📊 What Gets Tested

### REST API Tests (Postman)

| Folder | Tests | Description |
|--------|--------|-------------|
| Authentication | 3 | Sign-in, session token extraction |
| Contacts API | 2 | Emergency contact retrieval |
| Location API | 3 | Upload, validation, broadcast |
| WebSocket Info | 1 | Active rooms monitoring |

**Total: 9 REST API tests**

### WebSocket Tests (Browser Client)

Open `websocket-test-client.html` in browser:

- ✅ Connect to WebSocket with authentication
- ✅ Create room with emergency contacts
- ✅ Join room (emergency contact)
- ✅ Send room messages
- ✅ Get room users
- ✅ Trigger emergency SOS
- ✅ Multi-room auto-join
- ✅ Real-time message logging

## 👥 Test Users

All passwords: `password`

| Name | Email | Phone | Role | Emergency Contacts |
|------|--------|--------|-------|-------------------|
| test 1 | test1@example.com | 09123456789 | mutual | test2, test3 |
| test 2 | test2@example.com | 09123456788 | mutual | test1, test4 |
| test 3 | test3@example.com | 09123456787 | mutual | test1, test4 |
| test 4 | test4@example.com | 09123456786 | dependent | test2, test3 |
| test 5 | test5@example.com | 09123456785 | dependent | test1 |

## 🎯 Test Features Validated

### Authentication
- ✅ Email/password sign-in
- ✅ Session token extraction from cookies
- ✅ Multiple user sessions

### Contacts API
- ✅ Get emergency contacts
- ✅ Get dependent contacts
- ✅ Contact relationship validation

### Location API
- ✅ Valid location uploads
- ✅ Input validation (coordinates, required fields)
- ✅ WebSocket broadcasting
- ✅ Error handling

### WebSocket
- ✅ Connection with authentication
- ✅ Room creation
- ✅ Emergency contact join (immediate access)
- ✅ Room message broadcasting
- ✅ Emergency SOS triggers
- ✅ Multi-room support
- ✅ Auto-join functionality

## 🔧 Environment Variables

Auto-populated during tests:

```json
{
  "base_url": "http://localhost:3000/api",
  "ws_url": "ws://localhost:3000/api/ws",
  "better_auth_token": "...", // Auto from sign-in
  "test2_token": "...",
  "test3_token": "...",
  "emergency_contact_phones": [...],
  "test_room_id": "...", // Auto from WebSocket
  "test_user_id": "vM2AijO3q38WcXOUi62UXYBzb4yxAKY5",
  "test_user_phone": "09123456789"
}
```

## 📝 WebSocket Message Types

### Client → Server

```json
// Create room
{"type": "create-room"}

// Join room
{"type": "join-room", "roomId": "your-room-id"}

// Send message
{"type": "room-message", "roomId": "...", "content": "Hello!"}

// Get users
{"type": "get_users", "roomId": "..."}

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

// Location update
{"type": "location-update", "data": {...}}

// Pong
{"type": "pong"}
```

## 🧪 Complete Test Flow

### REST API Testing (Postman)

1. **Authentication**
   ```
   Run: Sign In - Test User 1
   Run: Sign In - Test User 2
   Run: Sign In - Test User 3
   Check: Tokens in environment
   ```

2. **Contacts**
   ```
   Run: Get User Contacts - Test 1
   Check: Emergency contacts array
   ```

3. **Location**
   ```
   Run: Upload Location - Test 1
   Check: Success response
   Run: Upload Location - Invalid Coordinates
   Check: 400 error
   ```

4. **Rooms**
   ```
   Run: Get Active Rooms Info
   Check: Rooms array
   ```

### WebSocket Testing (Browser)

1. **Open Client**
   ```
   Open: postman/websocket-test-client.html
   ```

2. **Get Session Token**
   ```
   From: Postman sign-in tests
   Or: Browser DevTools → Application → Cookies
   ```

3. **Connect**
   ```
   Paste token in Session Token field
   Click: Connect
   Check: Status shows "✅ Connected"
   ```

4. **Create Room**
   ```
   Select: Create Room
   Click: Send Message
   Check: Receives "room-created" with room ID
   ```

5. **Test Multi-Room**
   ```
   Open client in another tab
   Sign in as test2
   Connect with test2's token
   Check: Auto-joins to test1's room
   ```

6. **Send Message**
   ```
   Select: Send Room Message
   Enter: Room ID and content
   Click: Send Message
   Check: Message appears in both tabs
   ```

7. **Trigger Emergency**
   ```
   Select: Emergency SOS
   Click: Send Message
   Check: Emergency alerts in all tabs
   ```

## 🎨 Browser Test Client Features

### UI Elements
- ✅ Connection status indicator (Connected/Disconnected/Connecting)
- ✅ WebSocket URL input
- ✅ Session token input
- ✅ Message type selector
- ✅ Room ID input (auto-filled)
- ✅ Message content input
- ✅ Connect/Disconnect buttons
- ✅ Real-time message logs

### Log Features
- 🟢 **Received messages** - Blue left border
- 🟡 **Sent messages** - Green left border
- 🔴 **Errors** - Red left border
- ⏰ **Timestamps** - On every message
- 📦 **Message objects** - Formatted JSON

### Auto-Save Features
- Room ID auto-saved from:
  - "connected" message
  - "room-created" message
  - "auto-joined" message
- No need to manually copy room IDs!

## 🐛 Troubleshooting

### Postman Tests

| Issue | Solution |
|--------|----------|
| ECONNREFUSED | Start server: `bun run dev` |
| Auth failed | Check test users exist, password is "password" |
| No tokens | Select "Lifeline Test Environment" from dropdown |
| Tests timeout | Check server logs, verify port 3000 |

### Browser Client

| Issue | Solution |
|--------|----------|
| Connection failed | Check session token, verify server running |
| No messages | Check console for errors, verify token not expired |
| Room ID empty | Create room first, ID auto-saves to input |
| How to get token? | Run Postman sign-in test OR check browser cookies |

### Location Tests

| Issue | Solution |
|--------|----------|
| No broadcast | User must be in active room via WebSocket |
| Validation error | Check coordinates: lat (-90 to 90), lon (-180 to 180) |
| Missing fields | Ensure timestamp is provided in ISO format |

## 📚 Documentation Files

- **README.md** - Complete testing guide
- **lifeline-api-tests.json** - Postman collection
- **lifeline-environment.json** - Environment variables
- **lifeline-websocket-messages.json** - WebSocket templates
- **websocket-test-client.html** - Browser test client
- **POSTMAN-TESTS-SUMMARY.md** - This file

## 🎓 Test Coverage Summary

### REST API (Postman)
- ✅ Authentication flow
- ✅ Contact relationships
- ✅ Location uploads
- ✅ Input validation
- ✅ WebSocket broadcasting trigger
- ✅ Active room monitoring

### WebSocket (Browser Client)
- ✅ Connection management
- ✅ Room creation
- ✅ Room joining
- ✅ Message broadcasting
- ✅ Emergency features
- ✅ Multi-room architecture
- ✅ Auto-join functionality
- ✅ Real-time logging

## ✨ Summary

You now have:

1. **Postman Collection** - For REST API testing
2. **Environment File** - For variable management
3. **WebSocket Templates** - For message reference
4. **Browser Client** - For full WebSocket testing
5. **Complete Documentation** - Everything explained

**Total Files:** 6
**Total Size:** ~45KB

All ready to import into Postman and start testing! 🚀

## 🚀 Next Steps

1. Import collection and environment into Postman
2. Ensure server is running: `bun run dev`
3. Run all tests from collection
4. Open browser client for WebSocket testing
5. Verify all tests pass

**Happy Testing!** 🎉
