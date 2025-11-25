import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  // measurementId is optional - only include if available
  ...(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID && {
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  }),
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
// getAuth handles persistence automatically (localStorage for web, AsyncStorage for native)
const auth = getAuth(app);

// Set up reCAPTCHA verifier for web
let recaptchaVerifier = null;

export const getRecaptchaVerifier = () => {
  if (Platform.OS === 'web') {
    // For web, we use RecaptchaVerifier - create it fresh each time to ensure it works
    try {
      // Always check if container exists first
      let container = document.getElementById('recaptcha-container');

      // If container doesn't exist, create it
      if (!container) {
        container = document.createElement('div');
        container.id = 'recaptcha-container';
        document.body.appendChild(container);
      }

      // Reset verifier if it exists
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing reCAPTCHA:', e);
        }
        recaptchaVerifier = null;
      }

      // Create new verifier
      recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          recaptchaVerifier = null;
        },
        'error-callback': (error) => {
          console.error('reCAPTCHA error:', error);
          recaptchaVerifier = null;
        },
      });

      return recaptchaVerifier;
    } catch (error) {
      console.error('reCAPTCHA verifier setup error:', error);
      return null;
    }
  }
  return null;
};

// Initialize Auth function (can be called on app startup if needed)
export const initializeAuth = async () => {
  try {
    // Set persistence for web with timeout
    if (Platform.OS === 'web') {
      console.log('Setting Firebase persistence for web...');
      try {
        await Promise.race([
          setPersistence(auth, browserLocalPersistence),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Persistence timeout')), 2000)
          ),
        ]);
        console.log('✅ Persistence set successfully');
      } catch (persistError) {
        console.warn('⚠️ Persistence error (using default):', persistError.message);
        // Continue anyway - auth still works without explicit persistence
      }
    }
    return auth;
  } catch (error) {
    console.error('Auth initialization error:', error);
    return auth;
  }
};

export { auth, app };
