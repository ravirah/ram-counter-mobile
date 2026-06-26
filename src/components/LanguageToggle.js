import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageToggle() {
  const { lang, toggleLanguage } = useLanguage();

  return (
    <TouchableOpacity style={styles.wrap} onPress={toggleLanguage} activeOpacity={0.85}>
      <Text style={[styles.opt, lang === 'en' && styles.active]}>EN</Text>
      <View style={styles.sep} />
      <Text style={[styles.opt, lang === 'hi' && styles.active]}>हि</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  opt: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  active: {
    color: '#FFFFFF',
  },
  sep: {
    width: 1,
    height: 12,
    backgroundColor: '#9CA3AF',
    marginHorizontal: 3,
  },
});
