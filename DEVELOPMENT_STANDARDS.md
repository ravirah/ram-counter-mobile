# 🎯 DEVELOPMENT STANDARDS & GUIDELINES

**IMPORTANT: ALL AI ASSISTANTS (Claude, Copilot, ChatGPT, etc.) MUST FOLLOW THESE STANDARDS**

**Project:** Ram Counter Mobile App
**Date Created:** 2026-01-25
**Architecture:** Configuration-Based System

---

## ⚠️ CRITICAL RULES - MUST FOLLOW

### 1. **ALWAYS CHECK ARCHITECTURE.MD FIRST** ✅
Before making ANY changes:
- Read `ARCHITECTURE.md` to understand the system
- Read `IMPLEMENTATION_SUMMARY.md` for implementation details
- Read `CONFIGURATION.md` for configuration options
- Check existing patterns in the codebase

### 2. **CONFIGURATION-BASED SYSTEM** ✅
**DO:**
```javascript
// ✅ CORRECT - Use appConfig
import appConfig from '../../config/appConfig';

<Text>{appConfig.text.screenName.label}</Text>
<View style={{ backgroundColor: appConfig.colors.primary }} />
```

**DON'T:**
```javascript
// ❌ WRONG - Hardcoded values
<Text>Ram Bank</Text>
<View style={{ backgroundColor: '#FF9933' }} />
```

### 3. **ZERO BREAKING CHANGES** ✅
- Never modify existing functionality without explicit permission
- All changes must be additive (new features, not replacements)
- Test that existing features still work after changes
- Maintain backward compatibility

### 4. **FEATURE FLAG PATTERN** ✅
**DO:**
```javascript
// ✅ CORRECT - Feature flag controlled
{appConfig.features.enableNewFeature && (
  <NewFeatureComponent />
)}
```

**DON'T:**
```javascript
// ❌ WRONG - Always rendered
<NewFeatureComponent />
```

