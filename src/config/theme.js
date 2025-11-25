import { Platform } from 'react-native';

export const colors = {
  // Primary brand colors (Indian Flag Colors)
  primary: '#FF9933',        // Saffron - Main buttons, headers, accents
  secondary: '#138808',      // Green - Secondary buttons, highlights
  accent: '#D4A373',         // Gold - Gradients, premium accents

  // Neutral colors
  white: '#FFFFFF',          // Backgrounds, surfaces
  black: '#000000',          // Text, outlines
  darkGray: '#333333',       // Primary text, headings
  gray: '#666666',           // Secondary text, icons
  lightGray: '#999999',      // Tertiary text, disabled states
  borderGray: '#E0E0E0',     // Dividers, borders
  backgroundColor: '#F5F5F5', // Page backgrounds, cards

  // Status colors
  success: '#4CAF50',        // Success messages, positive actions
  error: '#F44336',          // Errors, destructive actions
  warning: '#FF9800',        // Warnings, alerts, cautions
  info: '#2196F3',           // Info messages, informational content
};

export const fonts = {
  regular: 'System',
  bold: 'System',
  // Note: Devanagari script is supported by default on Android 5.0+ and iOS 10+
  // No custom font needed - system fonts handle it automatically
};

// Font weight constants for consistent typography
export const fontWeights = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

// Typography utilities for consistent text styles across app
export const typography = {
  heading1: {
    fontSize: 32,
    fontWeight: fontWeights.bold,
    lineHeight: 40,
  },
  heading2: {
    fontSize: 24,
    fontWeight: fontWeights.bold,
    lineHeight: 32,
  },
  heading3: {
    fontSize: 20,
    fontWeight: fontWeights.semibold,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: fontWeights.normal,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: fontWeights.normal,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: fontWeights.semibold,
    lineHeight: 16,
  },
  caption: {
    fontSize: 12,
    fontWeight: fontWeights.normal,
    lineHeight: 16,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadowStyles = Platform.select({
  web: {
    light: {
      boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.1)',
    },
    medium: {
      boxShadow: '0px 4px 5.84px rgba(0, 0, 0, 0.15)',
    },
    dark: {
      boxShadow: '0px 6px 7.84px rgba(0, 0, 0, 0.2)',
    },
  },
  default: {
    light: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 5.84,
      elevation: 8,
    },
    dark: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 7.84,
      elevation: 12,
    },
  },
});

export const gradients = {
  primary: ['#FF9933', '#FFFFFF', '#138808'],
  warm: ['#FF9933', '#D4A373'],
  cool: ['#138808', '#FFFFFF'],
  sunset: ['#FF6B6B', '#FF9933'],
};

export const motivationalQuotes = [
  {
    quote: 'रामनाम जप से मिलता है शांति और आनंद',
    translation: 'Chanting Ramnam brings peace and joy',
  },
  {
    quote: 'हर दिन राम की पूजा करो, जीवन सफल बनाओ',
    translation: 'Worship Ram daily, make life successful',
  },
  {
    quote: 'राम का नाम ही सबसे बड़ी ताकत है',
    translation: 'The name of Ram is the greatest strength',
  },
  {
    quote: 'निरंतर भक्ति ही सच्ची पूजा है',
    translation: 'Constant devotion is true worship',
  },
  {
    quote: 'राम नाम सत्य है, सब कुछ सत्य है',
    translation: 'Ram name is truth, everything is truth',
  },
  {
    quote: 'मन की शुद्धता से आती है खुशी',
    translation: 'Happiness comes from purity of mind',
  },
  {
    quote: 'राम की भक्ति से मिलता है मुक्ति',
    translation: 'Salvation comes through devotion to Ram',
  },
  {
    quote: 'प्रतिदिन राम जपो, आत्मा को शांत करो',
    translation: 'Chant Ram daily, calm your soul',
  },
];
