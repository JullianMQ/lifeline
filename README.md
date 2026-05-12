# Lifeline

A comprehensive emergency monitoring and response system designed to help users stay connected with their emergency contacts and provide real-time location tracking during emergencies.

## Project Structure

Lifeline is a monorepo containing multiple interconnected applications:

```
Lifeline/
├── Lifeline_Backend/     # Node.js backend API (Bun, Hono, Better Auth, PostgreSQL)
├── Lifeline_web/         # React web dashboard
├── LifeLine_App/         # Expo/React Native mobile application
├── Automation-n8n/       # N8N automation workflows
├── better-auth_migrations/ # Database migrations
└── lifeline_mobile/      # Alternative mobile implementation
```

## Overview

Lifeline enables users to:
- **Monitor** - Track real-time location of emergency contacts through sensors and GPS
- **Respond** - Trigger SOS alerts with automatic notifications to emergency contacts
- **Document** - Capture and store media evidence during emergencies
- **Coordinate** - View location history and receive real-time updates via WebSocket

## Tech Stack

### Backend
- **Runtime**: Bun
- **Framework**: Hono
- **Authentication**: Better Auth
- **Database**: PostgreSQL
- **Real-time**: WebSocket (ws)

### Web Dashboard
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Maps**: Google Maps API

### Mobile App
- **Framework**: React Native (Expo)
- **Navigation**: Expo Router
- **Styling**: NativeWind
- **Sensors**: expo-sensors (accelerometer, gyroscope, microphone)
- **Location**: expo-location
- **Notifications**: Notifee

## Key Features

### Authentication
- Email/password registration and login
- Google OAuth integration
- Magic link authentication via QR codes
- Session management with secure cookies

### Emergency Contacts
- Support for "mutual" (both parties monitor each other) and "dependent" roles
- Up to 5 emergency contacts per user
- Philippine phone number validation (09XXXXXXXXX format)
- QR code-based contact addition

### Real-time Monitoring
- WebSocket-based location broadcasting
- Multi-room architecture for contact groups
- Live GPS tracking with reverse geocoding
- 60-second update intervals with HTTP fallback

### SOS System
- One-tap emergency alert triggering
- Automatic SMS fallback when data is unavailable
- Email notifications to emergency contacts
- Media capture (photos/video) during emergencies
- Automatic location attachment

### Sensor Monitoring
- Accelerometer (impact/fall detection with g-force threshold)
- Gyroscope (device orientation)
- Microphone (ambient sound level)
- CSV-based data logging for analysis

### Location History
- Persistent location storage with configurable retention (default 3 days)
- Time-filtered history view
- PDF evidence generation with geocoded addresses
- Google Drive integration for file storage

## API Architecture

### REST Endpoints
- `/api/auth/*` - Authentication (sign-up, sign-in, sign-out, session)
- `/api/contacts/*` - Emergency contacts CRUD operations
- `/api/location` - Location tracking endpoints
- `/api/files/*` - Media upload and management

### WebSocket
- `GET /api/ws` - Real-time emergency monitoring
- Multi-room support with auto-join for emergency contacts
- Location broadcasting and SOS event triggers

## Team

- **Jullian Quiambao** - Backend architecture, API development, WebSocket implementation
- **Chester Cruz** - Mobile app development, sensor integration, foreground services
- **Frances Ces (cess2c)** - Web dashboard UI/UX, contact management, location history

## Getting Started

### Prerequisites
- Bun (for backend)
- Node.js 18+ (for web)
- Expo CLI (for mobile development)
- PostgreSQL database

### Backend Setup
```bash
cd Lifeline_Backend
bun install
# Configure .env with DATABASE_URL and auth credentials
bun run dev
```

### Web Dashboard
```bash
cd Lifeline_web
npm install
npm run dev
```

### Mobile App
```bash
cd LifeLine_App
npm install
npx expo start
```

## License

Private project - All rights reserved
