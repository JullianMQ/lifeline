# Lifeline Web Documentation

## Overview

This is for the Lifeline Web, built using React and Vite. It serves as the web dashboard to login and create accounts, view recordings, and monitor your contacts.

## PRE-REQUISITES

1. Node.js 

React and Vite are included as project dependencies and will be installed automatically when you run:

```bash
npm install
 ```

## Features

- Email/password for login using Better Auth
- Google OAuth integration
- User roles: "mutual" or "dependent"
- Emergency contacts management (up to 5 per user)
- Phone number validation for Philippine formats(09XXXXXXXXX)
- Automatic contacts creation on user signup

## Environment Variables

- `VITE_API_UR` - PostgreSQL connection string
- `BETTER_AUTH_URL` - Base URL for Better Auth (e.g., <http://localhost:3000>)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

## CHANGELOG

### 2025-12-17

- Initial setup
- Added fonts and global CSS variables
- Added logo and other assets(svg used for login/signup, and landing page)
- Added pages with designs(landing, login, signup, addContact)

### 2025-12-18

- Script for login/signup
- Finalized addContact page design and layout

### 2025-12-19

- Pushed Lifeline web into test branch
- Added login and signup

### 2025-12-21

- Added input validations for login and signup inputs
- Removed redundant css lines
- Polished designs for pages: landing, login, signup

### 2025-12-22

- Added script for addContact page
- Included roles for addContact

### 2025-12-24

- Added OAuth
- Applied Better-Auth for login and signup

### 2026-01-03

- Added Dashboard contents

### 2026-01-05

- Added Google map on dashboard
- Restructured files
- Dashboard switch from user to contact

### 2026-01-07

- Added QR generation on addContact

### 2026-01-09

- Implemented protected and public routes
- Added phone number validation for social login
- Adding contacts now has create new and add existing options

### 2026-01-09

- implemented google maps api on dashboard
- added marker for dashboard maps(user and contacts)
- added geocoder for maps
- added geolocation with time stamp history{under maintenance}
- added buttons for sensors

### 2026-01-14

- Added profile page
- added edit profile
- Added avatar selection modal for edit profile

### 2026-01-15

- Added optimized avatars
- Improved image responsiveness
- Display contacts in dashboard as dependent and mutual
- Added delete contacts

### 2026-01-17

- Added overflow scrolling for contacts
- Added style for scroll bar

### 2026-01-23

- Mobile and tablet responsiveness for all pages

### 2026-01-28

- Added user and contact icon as Google Map pin
- Implemented pin onclick function to view details
- Fixed user location pin 

### 2026-02-03

- Added Terms and Conditions
- Implement disable signup button
- Terms and conditions modal passes value to signup

### 2026-02-04

- Removed unused markers prop from DashboardMap
- Implemented alert mode
- Responsive adjustments for contact alert state
- Alert mode and regular state for contacts

### 2026-02-06

- Added map location preview
- Implemented onclick and onhover for location preview
- Implemented online, offline, and preview state for map markers
- Fixed location history updating even when not online

### 2026-02-08

- Implemented location history loading from API for all contacts
- Added history filter dropdown with time-based filtering (past 1 hr, past 6 hrs, today, yesterday)
- Updated history structure to include ISO timestamp for accurate filtering
- Map center now uses selected location preview for better navigation

### 2026-02-09

- Implemented dynamic geocode and coordinate updates when hovering/clicking history locations
- Modified location display logic
- Fixed map and history location display issues
- Fixed alert mode display issues
- Fixed geocode fetching on preview
- Implemented geocode API on contact location fetch instead of preview  

### 2026-02-12

- Implemented lazy loading for geocode API
- Fixed error handling of phone number
- Added sos and acknowledged to realtime location types (API + WebSocket)
- Active alerts now derived from DB locations
- Modified dismss to acknowledge SOS locations
- Added sos styling to history rows with sos flag