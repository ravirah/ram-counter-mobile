# ⚡ Quick Start - Dynamic Configuration

## 🎯 Make Changes in 3 Steps

### Step 1: Open Config File
```
src/config/appConfig.js
```

### Step 2: Edit What You Want
```javascript
export default {
  // Change app name
  appName: 'Your App Name Here',
  
  // Change mantra
  mantraWord: 'ॐ',
  mantraWordEnglish: 'Om',
  
  // Change colors
  colors: {
    primary: '#FF0000',    // Any hex color
    secondary: '#00FF00',
    accent: '#0000FF',
    // ... more colors
  },
  
  // Turn features on/off
  features: {
    showQuotes: true,      // true = show, false = hide
    showMotivation: true,
    showMilestones: true,
    showStats: true,
    enableAnimations: true,
  },
}
```

### Step 3: Save & Reload
- Save the file
- Reload app (Cmd+R / R / F5)
- Done! ✅

---

## 🎨 5-Minute Customizations

### Change to Krishna Theme
```javascript
appName: 'कृष्ण Bank',
mantraWord: 'कृष्ण',
colors: {
  primary: '#2196F3',  // Blue
  accent: '#FFC107',   // Gold
}
```

### Make it Dark Mode
```javascript
colors: {
  primary: '#BB86FC',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
}
```

### Minimal UI (no distractions)
```javascript
features: {
  showQuotes: false,
  showMotivation: false,
  showMilestones: false,
}
```

### Celebrate Every 108 Counts
```javascript
counter: {
  milestoneInterval: 108,  // Traditional mala
  milestoneEmoji: '🙏',
}
```

---

## 📋 What Can You Change?

✅ App name and titles  
✅ All colors and theme  
✅ Navigation icons  
✅ Quotes and messages  
✅ Milestone celebrations  
✅ Feature visibility  
✅ Mantra word (any language!)  
✅ Emojis and icons  

---

## 🔧 No Coding Required!

- **No complex logic** - just change values
- **No rebuild** - instant preview
- **No programming** - simple key-value pairs
- **100% customizable** - everything in one file

---

## 📖 Need More Details?

Read the full guide: [`CONFIGURATION.md`](./CONFIGURATION.md)

---

**Happy Customizing! 🚀**
