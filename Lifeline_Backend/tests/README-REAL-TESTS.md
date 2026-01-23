# Real Integration Tests

These are actual integration tests that use the real codebase, database, and WebSocket server implementation.

## Prerequisites

1. **Server must be running** on `http://localhost:3000`:
   ```bash
   bun run dev
   ```

2. **Database must be configured** with test users:
   - Test users should exist in the database
   - All test users have password: `password`

3. **Environment variables** should be set in `.env` file:
   ```
   DATABASE_URL=postgresql://...
   LOCAL_BETTER_AUTH_URL=http://localhost:3000/api/auth
   HOSTED_BETTER_AUTH_URL=http://localhost:3000/api/auth
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

## Test Users

The tests use these real users from your database:

| Name | Email | Phone | Role | Emergency Contacts |
|------|--------|--------|-------|-------------------|
| test 1 | test1@example.com | 09123456789 | mutual | test3, test2 |
| test 2 | test2@example.com | 09123456788 | mutual | test1, test4 |
| test 3 | test3@example.com | 09123456787 | mutual | test1, test4 |
| test 4 | test4@example.com | 09123456786 | dependent | test2, test3 |
| test 5 | test5@example.com | 09123456785 | dependent | test1 |

**All passwords are: `password`**

## Running Tests

### Option 1: Run all tests (unit + integration)
```bash
bun test
```

### Option 2: Run only real integration tests
```bash
bun run test:real
```

### Option 3: Run specific test file
```bash
bun test tests/websocket-real-integration.test.ts
```

## Test Suites

### 1. Multi-Room Creation & Emergency Contact Loading
- Creates multiple rooms with emergency contacts
- Verifies emergency contacts are loaded in each room

### 2. Emergency Contact Multi-Room Immediate Access
- Emergency contacts join rooms immediately without approval
- Verifies join-approved notifications

### 3. Non-Contact Multi-Room Access Denied
- Non-emergency contacts are denied room access
- Verifies join-denied responses

### 4. Auto-Join on Connection
- Emergency contacts auto-join authorized rooms on connection
- Verifies auto-joined and auto-join-summary messages

### 5. Room Messaging
- Broadcasts messages to all room members
- Verifies message delivery and format

### 6. Location Broadcasting
- REST API location updates broadcast to WebSocket rooms
- Verifies location-update messages

### 7. Emergency SOS Trigger
- Cross-room emergency alerts
- Verifies emergency-alert and emergency-activated messages

### 8. Room Users List
- Returns list of users in a room
- Verifies room-users response

## Architecture Tested

### WebSocket Endpoint
- URL: `ws://localhost:3000/api/ws`
- Authentication: Required via session cookies
- Multi-room support: ✅
- Auto-join functionality: ✅

### REST Endpoints Tested
- `POST /api/auth/sign-in/email` - Authentication
- `POST /api/location` - Location uploads with WebSocket broadcast

### Multi-Room Features
- Emergency contacts in multiple rooms: ✅
- Cross-room emergency notifications: ✅
- Auto-join on connection: ✅
- Room cleanup: ✅

## Test Coverage

The real integration tests cover:
- ✅ Real WebSocket connections to actual server
- ✅ Real authentication using Better Auth
- ✅ Real database queries for emergency contacts
- ✅ Real message broadcasting via WebSocket
- ✅ Real REST API calls for location updates
- ✅ Multi-room emergency scenarios
- ✅ Access control enforcement

## Troubleshooting

### Tests fail with "ECONNREFUSED"
Make sure the server is running:
```bash
bun run dev
```

### Tests fail with "Unauthorized"
Verify:
- Test users exist in database
- Environment variables are set correctly
- Database connection is working

### Tests timeout
- Check server logs for errors
- Verify WebSocket endpoint is accessible
- Check database connection

### Authentication fails
- Verify user emails exist in database
- Check password is "password" for all test users
- Ensure email verification is not required (or users are verified)

## Debugging

To see what's happening during tests:

1. **Server logs** - Watch server console for WebSocket connection logs
2. **Test logs** - Tests include console.log statements for debugging
3. **Database** - Query contacts table to verify relationships:
   ```sql
   SELECT * FROM "user" WHERE email LIKE 'test%';
   SELECT * FROM contacts WHERE user_id LIKE 'test%';
   ```

## Clean Up

To clean up test data from database:
```sql
DELETE FROM contacts WHERE user_id LIKE 'test%';
DELETE FROM "user" WHERE email LIKE 'test%';
```

## Next Steps

After running tests successfully:

1. Review server logs for any warnings
2. Check test coverage and add more scenarios
3. Test with mobile clients (real devices)
4. Test with different user roles (mutual, dependent)
5. Test emergency scenarios in production-like environment
