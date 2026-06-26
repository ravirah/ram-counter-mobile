# GitHub Copilot Instructions

## Multi-App Architecture Context

This project is a **multi-app spiritual counter system** with centralized backend and admin management.

### Core Architecture Principles

1. **Multiple Apps, One Backend**
   - Single backend serves multiple spiritual counter apps (Ram Counter, Hanuman Chalisa, Gayatri Mantra, etc.)
   - Each app is identified by `appId` field in database
   - Users are scoped to their app via `appId`

2. **App Isolation**
   - Same username can exist across different apps
   - Database has UNIQUE constraint on `(appId, name)` NOT just `name`
   - All queries MUST filter by `appId`

3. **Default App ID**
   - Current default: `'ram-bank'`
   - Set in database schema and app config
   - Can be changed per deployment

### Critical Implementation Rules

#### Database Queries
```javascript
// ALWAYS include appId in user queries
User.findOne({ where: { name: username, appId: 'ram-bank' } })

// NEVER query without appId (will mix users from different apps)
User.findOne({ where: { name: username } }) // ❌ WRONG
```

#### User Registration
```javascript
// Always set appId when creating users
await User.create({
  name,
  email,
  mobile,
  pin,
  appId: 'ram-bank' // or from config
});
```

#### Authentication
- Login must check both username AND appId
- OTP verification must scope by appId
- Session tokens should include appId context

### File Locations

- **App Config:** `src/config/appConfig.js` - Defines current app settings
- **Database Models:** `backend/models/sql.js` - User model with appId
- **Auth Routes:** `backend/routes/auth.js` - Login/register with appId
- **Admin Routes:** `backend/routes/admin.js` - Cross-app management

### Database Schema

**Users Table:**
```sql
CREATE TABLE Users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  mobile VARCHAR(255) UNIQUE,
  pin VARCHAR(255),
  appId VARCHAR(255) NOT NULL DEFAULT 'ram-bank',
  totalCount INTEGER DEFAULT 0,
  lastActiveDate DATETIME,
  createdAt DATETIME,
  updatedAt DATETIME,
  UNIQUE(appId, name)  -- Username unique per app
);
```

### When Suggesting Code

1. **Always check** if operation needs `appId` filtering
2. **Always validate** that user queries include `appId`
3. **Never break** app isolation (don't mix users from different apps)
4. **Preserve** existing multi-app patterns when modifying code
5. **Use** the app config file for app-specific settings

### Admin System

- Admin can view/manage ALL apps from one dashboard
- Admin queries may intentionally span multiple appIds
- Regular user operations MUST be app-scoped

### Example Patterns to Follow

**Good:**
```javascript
// Scoped to specific app
const user = await User.findOne({
  where: { mobile, appId: 'ram-bank' }
});

// Admin viewing all apps
const allUsers = await User.findAll({
  attributes: ['id', 'name', 'appId', 'totalCount'],
  order: [['totalCount', 'DESC']]
});
```

**Bad:**
```javascript
// Missing appId - will return user from wrong app!
const user = await User.findOne({ where: { mobile } });

// Updating without appId check - dangerous!
await User.update({ totalCount }, { where: { name } });
```

### Testing Checklist

When making changes:
- [ ] Does this query need `appId` filtering?
- [ ] Will this work correctly with multiple apps?
- [ ] Is app isolation maintained?
- [ ] Does admin functionality still work across apps?
- [ ] Are default values set correctly?

---

**Remember:** This architecture supports deploying the same codebase as different apps (Ram Counter, Hanuman Chalisa, etc.) with different configs, all sharing one backend and admin system.
