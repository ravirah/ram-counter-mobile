// ========================================
// THEME PRESETS - Copy & Paste Ready!
// ========================================
// Just copy any preset below and paste it into src/config/appConfig.js
// Replace the entire "export default { ... }" section

// ========================================
// PRESET 1: Original Ram Theme (Default)
// ========================================
export const ramTheme = {
  appName: 'राम Bank',
  mantraWord: 'राम',
  mantraWordEnglish: 'Ram',
  
  colors: {
    primary: '#FF9933',
    secondary: '#138808',
    accent: '#D4A373',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#333333',
    textSecondary: '#666666',
    success: '#4CAF50',
    error: '#F44336',
  },
  
  counter: {
    milestoneInterval: 10,
    milestoneEmoji: '🎉',
    spiritualIcon: '🕉️',
  },
};

// ========================================
// PRESET 2: Krishna Theme (Blue & Gold)
// ========================================
export const krishnaTheme = {
  appName: 'कृष्ण Bank',
  mantraWord: 'कृष्ण',
  mantraWordEnglish: 'Krishna',
  
  colors: {
    primary: '#2196F3',      // Divine Blue
    secondary: '#FFC107',    // Golden
    accent: '#00BCD4',       // Peacock Cyan
    background: '#FFFFFF',
    surface: '#E3F2FD',
    text: '#1565C0',
    textSecondary: '#64B5F6',
    success: '#4CAF50',
    error: '#F44336',
  },
  
  counter: {
    milestoneInterval: 108,  // Traditional mala count
    milestoneEmoji: '🪈',    // Flute
    spiritualIcon: '🦚',     // Peacock
  },
};

// ========================================
// PRESET 3: Shiva Theme (Blue & White)
// ========================================
export const shivaTheme = {
  appName: 'शिव Bank',
  mantraWord: 'ॐ',
  mantraWordEnglish: 'Om',
  
  colors: {
    primary: '#1A237E',      // Deep Blue
    secondary: '#E3F2FD',    // Light Blue
    accent: '#00BCD4',       // Cyan
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1A237E',
    textSecondary: '#5C6BC0',
    success: '#4CAF50',
    error: '#F44336',
  },
  
  counter: {
    milestoneInterval: 108,
    milestoneEmoji: '🔱',    // Trident
    spiritualIcon: '🕉️',
  },
};

// ========================================
// PRESET 4: Hanuman Theme (Orange & Red)
// ========================================
export const hanumanTheme = {
  appName: 'हनुमान Bank',
  mantraWord: 'जय हनुमान',
  mantraWordEnglish: 'Jai Hanuman',
  
  colors: {
    primary: '#FF5722',      // Deep Orange
    secondary: '#F44336',    // Red
    accent: '#FF9800',       // Orange
    background: '#FFFFFF',
    surface: '#FFF3E0',
    text: '#BF360C',
    textSecondary: '#FF6F00',
    success: '#4CAF50',
    error: '#D32F2F',
  },
  
  counter: {
    milestoneInterval: 11,   // Auspicious number
    milestoneEmoji: '💪',    // Strength
    spiritualIcon: '🙏',
  },
};

// ========================================
// PRESET 5: Ganesh Theme (Orange & Yellow)
// ========================================
export const ganeshTheme = {
  appName: 'गणेश Bank',
  mantraWord: 'गं',
  mantraWordEnglish: 'Gam',
  
  colors: {
    primary: '#FF9800',      // Orange
    secondary: '#FFB300',    // Amber
    accent: '#FFC107',       // Golden
    background: '#FFFFFF',
    surface: '#FFF8E1',
    text: '#E65100',
    textSecondary: '#F57C00',
    success: '#4CAF50',
    error: '#F44336',
  },
  
  counter: {
    milestoneInterval: 21,   // Traditional count
    milestoneEmoji: '🐘',    // Elephant
    spiritualIcon: '🕉️',
  },
};

// ========================================
// PRESET 6: Durga Theme (Red & Gold)
// ========================================
export const durgaTheme = {
  appName: 'दुर्गा Bank',
  mantraWord: 'जय माँ दुर्गा',
  mantraWordEnglish: 'Jai Maa Durga',
  
  colors: {
    primary: '#D32F2F',      // Red
    secondary: '#FBC02D',    // Gold
    accent: '#FFD54F',       // Light Gold
    background: '#FFFFFF',
    surface: '#FFEBEE',
    text: '#B71C1C',
    textSecondary: '#C62828',
    success: '#4CAF50',
    error: '#D32F2F',
  },
  
  counter: {
    milestoneInterval: 108,
    milestoneEmoji: '🌺',    // Lotus
    spiritualIcon: '🔱',
  },
};

// ========================================
// PRESET 7: Dark Mode (Modern)
// ========================================
export const darkTheme = {
  appName: 'Mantra Counter',
  mantraWord: 'ॐ',
  mantraWordEnglish: 'Om',
  
  colors: {
    primary: '#BB86FC',      // Purple
    secondary: '#03DAC6',    // Teal
    accent: '#CF6679',       // Pink
    background: '#121212',   // Dark
    surface: '#1E1E1E',      // Dark Gray
    text: '#FFFFFF',         // White
    textSecondary: '#B3B3B3',// Light Gray
    success: '#03DAC6',
    error: '#CF6679',
  },
  
  counter: {
    milestoneInterval: 50,
    milestoneEmoji: '✨',
    spiritualIcon: '🌙',
  },
};

// ========================================
// PRESET 8: Minimal (Simple & Clean)
// ========================================
export const minimalTheme = {
  appName: 'Counter',
  mantraWord: 'Count',
  mantraWordEnglish: 'Count',
  
  colors: {
    primary: '#000000',      // Black
    secondary: '#424242',    // Dark Gray
    accent: '#757575',       // Gray
    background: '#FFFFFF',   // White
    surface: '#FAFAFA',      // Off White
    text: '#212121',
    textSecondary: '#757575',
    success: '#4CAF50',
    error: '#F44336',
  },
  
  counter: {
    milestoneInterval: 100,
    milestoneEmoji: '✓',
    spiritualIcon: '•',
  },
  
  features: {
    showQuotes: false,
    showMotivation: false,
    showMilestones: false,
    showStats: true,
    enableAnimations: false,
  },
};

// ========================================
// HOW TO USE PRESETS:
// ========================================
// 1. Choose a preset from above
// 2. Copy the entire theme object (everything inside the { })
// 3. Open src/config/appConfig.js
// 4. Replace the export default { ... } with your chosen preset
// 5. Fill in any missing properties from the original file
// 6. Save and reload!

// Example:
// Copy the krishnaTheme preset, then in appConfig.js:
// export default {
//   ...krishnaTheme,
//   // Add any additional configs like quotes, navigation, etc.
// }
