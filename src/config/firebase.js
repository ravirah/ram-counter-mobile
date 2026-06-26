// Firebase is disabled in offline mode
// This file is kept for compatibility but Firebase is not initialized

console.log('Firebase is disabled - running in offline mode');

// Dummy exports to prevent import errors
export const auth = null;
export const getRecaptchaVerifier = () => null;
export const signInWithPhoneNumber = () => Promise.reject(new Error('Firebase is disabled in offline mode'));
export const signOut = () => Promise.reject(new Error('Firebase is disabled in offline mode'));
export const initializeAuth = () => Promise.resolve(null);
export const app = null;
