# Quick Start Guide - Running Real Integration Tests

## Quick Start (Recommended)

**Option A: Server Already Running**

1. Ensure server is running:
   ```bash
   bun run dev
   ```

2. In another terminal, run tests:
   ```bash
   bun run test:real
   ```

**Option B: Automatic Server Start**

Run the automated script that starts server and runs tests:
```bash
bun run test:real:auto
```

## What Gets Tested

✅ Real WebSocket connections
✅ Real authentication with Better Auth
✅ Real database queries
✅ Real message broadcasting
✅ Real REST API calls
✅ Multi-room architecture
✅ Emergency contact relationships
✅ Location updates
✅ SOS emergency triggers

## Expected Output

```
🚀 Starting WebSocket Integration Tests...

=== Starting Real Integration Tests ===
Authenticating test users...
✅ All test users authenticated

  test suite > test suite
    ✅ test 1
    ✅ test 2
    ...

34 pass
0 fail

=== Integration Tests Complete ===
```

## If Tests Fail

### 1. Authentication Failed
```
Error: Authentication failed for test1@example.com
```
**Fix:** Verify test users exist in database and password is "password"

### 2. Connection Refused
```
Error: connect ECONNREFUSED
```
**Fix:** Start the server:
```bash
bun run dev
```

### 3. Tests Timeout
```
Error: Timeout waiting for message
```
**Fix:** Check server logs and verify WebSocket endpoint is accessible

## Test Scenarios

| # | Scenario | What It Tests |
|---|----------|---------------|
| 1 | Multi-Room Creation | Creating rooms with emergency contacts |
| 2 | Emergency Access | Emergency contacts join without approval |
| 3 | Non-Contact Denied | Unauthorized users blocked |
| 4 | Auto-Join | Contacts auto-join on connection |
| 5 | Room Messaging | Message broadcasting |
| 6 | Location Updates | REST API → WebSocket broadcast |
| 7 | Emergency SOS | Cross-room alerts |
| 8 | Room Users List | Get users in room |

## Files

- `tests/websocket-real-integration.test.ts` - Test code
- `tests/README-REAL-TESTS.md` - Detailed documentation
- `run-integration-tests.sh` - Automated test runner
- `src/routes/websocket.ts` - WebSocket server
- `src/routes/location.ts` - Location endpoint

## Need Help?

See detailed documentation: `tests/README-REAL-TESTS.md`
