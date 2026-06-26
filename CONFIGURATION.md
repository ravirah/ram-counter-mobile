# 🎨 Dynamic App Configuration Guide

This app is now **fully dynamic and customizable** through a simple configuration file. No complex logic needed!

## 📁 Configuration File Location

All app customization is done in one file:
```
src/config/appConfig.js
```

## 🚀 How to Customize

Simply open `src/config/appConfig.js` and modify the values. The changes will automatically apply throughout the entire app!

---

## 🎯 Configuration Options

### 1. **App Identity**

Change the app name and mantra word:

```javascript
appName: 'राम Bank',           // Shows in header
mantraWord: 'राम',             // The word to count
mantraWordEnglish: 'Ram',      // English version
```

**Example:** Change to Krishna counter:
```javascript
appName: 'कृष्ण Bank',
mantraWord: 'कृष्ण',
mantraWordEnglish: 'Krishna',
```

---

### 2. **Theme Colors**

Customize the entire app's color scheme:

```javascript
colors: {
  primary: '#FF9933',        // Main buttons, header, counter circle
  secondary: '#138808',      // Secondary accents, borders
  accent: '#D4A373',         // Tab highlight, gradients
  background: '#FFFFFF',     // Main background
  surface: '#F5F5F5',        // Card backgrounds
  text: '#333333',          // Primary text
  textSecondary: '#666666',  // Secondary text
  success: '#4CAF50',       // Success messages
  error: '#F44336',         // Error messages
}
```

**Example:** Dark theme:
```javascript
colors: {
  primary: '#BB86FC',
  secondary: '#03DAC6',
  accent: '#CF6679',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  success: '#4CAF50',
  error: '#CF6679',
}
```

---

### 3. **Navigation Icons**

