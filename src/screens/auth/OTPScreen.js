import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';

export default function OTPScreen({ navigation, route }) {
  const params = route.params || {};
  const { phoneNumber = '', userName = null, isNewUser = false } = params;

  const handleContinueOffline = () => {
    // Since OTP is disabled, just navigate back to login
    Alert.alert(
      'Offline Mode',
      'OTP verification is disabled in offline mode. You can continue with simple local login.',
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login')
        }
      ]
    );
  };

  return (
    <LinearGradient
      colors={[colors.white, colors.backgroundColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeKeyboardView style={styles.keyboardAvoid}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.devanagariTitle}>श्री राम नाम बैंक</Text>
            <Text style={styles.subtitle}>Offline Mode</Text>
          </View>

          {/* Message */}
          <View style={styles.messageContainer}>
            <Text style={styles.message}>
              OTP verification requires Firebase authentication, which has been disabled for offline functionality.
            </Text>
            <Text style={styles.message}>
              The app now uses simple local login with just your name and optional PIN stored on your device.
            </Text>
            <Text style={styles.message}>
              No phone number or internet connection required!
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleContinueOffline}
          >
            <Text style={styles.buttonText}>Continue to Login</Text>
          </TouchableOpacity>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Your data is stored locally on this device only. Clearing app data will reset your progress.
            </Text>
          </View>
        </View>
      </SafeKeyboardView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  devanagariTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    fontWeight: '600',
  },
  messageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginVertical: spacing.xl,
  },
  message: {
    fontSize: 14,
    color: colors.darkGray,
    lineHeight: 20,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowStyles.medium,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: 12,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 16,
  },
});

