# Lifeline Backend Documentation

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