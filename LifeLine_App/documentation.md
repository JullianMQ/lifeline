# DOCUMENTATION

## HOW TO RUN THE APP

1. Pull the latest project
   ```bash
   git pull
   ```

2. Navigate to the app folder
   ```bash
   cd LifeLine_App
   ```

3. Install dependencies
   ```bash
   npm install
   ```

4. Run the mobile app
   ```bash
   npx expo start
   ```
5. To run on Android emulator:
    * start emulator

    in terminal (after npx expo start)
    press "a"
---

## HOW TO RUN THE BACKEND

1. Navigate to backend folder
   ```bash
   cd Lifeline_Backend
   ```

2. Install dependencies
   ```bash
   bun install
   ```

3. Start the backend
   ```bash
   bun dev
   ```

## CHANGELOG

### 2025-11-30
- Initial design of the app
- Implemented navigation between screens

### 2025-12-09
- Implemented authentication

### 2025-12-10
- Configured routing
- Added Home and FAQs frontend

### 2025-12-11
- Added documentation on how to run the app
- Added frontend for Contacts, Add Contacts, and Notifications

### 2025-12-13
- Fixed login
- Stored logged-in user in SecureStore and displayed name in Menu page
- Configured contacts (session-based)
- Configured styling for login

### 2025-12-22
- Updated signup flow to validate email on Step 1 before moving to Step 2

### 2025-12-23
- Implemented native Google Sign-In for Android using Google ID token flow
- Integrated Google authentication with backend (Better Auth)
- Fixed OAuth redirect and localhost issues on Android

- Integrated map view in Home screen
- Displayed user location
- Updated SOS button to send current address (location) when pressed

### 2026-01-09
- Accelerometer Test Implementation: Integrated expo-sensors to monitor real-time G-force.
- Global Sensor Context: Created a SensorContext to manage monitoring state across the entire app.

### 2026-01-10
- Fixed reverse geocoding in Home screen: now displays full readable address instead of just coordinates.
- Gyroscope Test Implementation
- Microphone Test Implementation

### 2026-01-12
- Added CSV logging for sensor monitoring: appended MAX and MIN values with units (g, rad/s, dBFS) at the end of each session
- Refactored API_BASE_URL to use environment variable with safe localhost fallback
- Fixed sendPing WebSocket function to check socket.readyState before sending, matching sendChatMessage pattern

### 2026-01-13
- Sensor CSV Fix: Corrected MAX/MIN summary rows to align values under Accelerometer, Gyroscope, and Microphone columns
- WebSocket Fix: Allowed switching rooms by tracking currentRoom to prevent blocking new room connections
