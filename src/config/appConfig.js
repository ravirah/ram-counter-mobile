// App Configuration - Change these values to customize the entire app
// No complex logic needed - just update this file!

export default {
  // App Identity
  appName: 'राम Bank',
  appId: 'ram-bank', // Unique identifier for this app (for multi-app backend)
  adminEmail: 'admin@ramcounter.com',
  mantraWord: 'राम',
  mantraWordEnglish: 'Ram',
  
  // Theme Colors - Change these to customize the entire app's appearance
  colors: {
    primary: '#FF9933',        // Main color (buttons, headers)
    secondary: '#138808',      // Secondary color
    accent: '#D4A373',         // Accent color (gradients)
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#333333',
    textSecondary: '#666666',
    success: '#4CAF50',
    error: '#F44336',
  },
  
  // Navigation Icons - Use any Ionicons name
  navigation: {
    counter: {
      icon: 'checkmark-circle',
      iconOutline: 'checkmark-circle-outline',
      label: 'Count',
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
    admin: {
      icon: 'shield-checkmark',
      iconOutline: 'shield-checkmark-outline',
      label: 'Admin',
    },
  },
  
  // Motivational Quotes - Add or remove as needed
  quotes: [
    {
      text: 'रामनाम जप से मिलता है शांति और आनंद',
      translation: 'Chanting Ramnam brings peace and joy',
    },
    {
      text: 'हर दिन राम की पूजा करो, जीवन सफल बनाओ',
      translation: 'Worship Ram daily, make life successful',
    },
    {
      text: 'राम का नाम ही सबसे बड़ी ताकत है',
      translation: 'The name of Ram is the greatest strength',
    },
    {
      text: 'निरंतर भक्ति ही सच्ची पूजा है',
      translation: 'Constant devotion is true worship',
    },
    {
      text: 'राम नाम सत्य है, सब कुछ सत्य है',
      translation: 'Ram name is truth, everything is truth',
    },
  ],
  
  // Counter Settings
  counter: {
    milestoneInterval: 10,           // Show celebration every N counts
    milestoneEmoji: '🎉',
    spiritualIcon: '🕉️',
    autoIncrementEnabled: true,      // Auto-increment when mantra is typed
    showAnimation: true,             // Show scale animation on count
  },
  
  // Text Content - Customize all app text from here
  text: {
    counterScreen: {
      todayLabel: "Today's Count",
      todaySubtext: '{mantra} chants today',
      inputLabel: 'Type "{mantra}" or "{mantraEnglish}" to auto-increment',
      inputPlaceholder: '{mantra}',
      milestoneTitle: '{emoji} Milestone!',
      milestoneMessage: 'Wonderful! You\'ve completed {count} {mantra} chants today!',
      motivationMessage: 'Each "{mantra}" chant is a step towards inner peace. Continue your spiritual journey!',
      statsLabels: {
        today: 'Today',
        total: 'Total',
        average: 'Average',
      },
    },
    statsScreen: {
      title: 'Your Statistics',
      totalCountLabel: 'Total Count',
      todayCountLabel: "Today's Count",
      averageLabel: 'Daily Average',
      streakLabel: 'Current Streak',
      daysLabel: 'days',
      noDataMessage: 'Start chanting to see your statistics!',
    },
    profileScreen: {
      title: 'Profile',
      nameLabel: 'Name',
      emailLabel: 'Email',
      phoneLabel: 'Phone',
      logoutButton: 'Logout',
      logoutConfirmTitle: 'Logout',
      logoutConfirmMessage: 'Are you sure you want to logout?',
    },
    adminScreen: {
      loginTitle: 'Admin Login',
      loginSubtitle: 'Administrator Dashboard Access',
      usernameLabel: 'Username',
      passwordLabel: 'Password',
      loginButton: 'Login as Admin',
      backButton: 'Back to User Login',
      dashboardTitle: 'Admin Dashboard',
      statsTitle: 'Dashboard Statistics',
      usersTitle: 'All Users',
      activitiesTitle: 'Recent Activities',
      searchPlaceholder: 'Search users...',
      totalUsersLabel: 'Total Users',
      activeTodayLabel: 'Active Today',
      todayCountLabel: 'Today\'s Total Count',
      noUsersMessage: 'No users found',
      noActivitiesMessage: 'No activities yet',
    },
  },
  
  // Feature Flags - Turn features on/off easily
  features: {
    showQuotes: true,
    showMotivation: true,
    showMilestones: true,
    showStats: true,
    enableAnimations: true,
    enableAdminAccess: true,  // Toggle admin access
  },
};
