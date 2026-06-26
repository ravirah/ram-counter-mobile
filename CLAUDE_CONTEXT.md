# 🤖 Context Document for Claude AI

**Project:** Ram Counter Mobile App (Multi-App Architecture)  
**Last Updated:** 2026-01-25  
**Purpose:** Maintain complete context across sessions

---

## 📋 QUICK REFERENCE FOR CLAUDE

### **ALWAYS READ THESE FILES FIRST:**
1. **DEVELOPMENT_STANDARDS.md** ⭐ MANDATORY - All coding rules
2. **ARCHITECTURE.md** - System structure
3. **MULTI_APP_ARCHITECTURE.md** - Multi-app setup
4. **INDEX.md** - Documentation index

### **Current System State:**
- ✅ Configuration-based architecture (appConfig.js)
- ✅ Multi-app backend (single backend, multiple apps)
- ✅ Admin dashboard with app filtering
- ✅ MongoDB/PostgreSQL dual support
- ✅ React Native Expo app
- ✅ Node.js Express backend

---

## 🏗️ PROJECT ARCHITECTURE

### **Core Concept:**
This is a **configuration-based system**. Everything customizable lives in `src/config/appConfig.js`.

**Golden Rule:** 
```
NO HARDCODED VALUES → USE appConfig
```

### **File Structure:**
```
ram-counter-mobile/
├── src/
│   ├── config/
│   │   └── appConfig.js          ⭐ SINGLE SOURCE OF TRUTH
│   ├── screens/
│   │   ├── admin/                Admin dashboard screens
│   │   ├── app/                  Main app screens
│   │   └── auth/                 Authentication screens
│   ├── components/               Reusable components
│   └── utils/
│       └── apiService.js         API service layer
│
├── backend/
│   ├── routes/
│   │   ├── admin.js              Admin API endpoints
│   │   ├── auth.js               Auth endpoints
│   │   └── activities.js         Activity endpoints
│   ├── models/                   Database models
│   └── config/                   Backend config
│
└── Documentation (see below)
```

---

## 🔄 RECENT CHANGES (Context for Future Sessions)

### **Latest: 2026-01-25 - Dynamic App List in Admin Dashboard**

**Problem:** 
App filter buttons were hardcoded, showing apps that don't exist (कृष्ण Bank with 0 users).

**Solution Implemented:**

#### 1. Backend Changes (`backend/routes/admin.js`):

**New Endpoint (`GET /admin/apps`):**
```javascript
router.get('/apps', authMiddleware, adminMiddleware, async (req, res) => {
  // Returns list of unique appIds with user counts from database
  // MongoDB: Uses aggregation with $group
  // SQL: Uses GROUP BY query
  
  // Returns: [
  //   { appId: 'ram-bank', name: 'ram-bank', userCount: 1 },
  //   { appId: 'krishna-bank', name: 'krishna-bank', userCount: 0 }
  // ]
});
```

#### 2. Frontend API Service (`src/utils/apiService.js`):

```javascript
export const getApps = async () => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/apps`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
```

#### 3. Admin Dashboard UI (`src/screens/admin/AdminDashboardScreen.js`):

**Changed from hardcoded to dynamic:**
```javascript
// OLD - Hardcoded:
const appsList = [
  { id: 'all', name: 'All Apps' },
  { id: 'ram-bank', name: 'राम Bank' },
  { id: 'krishna-bank', name: 'कृष्ण Bank' }, // ❌ Shows even if 0 users
];

// NEW - Dynamic:
const [appsList, setAppsList] = useState([
  { id: 'all', name: 'All Apps', userCount: 0 }
]);

// Fetches from backend and builds list:
const dynamicApps = [
  { id: 'all', name: 'All Apps', userCount: totalUsers },
  ...appsData.apps.map(app => ({
    id: app.appId,
    name: appNameMap[app.appId] || app.appId,
    userCount: app.userCount
  }))
];
```

**Shows user count on buttons:**
```jsx
<Text>{app.name} ({app.userCount})</Text>
// Example: "राम Bank (1)", "All Apps (1)"
```

**Result:** 
✅ Only shows apps that exist in database  
✅ Shows user count on each button  
✅ Automatically updates when new apps are added  
✅ "All Apps" shows total count across all apps

---

### **2026-01-25: Admin Dashboard AppId Filtering**

**Problem:** 
Admin dashboard wasn't filtering data by `appId` in the multi-app architecture.

**Solution Implemented:**

#### 1. Backend Changes (`backend/routes/admin.js`):

**Stats Endpoint (`GET /admin/stats`):**
```javascript
// Added appId query parameter support
const { appId } = req.query;

// MongoDB queries now filter by appId:
const userQuery = { ...(appId && { appId }) };
const activityQuery = { 
  activityType: 'LOGIN',
  timestamp: { $gte: moment().startOf('day').toDate() },
  ...(appId && { appId })
};
const summaryQuery = { 
  date: today,
  ...(appId && { appId })
};

