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
import * as authService from '../../utils/authService';

export default function AdminLoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAdminLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      await authService.adminLogin(email, password);
      Alert.alert('Success', 'Admin login successful');
      navigation.reset({
        index: 0,
        routes: [{ name: 'AdminDashboard' }],
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeKeyboardView style={styles.keyboardAvoid}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>राम Counter</Text>
            <Text style={styles.subtitle}>Admin Dashboard</Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Admin Email</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@example.com"
                placeholderTextColor={colors.lightGray}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  placeholderTextColor={colors.lightGray}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleAdminLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Logging In...' : 'Admin Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.userLoginLink}
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={styles.userLoginText}>← Back to User Login</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Admin Access Only</Text>
            <Text style={styles.infoText}>
              This section is restricted to administrators only. Unauthorized access is not permitted.
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
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
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
    color: colors.white,
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.xl + spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderGray,
    fontSize: 16,
    color: colors.black,
    ...shadowStyles.light,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    ...shadowStyles.medium,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  userLoginLink: {
    marginTop: spacing.lg,
  },
  userLoginText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.white,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 12,
    color: colors.white,
    lineHeight: 18,
  },
});
