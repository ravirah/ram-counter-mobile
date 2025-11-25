import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';

// Simple local-only login screen
// Stores a basic profile (name + optional PIN) in AsyncStorage via onLoggedIn callback
export default function LoginScreen({ onLoggedIn }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name');
      return;
    }

    if (pin && pin.length < 4) {
      Alert.alert('PIN too short', 'Use a 4-digit PIN or leave it empty');
      return;
    }

    if (!onLoggedIn) {
      Alert.alert('Error', 'Login handler is not configured');
      return;
    }

    try {
      setLoading(true);
      const profile = {
        name: name.trim(),
        pin: pin || null,
        createdAt: new Date().toISOString(),
      };
      await onLoggedIn(profile);
    } catch (error) {
      console.error('Local login error:', error);
      Alert.alert('Error', 'Could not save profile locally');
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.devanagariTitle}>राम Counter</Text>
            <Text style={styles.subtitle}>Welcome! Set up your profile once.</Text>
          </View>

          {/* Simple local login form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={colors.lightGray}
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PIN (optional, 4 digits)</Text>
              <TextInput
                style={styles.input}
                placeholder="1234"
                placeholderTextColor={colors.lightGray}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={pin}
                onChangeText={setPin}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Saving...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Your profile is stored only on this device. If you clear app data or reinstall,
              your profile and counts will be reset.
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
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
  },
  form: {
    marginVertical: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderGray,
    fontSize: 16,
    color: colors.black,
    ...shadowStyles.light,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowStyles.medium,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    marginBottom: spacing.lg,
  },
  footerText: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
