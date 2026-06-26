# AI Assistant Context - MUST READ

> **For: GitHub Copilot, Claude, GPT, Codex, and all AI code assistants**

## CRITICAL ARCHITECTURE: Multi-App System

This is **NOT a single-app project**. This is a **multi-app spiritual counter platform** with:
- **One centralized backend**
- **One admin dashboard**
- **Multiple client apps** (Ram Counter, Hanuman Chalisa, Gayatri Mantra, etc.)

### The `appId` Field is MANDATORY

Every user belongs to an app via the `appId` field:

```javascript
// Users Table Schema
{
  id: INTEGER PRIMARY KEY,
  name: VARCHAR(255),
  email: VARCHAR(255),
  mobile: VARCHAR(255),
  pin: VARCHAR(255),
  appId: VARCHAR(255) NOT NULL DEFAULT 'ram-bank',  // ← THIS IS CRITICAL
  totalCount: INTEGER,
  // ... other fields
  UNIQUE CONSTRAINT on (appId, name)  // ← NOT just name!
}
```

### Rules for ALL Code Changes

#### 1. Database Queries - ALWAYS Include appId

```javascript
// ✅ CORRECT - User queries with appId
await User.findOne({ where: { name: 'John', appId: 'ram-bank' } });
await User.findAll({ where: { appId: 'ram-bank' } });
await User.create({ name: 'John', appId: 'ram-bank', ... });

// ❌ WRONG - Missing appId (will mix users from different apps!)
await User.findOne({ where: { name: 'John' } });  // Don't do this!
await User.findAll();  // Admin only!
```

#### 2. Authentication - Check Both Username AND appId

```javascript
// ✅ CORRECT
const user = await User.findOne({
  where: {
    name: username,
    appId: 'ram-bank'  // Must include!
  }
});

// ❌ WRONG - Will authenticate user from wrong app!
const user = await User.findOne({ where: { name: username } });
```

#### 3. Registration - Always Set appId

```javascript
// ✅ CORRECT
await User.create({
  name,
  email,
  mobile,
  pin,
  appId: 'ram-bank'  // Or from config
});

// ❌ WRONG - Missing appId
await User.create({ name, email, mobile, pin });
```

#### 4. Updates - Include appId in WHERE Clause

```javascript
// ✅ CORRECT
await User.update(
  { totalCount: newCount },
  { where: { id: userId, appId: 'ram-bank' } }
);

// ❌ WRONG - Could update user from wrong app
await User.update({ totalCount: newCount }, { where: { id: userId } });
```

### Project Structure

```
ram-counter-mobile/
├── backend/                    # Shared backend for all apps
│   ├── models/
│   │   └── sql.js             # User model with appId field
│   ├── routes/
│   │   ├── auth.js            # Login/Register (appId required)
│   │   ├── users.js           # User operations (appId scoped)
│   │   ├── activities.js      # Activity tracking
│   │   └── admin.js           # Cross-app admin (can query all apps)
│   └── server.js
│
├── src/
│   ├── config/
│   │   └── appConfig.js       # App-specific config (appId defined here)
│   ├── screens/               # React Native screens
│   └── utils/                 # API calls (send appId)
│
└── .github/
    └── copilot-instructions.md # Detailed instructions for Copilot
```

### Default Configuration

- **Default appId:** `'ram-bank'`
- **Location:** `src/config/appConfig.js` and database default value
- **Can be changed** per deployment to create different apps

### Admin vs Regular Operations

**Admin Operations:**
- Can query across ALL apps
- Uses `User.findAll()` without appId filter
- Located in `backend/routes/admin.js`

**Regular User Operations:**
- MUST be scoped to specific appId
- Located in `backend/routes/auth.js` and `backend/routes/users.js`

### Why This Architecture?

1. **Multi-tenancy**: Deploy same codebase as different spiritual counter apps
2. **Centralized Management**: One admin dashboard to manage all apps
3. **Data Isolation**: Users in "Ram Counter" don't see users in "Hanuman Chalisa"
4. **Shared Backend**: One server, one database, multiple apps

### Common Mistakes to Avoid

1. ❌ Querying users without appId filter
2. ❌ Creating UNIQUE constraints on `name` alone (must be `appId + name`)
3. ❌ Forgetting to send appId from frontend
4. ❌ Hard-coding appId instead of using config
5. ❌ Breaking app isolation by mixing user data

### Testing Multi-App Scenario

To test if code respects app isolation:

1. Create user "John" in app "ram-bank"
2. Create user "John" in app "hanuman-chalisa"
3. Both should exist (different appIds)
4. Login as "John" with appId "ram-bank" should only authenticate the ram-bank user
5. Counts should be separate

### Configuration Files

**Backend:**
- `backend/models/sql.js` - User model with appId
- `backend/routes/auth.js` - Authentication with appId

**Frontend:**
- `src/config/appConfig.js` - Current app settings
- Contains: appId, appName, theme, deity info, etc.

### When You See Code Issues

If you see code that:
- Queries users without appId
- Creates users without appId
- Authenticates without checking appId
- Updates without appId in WHERE clause

**→ FLAG IT as breaking multi-app isolation!**

### Key Files to Review

Before making changes, check:
1. `.github/copilot-instructions.md` - Full Copilot instructions
2. `MULTI_APP_ARCHITECTURE.md` - Architecture overview
3. `backend/models/sql.js` - Database schema
4. `src/config/appConfig.js` - Current app config

---

## Summary for AI Assistants

**When suggesting code:**
1. ✅ Check if operation needs appId
2. ✅ Verify app isolation is maintained
3. ✅ Use config file for appId, don't hard-code
4. ✅ Follow existing patterns for multi-app support
5. ✅ Test with multiple apps in mind

**This ensures:**
- Multiple apps can coexist
- Data doesn't leak between apps
- Admin can manage all apps centrally
- Same codebase supports different spiritual counters

---

**Remember:** Treat `appId` with the same importance as `userId`. Every user operation needs both!
