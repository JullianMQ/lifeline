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
