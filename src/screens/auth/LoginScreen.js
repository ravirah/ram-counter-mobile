import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import appConfig from '../../config/appConfig';
import * as apiService from '../../utils/apiService';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import { useLanguage } from '../../context/LanguageContext';

// Login screen – mobile number is the unique key; auto-populates name for existing users
export default function LoginScreen({ onLoggedIn, navigation }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [pendingState, setPendingState] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const nameRef = useRef(null);

  // Auto-lookup when user finishes entering 10-digit mobile
  const handleMobileChange = async (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);

    // Reset state when mobile changes
    if (digits.length < 10) {
      setIsExistingUser(false);
      setIsNewUser(false);
      setName('');
      setLookupError('');
      return;
    }

    // Lookup when 10 digits entered
    if (digits.length === 10) {
      setLookingUp(true);
      setLookupError('');
      try {
        const result = await apiService.lookupUser(digits, appConfig.appId);
        if (result.exists && result.user) {
          setName(result.user.name || '');
          setIsExistingUser(true);
          setIsNewUser(false);
        } else {
          setName('');
          setIsExistingUser(false);
          setIsNewUser(true);
          setTimeout(() => nameRef.current?.focus(), 100);
        }
      } catch (_) {
        setIsExistingUser(false);
        setIsNewUser(false);
        setLookupError(t('connectionError'));
      } finally {
        setLookingUp(false);
      }
    }
  };

  const handleContinue = async () => {
    if (!mobile.trim() || mobile.trim().length !== 10) {
      Alert.alert('Invalid mobile number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name');
      return;
    }

    if (!onLoggedIn) {
      Alert.alert('Error', 'Login handler is not configured');
      return;
    }

    try {
      setLoading(true);
      console.log('🔵 Logging in user:', name, mobile);

      const result = await apiService.loginUser(
        name.trim(),
        null,
        mobile.trim(),
        null,
        appConfig.appId
      );
      console.log('🔵 Backend login result:', result);

      // Block if not approved
      if (result.approved === false) {
        setPendingState({
          status: result.status || 'pending',
          message: result.message,
          userName: name.trim(),
        });
        return;
      }

      await AsyncStorage.setItem('backendEnabled', 'true');

      const backendUser = result.user || {};
      const profile = {
        _id: backendUser.id || backendUser._id || undefined,
        name: backendUser.name || name.trim(),
        mobile: backendUser.mobile || mobile.trim(),
        totalCount: backendUser.totalCount || 0,
        createdAt: backendUser.createdAt || new Date().toISOString(),
        backendSynced: true,
      };
      await onLoggedIn(profile);
    } catch (error) {
      console.error('🔴 Login error:', error);
      Alert.alert(
        'Connection Error',
        t('connectionError')
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Pending / Rejected screen ──────────────────────────────────────────────
  if (pendingState) {
    const isPending = pendingState.status === 'pending';
    const bgColors = isPending
      ? ['#FF8C00', '#FF9933', '#FFB86C']
      : ['#c0392b', '#e74c3c', '#f39c12'];

    return (
      <LinearGradient colors={bgColors} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.container}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.pendingContent}>
          <Text style={styles.pendingIcon}>{isPending ? '⏳' : '🚫'}</Text>
          <Text style={styles.pendingTitle}>
            {isPending ? t('login.pendingTitle') : t('login.rejectedTitle')}
          </Text>
          <Text style={styles.pendingName}>{t('login.hello').replace('{name}', pendingState.userName)} 🙏</Text>

          <View style={styles.pendingCard}>
            {isPending ? (
              <>
                <Text style={styles.pendingCardTitle}>{t('login.whatsHappening')}</Text>
                <Text style={styles.pendingCardText}>
                  {t('login.pendingExplain')}
                </Text>
                <View style={styles.pendingDivider} />
                <Text style={styles.pendingCardTitle}>{t('login.whatNext')}</Text>
                <Text style={styles.pendingCardText}>
                  {t('login.pendingSteps')}
                </Text>
                <View style={styles.pendingDivider} />
                <Text style={styles.pendingCardTitle}>🕐 {t('login.typicalApproval')}</Text>
                <Text style={styles.pendingCardText}>{t('login.within24h')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.pendingCardTitle}>{t('login.rejectedTitle')}</Text>
                <Text style={styles.pendingCardText}>
                  {t('login.rejectedExplain')}
                </Text>
                <Text style={styles.pendingCardText}>
                  {t('login.rejectedReasons')}
                </Text>
                <View style={styles.pendingDivider} />
                <Text style={styles.pendingCardText}>
                  {t('login.rejectedContact')}
                </Text>
              </>
            )}
          </View>

          {isPending && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={async () => {
                setLoading(true);
                try {
                  const result = await apiService.loginUser(name.trim(), null, mobile.trim(), null, appConfig.appId);
                  if (result.approved === false) {
                    setPendingState({ status: result.status || 'pending', message: result.message, userName: name.trim() });
                  } else if (result.approved === true) {
                    await AsyncStorage.setItem('backendEnabled', 'true');
                    const bu = result.user || {};
                    await onLoggedIn({
                      _id: bu.id || bu._id || undefined,
                      name: bu.name || name.trim(),
                      mobile: bu.mobile || mobile.trim(),
                      totalCount: bu.totalCount || 0,
                      createdAt: bu.createdAt || new Date().toISOString(),
                      backendSynced: true,
                    });
                  }
                } catch (e) {
                  // still pending
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              <Text style={styles.retryButtonText}>{loading ? t('login.checking') : `🔄 ${t('login.checkAgain')}`}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.backToLoginBtn} onPress={() => setPendingState(null)}>
            <Text style={styles.backToLoginText}>{t('login.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── Normal login form ───────────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={['#FF8C00', '#FF9933', '#FFB86C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      {/* Decorative background circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      <View style={styles.decorCircle3} />

      <SafeKeyboardView style={styles.keyboardAvoid}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.spiritualSymbol}>🕉️</Text>
            <Text style={styles.devanagariTitle}>राम Bank</Text>
            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
          </View>

          {/* Form — mobile first, name auto-populates for existing users */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('login.mobileLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={handleMobileChange}
                editable={!loading}
              />
              {lookingUp && (
                <View style={styles.lookupRow}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.lookupText}>{t('login.checking')}</Text>
                </View>
              )}
              {isExistingUser && !lookingUp && (
                <Text style={styles.welcomeBackText}>{t('login.welcomeBack').replace('{name}', name)}</Text>
              )}
              {lookupError !== '' && (
                <Text style={styles.errorText}>{lookupError}</Text>
              )}
            </View>

            {(isExistingUser || isNewUser) && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('login.nameLabel')}</Text>
                <TextInput
                  ref={nameRef}
                  style={[styles.input, isExistingUser && styles.inputAutoFilled]}
                  placeholder={isExistingUser ? name : t('login.namePlaceholder')}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={name}
                  onChangeText={setName}
                  editable={!loading && !isExistingUser}
                />
                {isExistingUser && (
                  <Text style={styles.autoFilledHint}>{t('login.autoFilled')}</Text>
                )}
              </View>
            )}

            {(isExistingUser || isNewUser) && (
              <TouchableOpacity
                style={[styles.primaryButton, (loading || lookingUp) && styles.buttonDisabled]}
                onPress={handleContinue}
                disabled={loading || lookingUp}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? t('login.saving') : isExistingUser ? t('login.loginBtn') : t('login.continueBtn')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Admin Login */}
            {appConfig.features.enableAdminAccess && (
              <TouchableOpacity
                style={styles.adminLink}
                onPress={() => navigation.navigate('AdminLogin')}
              >
                <Text style={styles.adminLinkText}>{t('login.adminLogin')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('login.footer')}
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
  // Decorative background shapes
  decorCircle1: {
    position: 'absolute',
    top: -70,
    right: -55,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 130,
    left: -65,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  decorCircle3: {
    position: 'absolute',
    top: 200,
    right: -35,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingTop: 90,
    paddingBottom: spacing.xl,
  },
  // Header
  header: {
    alignItems: 'center',
  },
  spiritualSymbol: {
    fontSize: 54,
    marginBottom: spacing.md,
  },
  devanagariTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.82)',
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  // Form
  form: {
    marginVertical: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    fontSize: 17,
    color: colors.white,
  },
  inputAutoFilled: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  lookupText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: spacing.xs,
  },
  welcomeBackText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
  },
  autoFilledHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 13,
    color: '#FFCDD2',
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  // Buttons
  primaryButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadowStyles.medium,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: appConfig.colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  adminLink: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  adminLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  // Pending / Rejected screen
  pendingContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 80,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  pendingIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  pendingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pendingName: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  pendingCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: spacing.lg,
  },
  pendingCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  pendingCardText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 21,
    marginBottom: spacing.xs,
  },
  pendingDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    ...shadowStyles.medium,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: appConfig.colors.primary,
  },
  backToLoginBtn: {
    paddingVertical: spacing.sm,
  },
  backToLoginText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },

  // Footer
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