### 5. **CLEAN CODE STANDARDS** ✅
- No complex logic in configuration
- Single responsibility principle
- DRY (Don't Repeat Yourself)
- **No duplicate code for same functionality**
- **One function, one purpose, one location**
- Logical and readable code
- Proper separation of concerns

---

## 📁 FILE STRUCTURE - MUST MAINTAIN

```
ram-counter-mobile/
│
├── src/
│   ├── config/
│   │   ├── appConfig.js          ⭐ SINGLE SOURCE OF TRUTH
│   │   ├── theme.js              (spacing, shadows, etc.)
│   │   └── api.js                (API configuration)
│   │
│   ├── screens/
│   │   ├── admin/                (Admin-related screens)
│   │   ├── app/                  (Main app screens)
│   │   └── auth/                 (Authentication screens)
│   │
│   ├── components/               (Reusable components)
│   ├── utils/                    (Utility functions)
│   └── services/                 (API services)
│
├── backend/                      (Backend API)
│   ├── routes/                   (API routes)
│   ├── models/                   (Database models)
│   ├── middleware/               (Auth, validation)
│   └── config/                   (Backend config)
│
├── ARCHITECTURE.md               ⭐ READ THIS FIRST
├── IMPLEMENTATION_SUMMARY.md     ⭐ IMPLEMENTATION DETAILS
├── CONFIGURATION.md              ⭐ CONFIG REFERENCE
├── DEVELOPMENT_STANDARDS.md      ⭐ THIS FILE
└── ... other documentation
```

---

## 🎨 CODING STANDARDS

### **1. Component Structure**

```javascript
// ✅ CORRECT PATTERN
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import appConfig from '../../config/appConfig';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function MyScreen() {
  // State
  const [data, setData] = useState(null);
  
  // Effects
  useEffect(() => {
    // Logic here
  }, []);
  
  // Handlers
  const handleAction = () => {
    // Logic here
  };
  
  // Render
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{appConfig.text.myScreen.title}</Text>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appConfig.colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: 24,
    color: appConfig.colors.text,
  },
});
```

### **2. Adding New Configuration**

```javascript
// In src/config/appConfig.js

export default {
  // ... existing config
  
  // ✅ Add new feature configuration
  text: {
    // ... existing text
    
    newFeatureScreen: {
      title: 'New Feature',
      subtitle: 'Description',
      buttonLabel: 'Action',
      // All text for new feature
    },
  },
  
  features: {
    // ... existing features
    enableNewFeature: true,  // Feature flag
  },
};
```

### **3. Using Existing Components**

```javascript
// ✅ CORRECT - Reuse existing components
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';

export default function NewScreen() {
  return (
    <LinearGradient
      colors={[appConfig.colors.primary, appConfig.colors.secondary]}
    >
      <SafeKeyboardView>
        {/* Your content */}
      </SafeKeyboardView>
    </LinearGradient>
  );
}
```

### **4. Theme Usage**

```javascript
// ✅ CORRECT - Use theme constants
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,           // Not 16
    borderRadius: borderRadius.md, // Not 8
    ...shadowStyles.medium,        // Not custom shadow
    backgroundColor: appConfig.colors.surface,
  },
});
```

---

## 🚫 WHAT NOT TO DO

### ❌ **Never Hardcode Values**
```javascript
// ❌ WRONG
<Text>राम Bank</Text>
backgroundColor: '#FF9933'
padding: 16
fontSize: 24
```

### ❌ **Never Break Existing Features**
```javascript
// ❌ WRONG - Replacing existing functionality
export default function CounterScreen() {
  // Complete rewrite that breaks existing code
}
```

### ❌ **Never Mix Responsibilities**
```javascript
// ❌ WRONG - API logic in component
export default function MyScreen() {
  const fetchData = async () => {
    const response = await fetch('http://localhost:5000/api/data');
    // Direct API calls in component
  };
}

// ✅ CORRECT - Use service layer
import * as apiService from '../../utils/apiService';

export default function MyScreen() {
  const fetchData = async () => {
    const data = await apiService.getData();
  };
}
```

### ❌ **Never Create Duplicate Code**
```javascript
// ❌ WRONG - Same logout logic in multiple places
// ProfileScreen.js
const handleLogout = () => {
  Alert.alert('Logout', 'Are you sure?', [...]);
  // logout logic here
};

// SettingsScreen.js
const handleLogout = () => {
  Alert.alert('Logout', 'Are you sure?', [...]);
  // same logout logic duplicated
};

// ✅ CORRECT - Single logout handler passed down
// App.js (Parent)
const handleLogout = () => {
  Alert.alert('Logout', 'Are you sure?', [...]);
  // logout logic once
};

// ProfileScreen.js
const handleLogout = () => {
  if (onLogout) onLogout(); // Call parent handler
};

// SettingsScreen.js
const handleLogout = () => {
  if (onLogout) onLogout(); // Call same parent handler
};
```

---
// ❌ WRONG - Logic in config
export default {
  getPrimaryColor: () => {
    const hour = new Date().getHours();
    return hour > 18 ? '#000' : '#FFF';
  },
};

// ✅ CORRECT - Simple values only
export default {
  colors: {
    primary: '#FF9933',
  },
};
```

---

## ✅ CHECKLIST BEFORE MAKING CHANGES

**MUST complete this checklist:**

### **Before Starting:**
- [ ] Read ARCHITECTURE.md
- [ ] Read IMPLEMENTATION_SUMMARY.md
- [ ] Read CONFIGURATION.md
- [ ] Understand existing patterns
- [ ] Check if similar feature exists

### **During Development:**
- [ ] Add configuration to appConfig.js
- [ ] Use existing components
- [ ] Follow existing patterns
- [ ] Use theme constants
- [ ] Add feature flag if needed
- [ ] No hardcoded values
- [ ] Clean and logical code
- [ ] Proper separation of concerns

### **After Development:**
- [ ] Test existing features still work
- [ ] Test new feature works
- [ ] Syntax validation passed
- [ ] No console errors
- [ ] Document changes
- [ ] Update relevant .md files

### **Documentation:**
- [ ] Create/update feature .md file
- [ ] Add examples and usage
- [ ] Document configuration options
- [ ] Explain architecture alignment

---

## 📋 ADDING NEW FEATURES - STEP BY STEP

### **Step 1: Plan**
1. Understand requirement
2. Check existing patterns
3. Plan configuration structure
4. Plan component structure

### **Step 2: Configuration**
```javascript
// Add to src/config/appConfig.js
text: {
  newFeature: {
    title: 'Title',
    description: 'Description',
  },
},
features: {
  enableNewFeature: true,
},
navigation: {
  newFeature: {
    icon: 'icon-name',
    label: 'Label',
  },
},
```

### **Step 3: Component**
```javascript
// Create src/screens/category/NewFeatureScreen.js
import appConfig from '../../config/appConfig';
// Follow existing pattern
```

### **Step 4: Navigation**
```javascript
// Add to App.js
import NewFeatureScreen from './src/screens/category/NewFeatureScreen';

// In navigator:
{appConfig.features.enableNewFeature && (
  <Stack.Screen name="NewFeature" component={NewFeatureScreen} />
)}
```

### **Step 5: Documentation**
```javascript
// Create NEW_FEATURE.md
// Document:
// - What it does
// - Configuration options
// - Usage examples
// - Architecture alignment
```

---

## 🔍 CODE REVIEW CHECKLIST

**Before submitting/applying changes:**

### **Architecture:**
- [ ] Follows configuration-based pattern
- [ ] No hardcoded values
- [ ] Uses appConfig for all customization
- [ ] Feature flag added if needed
- [ ] Follows existing file structure

### **Code Quality:**
- [ ] Clean and readable
- [ ] Logical structure
- [ ] No code duplication
- [ ] Proper naming conventions
- [ ] Comments where needed (minimal)

### **Compatibility:**
- [ ] Existing features work
- [ ] No breaking changes
- [ ] Backward compatible
- [ ] Theme system compatible
- [ ] Works on iOS/Android/Web

### **Documentation:**
- [ ] Changes documented
- [ ] Examples provided
- [ ] Configuration explained
- [ ] .md file created/updated

---

## 🎓 EXAMPLES FOR COMMON TASKS

### **Example 1: Add New Screen**

```javascript
// 1. Add config (appConfig.js)
text: {
  newScreen: {
    title: 'New Screen',
    description: 'Description',
  },
},

// 2. Create component (src/screens/app/NewScreen.js)
import React from 'react';
import { View, Text } from 'react-native';
import appConfig from '../../config/appConfig';

export default function NewScreen() {
  return (
    <View>
      <Text>{appConfig.text.newScreen.title}</Text>
    </View>
  );
}

// 3. Add to navigation (App.js)
<Tab.Screen name="New" component={NewScreen} />
```

### **Example 2: Add New API Endpoint**

```javascript
// 1. Backend route (backend/routes/feature.js)
router.get('/endpoint', authMiddleware, async (req, res) => {
  // Logic here
});

// 2. Service layer (src/utils/apiService.js)
export const getFeatureData = async () => {
  const response = await api.get('/feature/endpoint');
  return response.data;
};

// 3. Use in component
import * as apiService from '../../utils/apiService';

const data = await apiService.getFeatureData();
```

### **Example 3: Add New Theme Option**

```javascript
// In appConfig.js
colors: {
  newThemeColor: '#123456',
},

// Use in component
<View style={{ backgroundColor: appConfig.colors.newThemeColor }} />
```

---

## 🚀 DEPLOYMENT CHECKLIST

**Before deploying changes:**

- [ ] All tests passed
- [ ] No console errors
- [ ] Existing features work
- [ ] New features work
- [ ] Documentation updated
- [ ] Configuration validated
- [ ] Backend compatible
- [ ] Performance tested
- [ ] Security reviewed

---

## 📞 TROUBLESHOOTING GUIDE

### **If Something Breaks:**

1. **Check appConfig.js**
   - Verify all required fields exist
   - Check for typos in property names
   - Validate JSON structure

2. **Check Console Errors**
   - Read error messages carefully
   - Check file paths
   - Verify imports

3. **Revert Changes**
   - Use git to see what changed
   - Revert to last working state
   - Apply changes incrementally

4. **Validate Syntax**
   ```bash
   node -c src/screens/YourScreen.js
   ```

5. **Ask for Help**
   - Check documentation in INDEX.md
   - Review ARCHITECTURE.md
   - Read this file again

---

## 🔄 RECENT CHANGES LOG (For AI Context)

### **2026-01-25: Admin Dashboard AppId Filtering**

**Issue:** Admin dashboard wasn't filtering by appId in multi-app architecture

**Files Changed:**
1. `backend/routes/admin.js`
   - `/admin/stats` endpoint - Added appId query param support
   - `/admin/activities` endpoint - Added appId query param support
   - Both MongoDB and SQL queries updated

2. `src/utils/apiService.js`
   - `getAdminStats(appId)` - Added optional appId param
   - `getAllActivities(..., appId)` - Added optional appId param

3. `src/screens/admin/AdminDashboardScreen.js`
   - Added horizontal app filter UI with buttons
   - Passes appId to all API calls
   - Auto-reloads on app selection change

**Key Points:**
- ✅ Admin can now filter stats/users/activities by app
- ✅ Backward compatible (appId is optional)
- ✅ Clean UI with horizontal scrollable buttons
- ✅ Supports "All Apps", "राम Bank", "कृष्ण Bank"

**Documentation:** See `ADMIN_APPID_FIX.md` for complete details

---

## 📚 DOCUMENTATION STRUCTURE

All documentation follows this hierarchy:

1. **INDEX.md** - Central documentation index
2. **ARCHITECTURE.md** - System architecture
3. **DEVELOPMENT_STANDARDS.md** - This file (coding standards)
4. **IMPLEMENTATION_SUMMARY.md** - Implementation details
5. **CONFIGURATION.md** - Configuration reference
6. **MULTI_APP_ARCHITECTURE.md** - Multi-app system details
7. **ADMIN_APPID_FIX.md** - Latest admin dashboard fix

**When making changes:**
- Update relevant documentation
- Add entry to "Recent Changes Log" above
- Update INDEX.md if new docs created

---

## ✅ FINAL CHECKLIST FOR AI ASSISTANTS

Before completing any task:

- [ ] Followed all CRITICAL RULES
- [ ] Used appConfig for all customizable values
- [ ] Maintained file structure standards
- [ ] No hardcoded values
- [ ] No breaking changes
- [ ] Added feature flags for new features
- [ ] Updated documentation
- [ ] Tested existing features still work
- [ ] Added to Recent Changes Log if significant

---

**Remember: This is a configuration-based system. Keep it simple, keep it clean, keep it consistent!**

**Last Updated:** 2026-01-25 (Added Admin AppId Fix context)
   ```

5. **Test in Isolation**
   - Comment out new code
   - Test existing features
   - Add new code back gradually

---

## 📚 REQUIRED READING FOR ALL DEVELOPERS/AI

**MUST READ before making any changes:**

1. **ARCHITECTURE.md** - Understand the system architecture
2. **IMPLEMENTATION_SUMMARY.md** - How things are implemented
3. **CONFIGURATION.md** - Configuration options and usage
4. **DEVELOPMENT_STANDARDS.md** - This file (coding standards)
5. **ADMIN_FEATURE.md** - Example of proper feature implementation

---

## ⚡ QUICK REFERENCE

### **Configuration Location:**
- All app config: `src/config/appConfig.js`
- Theme constants: `src/config/theme.js`
- API config: `src/config/api.js`
- Backend config: `backend/.env`

### **Common Imports:**
```javascript
import appConfig from '../../config/appConfig';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as apiService from '../../utils/apiService';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
```

### **Feature Flag Pattern:**
```javascript
{appConfig.features.featureName && <Component />}
```

### **Text Usage:**
```javascript
{appConfig.text.screenName.label}
```

### **Color Usage:**
```javascript
backgroundColor: appConfig.colors.primary
```

---

## 🎯 FINAL REMINDERS

### **ALWAYS:**
✅ Read architecture documentation first
✅ Follow configuration-based pattern
✅ Use feature flags for new features
✅ Reuse existing components
✅ Use theme constants
✅ Test existing features after changes
✅ Document all changes
✅ Keep code clean and logical
✅ Maintain scalability

### **NEVER:**
❌ Hardcode values
❌ Break existing features
❌ Mix responsibilities
❌ Add complex logic to config
❌ Ignore architecture patterns
❌ Skip documentation
❌ Make changes without testing
❌ Duplicate code for same functionality
❌ Create multiple handlers for same action

---

## 📝 VERSION HISTORY

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-25 | 1.0 | Initial development standards document | Claude |

---

## ✅ COMPLIANCE STATEMENT

**All AI assistants (Claude, Copilot, ChatGPT, etc.) working on this codebase MUST:**

1. ✅ Read and understand this document
2. ✅ Follow all standards and guidelines
3. ✅ Maintain architecture consistency
4. ✅ Ensure zero breaking changes
5. ✅ Document all modifications
6. ✅ Test before and after changes
7. ✅ Keep code clean and scalable

**Non-compliance may result in broken functionality and project inconsistency.**

---

## 📖 CONCLUSION

This codebase uses a **configuration-based architecture** where:
- ONE file (`appConfig.js`) controls everything
- NO hardcoded values anywhere
- Feature flags control feature visibility
- Theme changes apply everywhere automatically
- Clean, logical, and scalable structure

**Follow these standards to maintain the quality and consistency of this project.** 🚀

---

**Last Updated:** 2026-01-25
**Next Review:** When major changes are planned
**Maintained By:** Development Team

**Questions? Read the documentation first!** 📚
