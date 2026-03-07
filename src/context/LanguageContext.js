import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations from '../config/i18n';

const LanguageContext = createContext();

const LANG_KEY = 'app_language';

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en'); // default English

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(saved => {
      if (saved && translations[saved]) setLang(saved);
    });
  }, []);

  const switchLanguage = async (newLang) => {
    if (translations[newLang]) {
      setLang(newLang);
      await AsyncStorage.setItem(LANG_KEY, newLang);
    }
  };

  const toggleLanguage = () => switchLanguage(lang === 'en' ? 'hi' : 'en');

  // t('counter.todayLabel') => nested lookup
  const t = (key) => {
    const keys = key.split('.');
    let value = translations[lang];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English
        let fallback = translations.en;
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return key; // key not found
          }
        }
        return typeof fallback === 'string' ? fallback : key;
      }
    }
    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ lang, t, switchLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
