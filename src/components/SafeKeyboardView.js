import React from 'react';
import { KeyboardAvoidingView, View, Platform } from 'react-native';

/**
 * SafeKeyboardView - Platform-aware keyboard handling
 *
 * On iOS: Uses KeyboardAvoidingView with 'padding' behavior
 * On Android/Web: Falls back to regular View (KeyboardAvoidingView doesn't work well on these platforms)
 */
export default function SafeKeyboardView({ children, style, behavior, ...props }) {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        style={[{ flex: 1 }, style]}
        {...props}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  // For web and Android, use regular View
  return (
    <View style={[{ flex: 1 }, style]} {...props}>
      {children}
    </View>
  );
}
