# Ram Counter Mobile - Multi-App Spiritual Counter Platform

> **IMPORTANT FOR AI ASSISTANTS (Copilot, Claude, GPT, etc.):**
> This is a **MULTI-APP SYSTEM**. All user operations MUST include `appId` field.
> Read [AI_CONTEXT.md](./AI_CONTEXT.md) before making code changes.

## Overview

A spiritual counter mobile application with **multi-app architecture** supporting multiple devotional apps (Ram Counter, Hanuman Chalisa, Gayatri Mantra, etc.) from a single codebase.

### Architecture

- **One Backend** - Centralized API server for all apps
- **One Admin Dashboard** - Manage all apps from single interface
- **Multiple Apps** - Deploy same codebase with different configs as separate apps
- **App Isolation** - Users scoped by `appId` field in database

## Critical Architecture Rules

All user operations MUST include `appId`:

```javascript
// ✅ CORRECT
User.findOne({ where: { name: 'John', appId: 'ram-bank' } })

// ❌ WRONG - Will mix users from different apps!
User.findOne({ where: { name: 'John' } })
```

**Database Schema:**
- Users have `appId` field (default: 'ram-bank')
- UNIQUE constraint on `(appId, name)` - same username can exist in different apps
- All queries must filter by `appId` to maintain app isolation

## Quick Start

### Backend
```bash
cd backend
npm install
npm start
# Server runs on http://localhost:5000
```

### Frontend (React Native)
```bash
npm install
npx expo start
```

### Admin Dashboard
Access at `/admin` route with admin credentials

## Project Structure

```
ram-counter-mobile/
├── backend/                    # Shared backend for all apps
│   ├── models/sql.js          # User model with appId
│   ├── routes/
│   │   ├── auth.js            # Login/Register (appId scoped)
│   │   ├── users.js           # User operations
│   │   ├── activities.js      # Activity tracking
│   │   └── admin.js           # Cross-app admin management
│   └── server.js
│
├── src/
│   ├── config/appConfig.js    # App-specific configuration
│   ├── screens/               # React Native screens
│   │   ├── auth/             # Login, Register, OTP
│   │   ├── app/              # Counter, Profile
│   │   └── admin/            # Admin Dashboard, Login
│   └── utils/                 # API services
│
└── Documentation/
    ├── AI_CONTEXT.md          # MUST READ for AI assistants
    ├── MULTI_APP_ARCHITECTURE.md
    ├── CONFIGURATION.md
    └── .github/copilot-instructions.md
```

## Features

- User authentication with PIN/OTP
- Daily counter tracking with animations
- Profile management
- Activity history
- Daily summaries and streaks
- Admin dashboard with analytics
- Multi-app support with centralized management

## Configuration

Edit `src/config/appConfig.js` to customize your app:

```javascript
{
  appId: 'ram-bank',           // Unique app identifier
  appName: 'Ram Counter',      // Display name
  deity: 'Shri Ram',           // Deity name
  mantra: 'राम राम',           // Mantra text
  theme: { ... },              // Custom theme colors
  // ... more settings
}
```

## Database

**SQLite** (Development/Single server)
- Database file: `backend/database.sqlite`
- Auto-created on first run

**MongoDB** (Production/Scalable)
- Set `USE_MONGODB=true` in environment
- Configure connection in `backend/config/database.js`

## Technology Stack

- **Frontend:** React Native, Expo
- **Backend:** Node.js, Express
- **Database:** SQLite / MongoDB
- **Authentication:** JWT, OTP
- **UI:** React Native Paper, Custom theme system

## Multi-App Deployment

Deploy the same codebase as different apps:

1. Clone repository for each app
2. Update `src/config/appConfig.js` with different `appId`
3. Customize theme, deity, mantra, etc.
4. Build separate APKs/IPAs
5. All apps share same backend and admin

**Example Apps:**
- Ram Counter (`appId: 'ram-bank'`)
- Hanuman Chalisa (`appId: 'hanuman-chalisa'`)
- Gayatri Mantra (`appId: 'gayatri-mantra'`)

## Admin Access

Default admin credentials (change in production):
- Username: `admin`
- PIN: `1234`

Admin can:
- View all users across all apps
- Monitor usage statistics
- Manage user accounts
- View cross-app analytics

## Documentation

- **[AI_CONTEXT.md](./AI_CONTEXT.md)** - Critical for AI code assistants
- **[MULTI_APP_ARCHITECTURE.md](./MULTI_APP_ARCHITECTURE.md)** - Architecture details
- **[CONFIGURATION.md](./CONFIGURATION.md)** - Configuration guide
- **[DEVELOPMENT_STANDARDS.md](./DEVELOPMENT_STANDARDS.md)** - Coding standards

## Development

### Backend Development
```bash
cd backend
npm run dev  # Start with nodemon for auto-reload
```

### Frontend Development
```bash
npx expo start
# Press 'a' for Android, 'i' for iOS, 'w' for web
```

### Testing Multi-App Isolation
1. Create user "John" in app "ram-bank"
2. Create user "John" in app "hanuman-chalisa"
3. Both should exist (different appIds)
4. Login should respect appId
5. Counts should be separate

## Important Notes for Developers & AI Assistants

1. **Always include `appId`** in user queries
2. **Never break app isolation** - users from different apps must not mix
3. **Use app config** for app-specific settings
4. **Admin routes** can query across apps, regular routes cannot
5. **Test with multiple apps** in mind

## License

Proprietary - All rights reserved

## Support

For issues or questions, contact the development team.

---

**For AI Assistants:** Read [AI_CONTEXT.md](./AI_CONTEXT.md) for critical architecture context before suggesting code changes.
