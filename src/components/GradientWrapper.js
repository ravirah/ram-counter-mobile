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
    return (
      <View style={[styles.base, style]}>
        <ExpoLinearGradient {...restProps} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    );
  }

  return (
    <ExpoLinearGradient {...restProps} style={[styles.base, style]}>
      {children}
    </ExpoLinearGradient>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export default LinearGradient;
