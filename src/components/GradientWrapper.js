import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

/**
 * GradientWrapper - Platform-aware gradient component
 *
 * On Web: Wraps ExpoLinearGradient with proper flex container
 * On Mobile (Android/iOS): Uses ExpoLinearGradient directly
 */
const LinearGradient = (props) => {
  const { children, style, ...restProps } = props;

  if (Platform.OS === 'web') {
    // On web, wrap the component with proper flex handling
    return (
      <View style={[styles.container, style]}>
        <ExpoLinearGradient
          {...restProps}
          style={[StyleSheet.absoluteFill, styles.innerGradient]}
        >
          {children}
        </ExpoLinearGradient>
      </View>
    );
  }

  // On mobile, use ExpoLinearGradient directly
  return (
    <ExpoLinearGradient
      {...props}
      style={[styles.container, style]}
    >
      {children}
    </ExpoLinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  innerGradient: {
    flex: 1,
  },
});

export default LinearGradient;
