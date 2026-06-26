# 🎨 Dynamic React Native App - Configuration-Based

This React Native app has been made **fully dynamic and customizable** through a simple configuration system. No complex logic required!

## ✨ What's Dynamic?

Everything can be changed from **ONE FILE**: `src/config/appConfig.js`

### Customizable Features:

✅ **App Name & Branding** - Change titles and mantra words  
✅ **Full Theme System** - Colors, gradients, styles  
✅ **Navigation** - Icons, labels  
✅ **Content** - Quotes, messages, labels  
✅ **Behavior** - Milestone intervals, animations  
✅ **Features** - Toggle UI elements on/off  

## 🚀 Quick Start

### 1. Open Configuration File
```bash
src/config/appConfig.js
```

### 2. Change What You Want
```javascript
export default {
  appName: 'Your App Name',
  mantraWord: 'ॐ',
  
  colors: {
    primary: '#FF0000',
    secondary: '#00FF00',
    // ... more colors
  },
  
  features: {
    showQuotes: true,
    showStats: true,
    // ... more features
  },
}
```

### 3. Save & Reload
- Save the file
- Reload app (no rebuild needed!)
- Changes apply instantly ✨

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 5-minute guide to get started
- **[CONFIGURATION.md](./CONFIGURATION.md)** - Complete configuration reference
- **[THEME_PRESETS.js](./THEME_PRESETS.js)** - 8 ready-to-use theme presets

## 🎯 Simple Implementation

### No Complex Logic!

**Before (Hardcoded):**
```javascript
<Text style={styles.title}>राम Bank</Text>
<View style={{ backgroundColor: '#FF9933' }}>
```

**After (Dynamic):**
```javascript
<Text style={styles.title}>{appConfig.appName}</Text>
<View style={{ backgroundColor: appConfig.colors.primary }}>
```

### Single Source of Truth

All customization happens in **one place**:
- No hunting through multiple files
- No complex conditional logic
- Simple key-value configuration
- Template string replacements

## 🎨 Ready-to-Use Themes

Choose from 8 built-in theme presets:

1. **Ram Theme** (Original) - Saffron & Green
2. **Krishna Theme** - Blue & Gold  
3. **Shiva Theme** - Deep Blue & White
4. **Hanuman Theme** - Orange & Red
5. **Ganesh Theme** - Orange & Yellow
6. **Durga Theme** - Red & Gold
7. **Dark Mode** - Modern Purple/Teal
8. **Minimal** - Clean Black & White

See `THEME_PRESETS.js` for copy-paste ready code!

## 🔧 Key Features

### Feature Flags
Turn features on/off with a boolean:
```javascript
features: {
  showQuotes: true,        // Toggle quotes
  showMotivation: true,    // Toggle motivation box
  showMilestones: true,    // Toggle celebrations
  showStats: true,         // Toggle statistics
  enableAnimations: true,  // Toggle animations
}
```

### Template Strings
Dynamic text with placeholders:
```javascript
text: {
  milestoneMessage: 'You completed {count} {mantra} chants!',
}
// Automatically replaces {count} and {mantra}
```

### Color System
Complete theme control:
```javascript
colors: {
  primary: '#FF9933',      // Buttons, headers
  secondary: '#138808',    // Accents
  accent: '#D4A373',       // Highlights
  background: '#FFFFFF',   // Backgrounds
  // ... more colors
}
```

## 📱 Platform Support

Works on all platforms:
- ✅ iOS
- ✅ Android  
- ✅ Web

Hot reloading works in development - changes apply instantly!

## 🎯 Benefits

1. **No Coding Required** - Just change values
2. **Type-Safe** - Clear structure and defaults
3. **Instant Preview** - See changes immediately
4. **Easy Maintenance** - All config in one place
5. **Theme Switching** - Swap entire themes easily
6. **Multi-Language** - Full Unicode support
7. **Scalable** - Easy to add new config options

## 🏗️ Architecture

```
src/
├── config/
│   ├── appConfig.js      ← EDIT THIS FILE!
│   └── theme.js          (spacing, shadows, etc.)
├── screens/
│   ├── app/
│   │   ├── CounterScreen.js   (uses appConfig)
│   │   ├── StatsScreen.js
│   │   └── ProfileScreen.js
│   └── auth/
└── ...

App.js                     (uses appConfig for navigation)
```

### How It Works

1. **Configuration** - All customization in `appConfig.js`
2. **Import** - Screens import `appConfig`
3. **Use Values** - Replace hardcoded values with config
4. **Templates** - Dynamic strings with placeholders
5. **Feature Flags** - Conditional rendering based on flags

## 💡 Example Use Cases

### Multi-Tenant App
```javascript
// tenant1.js
export default { appName: 'App 1', colors: { primary: '#FF0000' } }

// tenant2.js  
export default { appName: 'App 2', colors: { primary: '#0000FF' } }
```

### A/B Testing
```javascript
features: {
  showQuotes: Math.random() > 0.5,  // 50% of users see quotes
}
```

### User Preferences
```javascript
// Load from AsyncStorage
const userPrefs = await AsyncStorage.getItem('theme');
export default { ...defaultConfig, ...userPrefs };
```

## 🚦 Getting Started

1. **Read** [QUICK_START.md](./QUICK_START.md) (2 minutes)
2. **Edit** `src/config/appConfig.js`
3. **Test** your changes
4. **Explore** [CONFIGURATION.md](./CONFIGURATION.md) for advanced options

## 🎓 Learn More

- React Native: https://reactnative.dev/
- Expo: https://expo.dev/
- Ionicons: https://ionic.io/ionicons

## 📄 License

This implementation pattern is free to use and modify!

---

**Made with ❤️ for simple, maintainable React Native apps**

*No complex logic. Just configuration. 🎯*
