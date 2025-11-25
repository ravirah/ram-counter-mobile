import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import { verifyOTP, registerUserWithPhone, loginUserWithPhone } from '../../utils/authService';

export default function OTPScreen({ navigation, route }) {
  const params = route.params || {};
  const { phoneNumber = '', verificationId = null, testOTP = null, userName = null, isNewUser = false } = params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);

  // Validate params
  useEffect(() => {
    if (!phoneNumber || !verificationId) {
      console.error('Missing required params:', { phoneNumber, verificationId });
      Alert.alert('Error', 'Invalid OTP request. Please go back and try again.');
      navigation.goBack();
    }
  }, [phoneNumber, verificationId, navigation]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP');
      return;
    }

    if (!verificationId) {
      Alert.alert('Error', 'Verification ID is missing. Please request OTP again.');
      return;
    }

    try {
      setLoading(true);

      // Verify OTP with Firebase + Backend fallback
      const user = await verifyOTP(verificationId, otp, phoneNumber);

      // For new user registration, call registerUserWithPhone
      // If user already exists, it will automatically log them in
      if (isNewUser && userName) {
        try {
          // Use Firebase UID if available, otherwise don't send it
          const firebaseUid = user.isBackendVerified ? null : user.uid;
          const registeredUser = await registerUserWithPhone(phoneNumber, userName, firebaseUid);
          console.log('✅ User registered or logged in successfully:', registeredUser.name);
        } catch (registrationError) {
          console.warn('⚠️ Registration failed:', registrationError.message);
          Alert.alert('Registration Issue', registrationError.message);
          setLoading(false);
          return;
        }
      } else {
        // For existing users, we need to login to get a token
        try {
          const firebaseUid = user.isBackendVerified ? null : user.uid;
          const loggedInUser = await loginUserWithPhone(phoneNumber, firebaseUid);
          console.log('✅ Existing user logged in successfully:', loggedInUser.name);
        } catch (loginError) {
          console.warn('⚠️ Login failed:', loginError.message);
          Alert.alert('Login Failed', loginError.message);
          setLoading(false);
          return;
        }
      }

      // User data is already saved by registerUserWithPhone or login call above
      // No need to save again here

      Alert.alert('Success', isNewUser ? 'Account created successfully!' : 'OTP verified successfully');

      // Wait a moment for state to update, then navigate
      // The App.js will detect the new user in AsyncStorage and switch to AppStack
      setTimeout(() => {
        console.log('📲 Navigating to app after OTP verification');
        // Just navigate back to Login, and App.js will handle showing AppStack
        navigation.navigate('Login');
      }, 500);
    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert('Error', error.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer === 0) {
      try {
        setLoading(true);
        const { sendOTP } = await import('../../utils/authService');
        await sendOTP(phoneNumber);

        Alert.alert('OTP Resent', 'A new OTP has been sent to your phone');
        setTimer(60);
      } catch (error) {
        console.error('Resend OTP error:', error);
        Alert.alert('Error', error.message || 'Failed to resend OTP');
      } finally {
        setLoading(false);
      }
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
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          </View>

          {/* OTP Input */}
          <View style={styles.form}>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor={colors.lightGray}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Text>
            </TouchableOpacity>

            {/* Resend OTP */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive OTP? </Text>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={timer > 0}
              >
                <Text
                  style={[
                    styles.resendLink,
                    timer > 0 && styles.resendLinkDisabled,
                  ]}
                >
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🕉️ Spiritual Tip: Use this time to meditate on your intentions for this practice.
            </Text>
          </View>

          {/* Test OTP (Development Only) */}
          {testOTP && (
            <View style={styles.testOtpBox}>
              <Text style={styles.testOtpLabel}>🧪 Test OTP (Dev Mode):</Text>
              <Text style={styles.testOtpValue}>{testOTP}</Text>
              <Text style={styles.testOtpNote}>This OTP is stored in MongoDB</Text>
            </View>
          )}
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
    marginTop: spacing.md,
  },
  backButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: spacing.sm,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  form: {
    marginVertical: spacing.xl,
  },
  otpInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    fontSize: 32,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: spacing.md,
    marginBottom: spacing.xl,
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    fontSize: 14,
    color: colors.gray,
  },
  resendLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: colors.lightGray,
  },
  infoBox: {
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    ...shadowStyles.light,
  },
  infoText: {
    fontSize: 13,
    color: colors.gray,
    fontStyle: 'italic',
  },
  testOtpBox: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',  // warning color with opacity
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
    ...shadowStyles.light,
  },
  testOtpLabel: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  testOtpValue: {
    fontSize: 18,
    color: colors.warning,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: spacing.xs,
  },
  testOtpNote: {
    fontSize: 11,
    color: colors.warning,
    fontStyle: 'italic',
  },
});
