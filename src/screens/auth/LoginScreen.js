import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
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
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [hasCachedPrefill, setHasCachedPrefill] = useState(false);
  const nameRef = useRef(null);
  const lookupTimerRef = useRef(null);
  const lookupRequestRef = useRef(0);
  const nameEditedRef = useRef(false);
  const hasCachedPrefillRef = useRef(false);
  const PREFILL_CACHE_PREFIX = 'loginPrefill';

  useEffect(() => {
    apiService.warmBackend().catch(() => {});
    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
      lookupRequestRef.current += 1;
    };
  }, []);

  const setNameEdited = (value) => {
    nameEditedRef.current = value;
    setNameManuallyEdited(value);
  };

  const handleNameChange = (value) => {
    setNameEdited(true);
    setName(value);
  };
  const getPrefillKey = (digits) => `${PREFILL_CACHE_PREFIX}:${appConfig.appId}:${digits}`;
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const getCreatedAtValue = (backendUser = {}) => backendUser.createdAt || backendUser.registeredAt || backendUser.joinedAt || null;
  const getAccountAgeMs = (backendUser = {}) => {
    const createdAt = getCreatedAtValue(backendUser);
    if (!createdAt) return null;
    const createdAtMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) return null;
    return Date.now() - createdAtMs;
  };
  const requiresApprovalNow = (backendUser = {}) => {
    const ageMs = getAccountAgeMs(backendUser);
    return ageMs !== null && ageMs >= TWO_DAYS_MS;
  };
  const buildProfileFromBackendUser = (backendUser = {}, fallbackName = '', fallbackMobile = '') => ({
    _id: backendUser.id || backendUser._id || undefined,
    name: backendUser.name || fallbackName,
    mobile: backendUser.mobile || fallbackMobile,
    totalCount: backendUser.totalCount || 0,
    createdAt: getCreatedAtValue(backendUser) || new Date().toISOString(),
    backendSynced: true,
  });
  const completeLogin = async (backendUser = {}, fallbackName = '', fallbackMobile = '') => {
    await AsyncStorage.setItem('backendEnabled', 'true');
    const profile = buildProfileFromBackendUser(backendUser, fallbackName, fallbackMobile);
    await cacheKnownUser(profile.mobile, profile.name);
    if (typeof onLoggedIn !== 'function') {
      Alert.alert('Login Failed', 'Login handler is not configured');
      return;
    }
    await onLoggedIn(profile);
  };

  const cacheKnownUser = async (digits, cachedName) => {
    if (!digits || digits.length != 10 || !cachedName) return;
    try {
      await AsyncStorage.setItem(getPrefillKey(digits), JSON.stringify({
        name: String(cachedName || '').trim(),
        updatedAt: Date.now(),
      }));
    } catch (_) {}
  };

  const clearCachedUser = async (digits) => {
    if (!digits || digits.length != 10) return;
    try {
      await AsyncStorage.removeItem(getPrefillKey(digits));
    } catch (_) {}
  };

  const applyCachedPrefill = async (digits, requestId) => {
    try {
      const raw = await AsyncStorage.getItem(getPrefillKey(digits));
      if (lookupRequestRef.current !== requestId) return;
      if (!raw) {
        setHasCachedPrefill(false);
        hasCachedPrefillRef.current = false;
        return;
      }
      const parsed = JSON.parse(raw);
      const cachedName = String(parsed?.name || '').trim();
      if (!cachedName) {
        setHasCachedPrefill(false);
        hasCachedPrefillRef.current = false;
        return;
      }
      setHasCachedPrefill(true);
      hasCachedPrefillRef.current = true;
      setIsExistingUser(true);
      setIsNewUser(false);
      if (!nameEditedRef.current) {
        setName(cachedName);
      }
    } catch (_) {
      if (lookupRequestRef.current === requestId) {
        setHasCachedPrefill(false);
        hasCachedPrefillRef.current = false;
      }
    }
  };


  const runLookup = async (digits, requestId) => {
    try {
      const result = await apiService.lookupUser(digits, appConfig.appId);
      if (lookupRequestRef.current !== requestId) return;

      if (result.exists && result.user) {
        const resolvedName = String(result.user.name || '').trim();
        await cacheKnownUser(digits, resolvedName);
        setHasCachedPrefill(Boolean(resolvedName));
        hasCachedPrefillRef.current = Boolean(resolvedName);
        if (!nameEditedRef.current || !String(name || '').trim()) {
          setName(resolvedName);
        }
        setIsExistingUser(true);
        setIsNewUser(false);
      } else {
        await clearCachedUser(digits);
        setHasCachedPrefill(false);
        hasCachedPrefillRef.current = false;
        if (!nameEditedRef.current) {
          setName('');
        }
        setIsExistingUser(false);
        setIsNewUser(true);
      }
    } catch (error) {
      if (lookupRequestRef.current !== requestId) return;
      const parsed = apiService.parseApiError ? apiService.parseApiError(error) : null;
      if (!hasCachedPrefillRef.current) {
        setIsExistingUser(false);
        setIsNewUser(true);
      }
      // Lookup should stay non-blocking. Submit handles approval decisions.
      setLookupError(parsed?.isNetwork ? '' : (parsed?.message || ''));
    } finally {
      if (lookupRequestRef.current === requestId) {
        setLookingUp(false);
      }
    }
  };

  // Auto-lookup when user finishes entering 10-digit mobile
  const handleMobileChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);

    if (lookupTimerRef.current) {
      clearTimeout(lookupTimerRef.current);
    }
    lookupRequestRef.current += 1;
    const requestId = lookupRequestRef.current;

    setLookupError('');
    setLookingUp(false);

    if (digits.length < 10) {
      setIsExistingUser(false);
      setIsNewUser(false);
      setHasCachedPrefill(false);
      hasCachedPrefillRef.current = false;
      setName('');
      setNameEdited(false);
      return;
    }

    setNameEdited(false);
    setIsExistingUser(false);
    setIsNewUser(true);
    setHasCachedPrefill(false);
    hasCachedPrefillRef.current = false;
    if (!nameEditedRef.current) {
      setName('');
    }

    if (digits.length >= 8) {
      apiService.warmBackend().catch(() => {});
    }

    setLookingUp(true);
    applyCachedPrefill(digits, requestId);

    lookupTimerRef.current = setTimeout(() => {
      runLookup(digits, requestId);
    }, 40);
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

    if (typeof onLoggedIn !== 'function') {
      Alert.alert('Error', 'Login handler is not configured');
      return;
    }

    setLoading(true);
    try {
      console.log('🔵 Logging in user:', name, mobile);
      const result = await apiService.loginUser(
        name.trim(),
        null,
        mobile.trim(),
        null,
        appConfig.appId
      );
      console.log('🔵 Backend login result:', result);
      const backendUser = result.user || {};

      if ((result.approved === false || result.status === 'pending') && requiresApprovalNow(backendUser)) {
        setPendingState({
          status: result.status || 'pending',
          message: result.message,
          userName: name.trim(),
        });
        return;
      }

      if (result.status === 'rejected') {
        setPendingState({
          status: 'rejected',
          message: result.message,
          userName: name.trim(),
        });
        return;
      }

      await completeLogin(backendUser, name.trim(), mobile.trim());
    } catch (error) {
      console.error('🔴 Login error:', error);
      const parsed = apiService.parseApiError ? apiService.parseApiError(error) : null;
      const backendUser = parsed?.raw?.user || {};
      const hasSessionData = Boolean(parsed?.raw?.token || parsed?.raw?.user || parsed?.raw?.data?.user);

      if ((parsed?.status === 'pending' || parsed?.approved === false) && requiresApprovalNow(backendUser)) {
        setPendingState({
          status: 'pending',
          message: parsed.message,
          userName: name.trim(),
        });
        return;
      }

      if (parsed?.status === 'rejected') {
        setPendingState({
          status: 'rejected',
          message: parsed.message,
          userName: name.trim(),
        });
        return;
      }

      if ((parsed?.status === 'pending' || parsed?.approved === false) && hasSessionData) {
        try {
          if (parsed?.raw?.token) {
            await AsyncStorage.setItem('authToken', parsed.raw.token);
          }
          await completeLogin(backendUser, name.trim(), mobile.trim());
          return;
        } catch (sessionError) {
          console.error('🔴 Session setup error:', sessionError);
          const message = sessionError?.message || 'Session setup failed';
          Alert.alert('Login Failed', message);
          return;
        }
      }

      const title = parsed?.isNetwork ? 'Connection Error' : 'Login Failed';
      const message = parsed?.message || t('connectionError');
      Alert.alert(title, message);
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
        <ScrollView
          contentContainerStyle={styles.pendingContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                  const bu = result.user || {};
                  if ((result.approved === false || result.status === 'pending') && requiresApprovalNow(bu)) {
                    setPendingState({ status: result.status || 'pending', message: result.message, userName: name.trim() });
                  } else {
                    await AsyncStorage.setItem('backendEnabled', 'true');
                    if (typeof onLoggedIn === 'function') {
                      const profile = {
                        _id: bu.id || bu._id || undefined,
                        name: bu.name || name.trim(),
                        mobile: bu.mobile || mobile.trim(),
                        totalCount: bu.totalCount || 0,
                        createdAt: bu.createdAt || new Date().toISOString(),
                        backendSynced: true,
                      };
                      await cacheKnownUser(profile.mobile, profile.name);
                      await onLoggedIn(profile);
                    } else {
                      Alert.alert('Login Failed', 'Login handler is not configured');
                    }
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
        </ScrollView>
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
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.devanagariTitle}>{t('appName')}</Text>
            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
          </View>

          {/* Form — mobile first, name auto-populates for existing users */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('login.mobileLabel')}</Text>
              <TextInput
                testID="login-mobile-input"
                style={styles.input}
                placeholder="1234567890"
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
                  <Text style={styles.lookupText}>{hasCachedPrefill ? `${t('login.checking')}...` : t('login.checking')}</Text>
                </View>
              )}
              {isExistingUser && (
                <Text style={styles.welcomeBackText}>{t('login.welcomeBack').replace('{name}', name || t('login.nameLabel'))}</Text>
              )}
              {lookupError !== '' && (
                <Text style={styles.errorText}>{lookupError}</Text>
              )}
            </View>

            {mobile.length === 10 && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('login.nameLabel')}</Text>
                <TextInput
                  ref={nameRef}
                  testID="login-name-input"
                  style={[styles.input, isExistingUser && styles.inputAutoFilled]}
                  placeholder={isExistingUser ? name : t('login.namePlaceholder')}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={name}
                  onChangeText={handleNameChange}
                  editable={!loading}
                />
                {isExistingUser && !nameManuallyEdited && (
                  <Text style={styles.autoFilledHint}>{hasCachedPrefill && lookingUp ? `${t('login.autoFilled')} · ${t('login.checking')}` : t('login.autoFilled')}</Text>
                )}
              </View>
            )}

            {mobile.length === 10 && (
              <TouchableOpacity
                testID="login-submit-button"
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleContinue}
                disabled={loading}
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
        </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 90,
    paddingBottom: spacing.xl,
  },
  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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
    textAlign: 'center',
  },
  form: {
    width: '100%',
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
    width: '100%',
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
    flexGrow: 1,
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
    textAlign: 'center',
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
    width: '100%',
    alignItems: 'center',
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
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 20,
  },
});













