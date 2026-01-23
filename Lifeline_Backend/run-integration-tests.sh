#!/bin/bash

# Script to run real integration tests with server startup

echo "🚀 Starting WebSocket Integration Tests..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with required environment variables"
    exit 1
fi

# Check if server is already running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Server is already running on http://localhost:3000"
    echo ""
    echo "Running integration tests..."
    bun test tests/websocket-real-integration.test.ts
    TEST_EXIT=$?
    echo ""
    if [ $TEST_EXIT -eq 0 ]; then
        echo "✅ All integration tests passed!"
    else
        echo "❌ Some tests failed"
    fi
    exit $TEST_EXIT
else
    echo "⚠️  Server is not running"
    echo "Starting server in background..."
    echo ""

    # Start server in background
    bun run dev > /tmp/lifeline-server.log 2>&1 &
    SERVER_PID=$!

    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "✅ Server started successfully (PID: $SERVER_PID)"
            echo ""
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ Server failed to start within 30 seconds"
            echo "Check /tmp/lifeline-server.log for details"
            kill $SERVER_PID 2>/dev/null
            exit 1
        fi
        sleep 1
        echo -n "."
    done

    # Run tests
    echo "Running integration tests..."
    bun test tests/websocket-real-integration.test.ts
    TEST_EXIT=$?
    echo ""

    # Stop server
    echo ""
    echo "Stopping server (PID: $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    echo "✅ Server stopped"

    if [ $TEST_EXIT -eq 0 ]; then
        echo "✅ All integration tests passed!"
    else
        echo "❌ Some tests failed"
        echo "Check server logs: tail -f /tmp/lifeline-server.log"
    fi

    exit $TEST_EXIT
fi