Change tab bar icons (uses [Ionicons](https://ionic.io/ionicons)):

```javascript
navigation: {
  counter: {
    icon: 'checkmark-circle',           // Active icon
    iconOutline: 'checkmark-circle-outline', // Inactive icon
    label: 'Count',                     // Tab label
  },
  stats: {
    icon: 'bar-chart',
    iconOutline: 'bar-chart-outline',
    label: 'Stats',
  },
  profile: {
    icon: 'person',
    iconOutline: 'person-outline',
    label: 'Profile',
  },
}
```

**Popular icon options:**
- `heart` / `heart-outline`
- `star` / `star-outline`
- `flame` / `flame-outline`
- `flower` / `flower-outline`
- `sparkles` / `sparkles-outline`

---

### 4. **Motivational Quotes**

Add, remove, or modify quotes:

```javascript
quotes: [
  {
    text: 'रामनाम जप से मिलता है शांति और आनंद',
    translation: 'Chanting Ramnam brings peace and joy',
  },
  {
    text: 'Your custom quote here',
    translation: 'English translation',
  },
  // Add as many as you want!
]
```

The app randomly selects one quote each time the counter screen loads.

---

### 5. **Counter Settings**

Customize counter behavior:

```javascript
counter: {
  milestoneInterval: 10,           // Show celebration every N counts
  milestoneEmoji: '🎉',           // Emoji for milestone
  spiritualIcon: '🕉️',            // Icon in motivation box
  autoIncrementEnabled: true,      // Auto-count when typing mantra
  showAnimation: true,             // Pulse animation on count
}
```

**Example:** Celebrate every 50 counts:
```javascript
counter: {
  milestoneInterval: 50,
  milestoneEmoji: '🌟',
  // ... rest remains same
}
```

---

### 6. **Text Content**

Customize all app text from one place:

```javascript
text: {
  counterScreen: {
    todayLabel: "Today's Count",
    todaySubtext: '{mantra} chants today',
    inputLabel: 'Type "{mantra}" or "{mantraEnglish}" to auto-increment',
    inputPlaceholder: '{mantra}',
    milestoneTitle: '{emoji} Milestone!',
    milestoneMessage: 'Wonderful! You\'ve completed {count} {mantra} chants today!',
    motivationMessage: 'Each "{mantra}" chant is a step towards inner peace.',
    statsLabels: {
      today: 'Today',
      total: 'Total',
      average: 'Average',
    },
  },
  // ... more screens
}
```

**Template variables available:**
- `{mantra}` - Replaced with your mantra word
- `{mantraEnglish}` - Replaced with English version
- `{count}` - Replaced with current count
- `{emoji}` - Replaced with milestone emoji

---

### 7. **Feature Flags**

Turn features on/off instantly:

```javascript
features: {
  showQuotes: true,          // Daily motivational quotes
  showMotivation: true,      // Motivation box at bottom
  showMilestones: true,      // Celebration popups
  showStats: true,           // Today/Total/Average stats
  enableAnimations: true,    // Pulse animations
}
```

**Example:** Minimal UI:
```javascript
features: {
  showQuotes: false,
  showMotivation: false,
  showMilestones: false,
  showStats: true,
  enableAnimations: true,
}
```

---

## 🎨 Quick Customization Examples

### Example 1: Krishna Counter (Blue Theme)

```javascript
export default {
  appName: 'कृष्ण Bank',
  mantraWord: 'कृष्ण',
  mantraWordEnglish: 'Krishna',
  
  colors: {
    primary: '#2196F3',      // Blue
    secondary: '#FFC107',    // Gold
    accent: '#00BCD4',       // Cyan
    // ... rest same
  },
  
  counter: {
    milestoneInterval: 108,  // Traditional mala count
    milestoneEmoji: '🪈',    // Flute
    spiritualIcon: '🦚',     // Peacock
    // ... rest same
  },
}
```

### Example 2: Minimalist Design

```javascript
export default {
  appName: 'Counter',
  mantraWord: 'Om',
  mantraWordEnglish: 'Om',
  
  colors: {
    primary: '#000000',
    secondary: '#333333',
    accent: '#666666',
    background: '#FFFFFF',
    surface: '#F9F9F9',
    // ... rest same
  },
  
  features: {
    showQuotes: false,
    showMotivation: false,
    showMilestones: false,
    showStats: true,
    enableAnimations: false,
  },
}
```

### Example 3: Hanuman Theme (Orange & Red)

```javascript
export default {
  appName: 'Hanuman Bank',
  mantraWord: 'जय हनुमान',
  mantraWordEnglish: 'Jai Hanuman',
  
  colors: {
    primary: '#FF5722',      // Deep Orange
    secondary: '#F44336',    // Red
    accent: '#FF9800',       // Orange
    // ... rest same
  },
  
  counter: {
    milestoneInterval: 11,   // Significance in Hanuman worship
    milestoneEmoji: '💪',
    spiritualIcon: '🙏',
    // ... rest same
  },
  
  quotes: [
    {
      text: 'जय हनुमान ज्ञान गुन सागर',
      translation: 'Glory to Hanuman, ocean of wisdom and virtue',
    },
    // Add more Hanuman Chalisa verses...
  ],
}
```

---

## 📱 Testing Your Changes

After editing `appConfig.js`:

1. Save the file
2. Reload the app:
   - **iOS**: Press `Cmd + R`
   - **Android**: Press `R` twice or shake device
   - **Web**: Refresh browser (F5)

No rebuild needed! Changes apply instantly in development mode.

---

## ✅ Best Practices

1. **Backup First**: Keep a copy of original `appConfig.js` before major changes
2. **Test Colors**: Ensure sufficient contrast for readability
3. **Icon Consistency**: Use related icons from the same Ionicons set
4. **Quote Length**: Keep quotes concise for better display
5. **Milestone Interval**: Choose meaningful numbers (10, 50, 108, etc.)

---

## 🆘 Troubleshooting

**Problem**: App crashes after config change
- **Solution**: Check for syntax errors (missing commas, quotes)

**Problem**: Colors not applying
- **Solution**: Use valid hex colors (e.g., `#FF0000`)

**Problem**: Icons not showing
- **Solution**: Verify icon names at [Ionicons.com](https://ionic.io/ionicons)

**Problem**: Text not updating
- **Solution**: Check template variables like `{mantra}` are used correctly

---

## 💡 Pro Tips

1. **Hex Colors**: Use tools like [Coolors.co](https://coolors.co) for color palettes
2. **Icons**: Browse [Ionicons](https://ionic.io/ionicons) for 1300+ icons
3. **Languages**: Full Unicode support - use any language!
4. **Emojis**: Works on all platforms (iOS, Android, Web)
5. **Testing**: Try different milestoneInterval values to find what motivates you

---

## 🎉 That's It!

Your app is now fully customizable without touching any complex code. Just edit one file (`appConfig.js`) and you're done!

**Happy Customizing! 🙏**
