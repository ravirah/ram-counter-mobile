import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, shadowStyles } from '../config/theme';
import appConfig from '../config/appConfig';

export default function NoConnection({ onRetry, message }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>&#x1F4E1;</Text>
      <Text style={styles.title}>No Connection</Text>
      <Text style={styles.message}>
        {message || 'Unable to connect to the server. Please check your internet connection.'}
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: appConfig.colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    ...shadowStyles.medium,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
