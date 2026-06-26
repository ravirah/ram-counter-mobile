import { Platform } from 'react-native';

export const colors = {
  // Primary brand colors (Indian Flag Colors)
  primary: '#FF9933',        // Saffron - Main buttons, headers, accents
  secondary: '#138808',      // Green - Secondary buttons, highlights
  accent: '#D4A373',         // Gold - Gradients, premium accents
  deepSaffron: '#E07B20',    // Deeper saffron for contrast
  lightSaffron: '#FFB86C',   // Lighter saffron for highlights

  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  darkGray: '#2D2D2D',       // Primary text, headings
  gray: '#6B6B6B',           // Secondary text
  lightGray: '#9CA3AF',      // Disabled / placeholder
  borderGray: '#EBEBEB',     // Dividers
  backgroundColor: '#FFF8F0', // Warm page background

  // Status colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
};

export const fonts = {
  regular: 'System',
  bold: 'System',
};

export const fontWeights = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const typography = {
  heading1: {
    fontSize: 34,
    fontWeight: fontWeights.extrabold,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  heading2: {
    fontSize: 26,
    fontWeight: fontWeights.bold,
    lineHeight: 34,
    letterSpacing: -0.3,
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
    fontSize: 11,
    fontWeight: fontWeights.semibold,
    lineHeight: 16,
    letterSpacing: 0.8,
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
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
};

export const shadowStyles = Platform.select({
  web: {
    light: {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
    },
    medium: {
      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.1)',
    },
    dark: {
      boxShadow: '0px 8px 28px rgba(0, 0, 0, 0.14)',
    },
    glow: {
      boxShadow: '0px 6px 28px rgba(255, 153, 51, 0.45)',
    },
  },
  default: {
    light: Platform.OS === 'web'
      ? { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
    medium: Platform.OS === 'web'
      ? { boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.1)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 6,
        },
    dark: Platform.OS === 'web'
      ? { boxShadow: '0px 8px 28px rgba(0, 0, 0, 0.14)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.14,
          shadowRadius: 20,
          elevation: 10,
        },
    glow: Platform.OS === 'web'
      ? { boxShadow: '0px 6px 28px rgba(255, 153, 51, 0.45)' }
      : {
          shadowColor: '#FF9933',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 22,
          elevation: 12,
        },
  },
});

export const gradients = {
  primary: ['#FF9933', '#FFFFFF', '#138808'],
  warm: ['#FF9933', '#D4A373'],
  cool: ['#138808', '#FFFFFF'],
  sunset: ['#FF6B6B', '#FF9933'],
  saffronHero: ['#FF8C00', '#FF9933', '#FFB86C'],
  saffronDeep: ['#FF9933', '#E07B20'],
  pageWarm: ['#FFF8F0', '#FFFFFF'],
};

export const motivationalQuotes = [
  {
    quote: 'श्री राम नाम बैंक से मिलता है शांति और आनंद',
    translation: 'Chanting Shri Ram Nam Bank brings peace and joy',
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