// SQL queries also updated with where clauses
```

**Activities Endpoint (`GET /admin/activities`):**
```javascript
// Added appId to query params
const { limit = 100, page = 1, type = '', userId = '', appId } = req.query;

// MongoDB and SQL queries filter by appId:
if (appId) query.appId = appId;  // MongoDB
if (appId) where.appId = appId;  // SQL
```

#### 2. Frontend API Service (`src/utils/apiService.js`):

```javascript
// Updated function signatures to accept appId:
export const getAdminStats = async (appId = null) => {
  const params = {};
  if (appId) params.appId = appId;
  // passes params to backend
};

export const getAllActivities = async (limit, page, type, userId, appId = null) => {
  const params = { limit, page, type, userId };
  if (appId) params.appId = appId;
  // passes params to backend
};
```

#### 3. Admin Dashboard UI (`src/screens/admin/AdminDashboardScreen.js`):

**Added State:**
```javascript
const [selectedApp, setSelectedApp] = useState('all');

const appsList = [
  { id: 'all', name: 'All Apps' },
  { id: 'ram-bank', name: 'राम Bank' },
  { id: 'krishna-bank', name: 'कृष्ण Bank' },
];
```

**Added UI Component:**
```jsx
<View style={styles.appSelector}>
  <Text style={styles.appSelectorLabel}>Filter by App:</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    {appsList.map((app) => (
      <TouchableOpacity
        key={app.id}
        style={[
          styles.appButton,
          selectedApp === app.id && styles.appButtonActive
        ]}
        onPress={() => setSelectedApp(app.id)}
      >
        <Text style={[
          styles.appButtonText,
          selectedApp === app.id && styles.appButtonTextActive
        ]}>
          {app.name}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>
```

**Updated Data Loading:**
```javascript
const loadDashboardData = async () => {
  const appFilter = selectedApp === 'all' ? null : selectedApp;
  
  const [statsData, usersData, activitiesData] = await Promise.all([
    apiService.getAdminStats(appFilter),      // ✅ Now includes appId
    apiService.getAllUsers(20, 1, '', appFilter),
    apiService.getAllActivities(50, 1, '', '', appFilter), // ✅ Now includes appId
  ]);
  // ...
};
```

**Auto-reload on App Change:**
```javascript
useEffect(() => {
  if (!loading) {
    loadDashboardData(); // Reloads when selectedApp changes
  }
}, [selectedApp]);
```

**Result:** 
✅ Admin can now filter all dashboard data by app using horizontal button selector

---

## 📐 KEY ARCHITECTURAL PATTERNS

### **1. Configuration-Based System**

**Pattern:**
```javascript
// ✅ CORRECT
import appConfig from '../../config/appConfig';
<Text>{appConfig.text.screenName.label}</Text>
<View style={{ backgroundColor: appConfig.colors.primary }} />

// ❌ WRONG
<Text>Ram Bank</Text>
<View style={{ backgroundColor: '#FF9933' }} />
```

### **2. Multi-App Architecture**

**Pattern:**
- Each app has unique `appId` (ram-bank, krishna-bank, etc.)
- Backend uses `appId` to isolate data per app
- Admin can view/filter all apps from one dashboard

**Database Schema:**
```javascript
// All models include appId field:
{
  id: String,
  name: String,
  appId: String,  // ← Identifies which app
  // ... other fields
}
```

**API Pattern:**
```javascript
// Frontend sends appId in login:
await apiService.loginUser(name, pin, mobile, email, 'ram-bank');

// Backend stores appId in user record:
const user = await User.create({ name, pin, mobile, email, appId });

// All queries filter by appId:
const users = await User.find({ appId: 'ram-bank' });
```

### **3. Service Layer Pattern**

**Pattern:**
```javascript
// ✅ CORRECT - Use service layer
import * as apiService from '../../utils/apiService';

const data = await apiService.getData();

// ❌ WRONG - Direct API calls in component
const response = await axios.get('http://localhost:5000/api/data');
```

### **4. Feature Flag Pattern**

**Pattern:**
```javascript
// In appConfig.js
features: {
  enableNewFeature: true,
}

// In component
{appConfig.features.enableNewFeature && (
  <NewFeatureComponent />
)}
```

---

## 🚫 CRITICAL DON'Ts

### **NEVER:**
1. ❌ Hardcode values (use appConfig)
2. ❌ Break existing functionality
3. ❌ Mix responsibilities (UI + API logic)
4. ❌ Duplicate code (one function, one location)
5. ❌ Add complex logic to appConfig (simple values only)
6. ❌ Make changes without reading DEVELOPMENT_STANDARDS.md

### **ALWAYS:**
1. ✅ Read DEVELOPMENT_STANDARDS.md first
2. ✅ Use appConfig for customizable values
3. ✅ Use service layer for API calls
4. ✅ Add feature flags for new features
5. ✅ Maintain backward compatibility
6. ✅ Update documentation after changes

---

## 📚 DOCUMENTATION STRUCTURE

### **For AI Assistants:**
```
1. DEVELOPMENT_STANDARDS.md  ← Read FIRST (mandatory)
2. ARCHITECTURE.md           ← Understand system
3. CLAUDE_CONTEXT.md         ← This file (session context)
4. MULTI_APP_ARCHITECTURE.md ← Multi-app details
5. ADMIN_APPID_FIX.md        ← Latest admin fix details
6. INDEX.md                  ← All docs index
```

### **For Users:**
```
1. START_HERE.md             ← Quick start
2. QUICK_START.md            ← Reference guide
3. CONFIGURATION.md          ← Complete config reference
4. THEME_PRESETS.js          ← Ready-to-use themes
```

---

## 🔍 COMMON TASKS FOR CLAUDE

### **Task: Add New Feature**

**Steps:**
1. Read DEVELOPMENT_STANDARDS.md (Section: "Adding New Features")
2. Add to appConfig.js under `features` flag
3. Implement with feature flag check
4. Update documentation
5. Add to Recent Changes Log

**Example:**
```javascript
// 1. Add to appConfig.js
features: {
  enableNewFeature: true,
}

// 2. Implement in component
{appConfig.features.enableNewFeature && (
  <NewFeatureComponent />
)}
```

### **Task: Fix Bug**

**Steps:**
1. Identify which file/component
2. Check if it uses appConfig correctly
3. Ensure no hardcoded values
4. Fix without breaking existing code
5. Test all related features still work

### **Task: Add New App Support**

**Steps:**
1. Read MULTI_APP_ARCHITECTURE.md
2. Add app to `appsList` in AdminDashboardScreen.js
3. No backend changes needed (already supports any appId)
4. Update documentation

---

## 🧪 TESTING CHECKLIST

**Before completing any task:**
- [ ] Existing features still work
- [ ] New feature works as expected
- [ ] No console errors
- [ ] appConfig pattern followed
- [ ] No hardcoded values
- [ ] Documentation updated
- [ ] Feature flags used for new features
- [ ] Recent Changes Log updated (if significant)

---

## 💡 TIPS FOR EFFECTIVE SESSION CONTINUITY

### **When Starting New Session:**
1. Read this file (CLAUDE_CONTEXT.md)
2. Read DEVELOPMENT_STANDARDS.md
3. Check Recent Changes Log in both files
4. Review relevant documentation for task

### **When Ending Session:**
1. Update Recent Changes Log if changes made
2. Update CLAUDE_CONTEXT.md with new context
3. Update relevant documentation
4. Commit with clear message

### **Context Questions to Ask:**
- "What architectural pattern does this follow?"
- "Is this using appConfig correctly?"
- "Are there any breaking changes?"
- "What documentation needs updating?"

---

## 🎯 QUICK ANSWERS

**Q: Where do I add customizable values?**  
A: `src/config/appConfig.js`

**Q: How do I make API calls?**  
A: `import * as apiService from '../../utils/apiService'`

**Q: How do I add a new feature?**  
A: Add feature flag to appConfig, implement with flag check

**Q: How does multi-app work?**  
A: Each app has unique `appId`, backend filters by it

**Q: How does admin dashboard filtering work?**  
A: Passes optional `appId` query param to backend endpoints

**Q: What's the latest change?**  
A: Admin dashboard now has app filtering UI (2026-01-25)

**Q: Where are coding standards?**  
A: `DEVELOPMENT_STANDARDS.md` (MUST READ)

**Q: How do I test my changes?**  
A: Ensure existing features work + new feature works + no errors

---

## 📞 ERROR HANDLING

**If Claude encounters:**

1. **"Cannot find appConfig"**
   - Check import path: `'../../config/appConfig'`
   - Verify file exists at `src/config/appConfig.js`

2. **"Undefined property on appConfig"**
   - Check appConfig.js has the property
   - Check spelling/case sensitivity
   - Verify structure matches CONFIGURATION.md

3. **"Breaking existing features"**
   - Revert changes
   - Read DEVELOPMENT_STANDARDS.md
   - Apply changes more carefully
   - Use feature flags

4. **"Admin dashboard not filtering"**
   - Check appId is passed to API service
   - Verify backend receives appId param
   - Check database queries include appId filter
   - See ADMIN_APPID_FIX.md

---

## 🔄 VERSION HISTORY

### **v1.0 - 2026-01-25**
- Initial context document created
- Admin AppId filtering implemented
- Multi-app architecture documented
- Configuration-based system established

### **Future Updates Should Add:**
- Date of change
- What changed
- Why it changed
- Impact on system
- Related documentation

---

## ✅ FINAL REMINDERS FOR CLAUDE

1. **ALWAYS read DEVELOPMENT_STANDARDS.md before making changes**
2. **NEVER hardcode values - use appConfig**
3. **MAINTAIN backward compatibility**
4. **UPDATE documentation after changes**
5. **ADD to Recent Changes Log if significant**
6. **TEST that existing features still work**
7. **USE feature flags for new features**
8. **FOLLOW established patterns**

---

**This document is Claude's memory. Keep it updated!**

**Last Updated:** 2026-01-25  
**Next Update:** When significant changes are made
