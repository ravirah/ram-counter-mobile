import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import moment from 'moment';
import * as counterService from '../../utils/counterService';
import * as apiService from '../../utils/apiService';
import appConfig from '../../config/appConfig';
// Speech recognition — uses platform-specific files (speechService.web.js returns stubs)
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from '../../utils/speechService';
import { useLanguage } from '../../context/LanguageContext';

export default function CounterScreen() {
  const { t, lang } = useLanguage();
  const [input, setInput] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [daysActive, setDaysActive] = useState(1);
  const [maxCount, setMaxCount] = useState(0);
  const [quote, setQuote] = useState(appConfig.quotes[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputError, setInputError] = useState('');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'error'
  const [userName, setUserName] = useState('');
  const [cursorPos, setCursorPos] = useState({ start: 0, end: 0 });
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const inputRef = useRef(null);
  const validateTimer = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const countFadeAnim = useRef(new Animated.Value(1)).current;
  const micPulseAnim = useRef(new Animated.Value(1)).current;
  const speechListenersRef = useRef([]);

  // Reload count data every time the tab is focused (real-time data)
  useFocusEffect(
    useCallback(() => {
      loadCountData();
      checkDailyReset();
      // Load user name for header
      AsyncStorage.getItem('localUser').then(raw => {
        if (raw) {
          try { setUserName(JSON.parse(raw).name || ''); } catch (_) {}
        }
      });
    }, [])
  );

  // Voice recognition events
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    micPulseAnim.stopAnimation();
    Animated.timing(micPulseAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start();
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript || '';
    setVoiceText(transcript);
    // Check every partial/final result for mantra matches
    const count = counterService.validateRamInput(transcript);
    if (count > 0) {
      handleAddRam(count);
      setVoiceText('');
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech error:', event.error);
    setIsListening(false);
  });

  const toggleVoice = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Voice not supported', 'Voice input is not available on this device.');
      return;
    }
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert('Voice unavailable', 'Speech recognition is not available in this build.');
      return;
    }
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    speechListenersRef.current.forEach((s) => {
      try { s?.remove?.(); } catch (_) {}
    });
    speechListenersRef.current = [];
    try {
      speechListenersRef.current.push(ExpoSpeechRecognitionModule.addListener('start', () => setIsListening(true)));
      speechListenersRef.current.push(ExpoSpeechRecognitionModule.addListener('end', () => {
        setIsListening(false);
        micPulseAnim.stopAnimation();
        Animated.timing(micPulseAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start();
      }));
      speechListenersRef.current.push(ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = event?.results?.[0]?.transcript || '';
        setVoiceText(transcript);
        const count = counterService.validateRamInput(transcript);
        if (count > 0) {
          handleAddRam(count);
          setVoiceText('');
        }
      }));
      speechListenersRef.current.push(ExpoSpeechRecognitionModule.addListener('error', (event) => {
        console.warn('Speech error:', event?.error);
        setIsListening(false);
      }));
    } catch (_) {}

    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert('Permission needed', 'Please allow microphone access to use voice chanting.');
      return;
    }
    // Start continuous listening in selected language
    ExpoSpeechRecognitionModule.start({
      lang: lang === 'hi' ? 'hi-IN' : 'en-IN',
      interimResults: true,
      continuous: true,
    });
    // Pulse animation for mic
    Animated.loop(
      Animated.sequence([
        Animated.timing(micPulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(micPulseAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  };

  useEffect(() => {
    selectRandomQuote();
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
      // Stop listening on unmount
      if (isListening && ExpoSpeechRecognitionModule) ExpoSpeechRecognitionModule.stop();
      speechListenersRef.current.forEach((s) => {
        try { s?.remove?.(); } catch (_) {}
      });
      speechListenersRef.current = [];
    };
  }, []);

  // Handle text changes — debounce to let IME finish composing Devanagari
  const handleChangeText = (text) => {
    setInput(text);
    // Track cursor at end of new text
    setCursorPos({ start: text.length, end: text.length });

    // Clear any pending validation
    if (validateTimer.current) {
      clearTimeout(validateTimer.current);
    }

    if (!text) {
      setInputError('');
      return;
    }

    // Short delay lets the IME commit the composed character before we validate/clear
    validateTimer.current = setTimeout(() => {
      const count = counterService.validateRamInput(text);
      if (count > 0) {
        setInputError('');
        handleAddRam(count);
      } else if (text.trim().length >= 2) {
        setInputError(`Please type "${appConfig.mantraWord}" or "${appConfig.mantraWordEnglish}"`);
      } else {
        setInputError('');
      }
    }, 150);
  };

  // Count fade animation on todayCount change
  useEffect(() => {
    if (todayCount === 0) return;
    Animated.sequence([
      Animated.timing(countFadeAnim, {
        toValue: 0.3,
        duration: 60,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(countFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [todayCount]);

  const checkDailyReset = async () => {
    const hasReset = await counterService.checkDailyReset();
    if (hasReset) {
      setTodayCount(0);
    } else {
      const localCount = await counterService.getLocalCount();
      setTodayCount(localCount);
    }
  };

  const loadCountData = async () => {
    try {
      setSyncStatus('syncing');
      const today = moment().format('YYYY-MM-DD');
      const [profileRes, summaryRes] = await Promise.all([
        apiService.getUserProfile(),
        apiService.getDailySummary(30),
      ]);
      const totalCount = profileRes?.user?.totalCount || 0;
      const summaries = summaryRes?.summaries || [];
      const todaySummary = summaries.find(s => s.date === today);
      const todayCount = todaySummary?.dailyCount || 0;
      const activeDays = summaries.filter(s => (s.dailyCount || 0) > 0).length || 1;
      const bestDay = summaries.length > 0 ? Math.max(...summaries.map(s => s.dailyCount || 0)) : 0;
      setTodayCount(todayCount);
      setTotalCount(totalCount);
      setDaysActive(activeDays);
      setMaxCount(bestDay);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Load count error:', error);
      setSyncStatus('error');
      // Keep existing state — don't blank the screen
    }
  };

  const selectRandomQuote = () => {
    const randomQuote = appConfig.quotes[
      Math.floor(Math.random() * appConfig.quotes.length)
    ];
    setQuote(randomQuote);
  };

  const handleAddRam = (count = 1) => {
    // 1. Optimistic counter updates — instant
    const newCount = todayCount + count;
    setTodayCount(newCount);
    setTotalCount(prev => prev + count);
    if (newCount > maxCount) setMaxCount(newCount);

    // 2. Clear input + reset cursor + restore focus after IME settles
    setTimeout(() => {
      setInput('');
      setCursorPos({ start: 0, end: 0 });
      inputRef.current?.focus();
    }, 50);

    // 3. Scale + bounce animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.14,
        useNativeDriver: Platform.OS !== 'web',
        tension: 120,
        friction: 5,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
        tension: 120,
        friction: 5,
      }),
    ]).start();

    // 4. Milestone celebration
    if (appConfig.features.showMilestones && newCount % appConfig.counter.milestoneInterval === 0) {
      const message = appConfig.text.counterScreen.milestoneMessage
        .replace('{count}', newCount)
        .replace('{mantra}', appConfig.mantraWord);
      const title = appConfig.text.counterScreen.milestoneTitle
        .replace('{emoji}', appConfig.counter.milestoneEmoji);
      Alert.alert(title, message, [
        { text: 'OK', onPress: () => inputRef.current?.focus() }
      ]);
    }

    // 5. Fire-and-forget async persistence
    (async () => {
      try {
        setIsProcessing(true);
        await counterService.addCount(count);
        setSyncStatus('synced');
      } catch (error) {
        console.warn('Background sync failed:', error.message);
        setSyncStatus('error');
      } finally {
        setIsProcessing(false);
      }
    })();
  };

  const handleClearInput = () => {
    setInput('');
  };

  return (
    <LinearGradient
      colors={['#FFF8F0', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <SafeKeyboardView style={styles.keyboardAvoid}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Screen Header */}
          <View style={styles.screenHeader}>
            <Text style={styles.appBadge}>🕉️  {appConfig.appName}</Text>
            {userName !== '' && (
              <Text style={styles.userGreeting}>{t('namaste')}, {userName} 🙏</Text>
            )}
          </View>

          {/* Sync Error Banner (non-blocking) */}
          {syncStatus === 'error' && (
            <TouchableOpacity style={styles.syncBanner} onPress={loadCountData}>
              <Text style={styles.syncBannerText}>Unable to sync. Tap to retry.</Text>
            </TouchableOpacity>
          )}

          {/* Daily Quote */}
          {appConfig.features.showQuotes && (
            <LinearGradient
              colors={[appConfig.colors.primary, '#E07B20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quoteCard}
            >
              <Text style={styles.quoteIcon}>💬</Text>
              <Text style={styles.quoteText}>{quote.text}</Text>
              <Text style={styles.quoteTranslation}>{quote.translation}</Text>
            </LinearGradient>
          )}

          {/* Counter Display */}
          <View style={styles.counterSection}>
            <Text style={styles.counterLabel}>{t('counter.todayLabel')}</Text>
            <Animated.View
              style={[
                styles.counterOrbWrapper,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <View style={styles.counterOrb}>
                <Animated.Text style={[styles.counterNumber, { opacity: countFadeAnim }]}>
                  {todayCount}
                </Animated.Text>
              </View>
            </Animated.View>
            <Text style={styles.counterSubtext}>
              {appConfig.mantraWord} {todayCount === 1 ? t('counter.chant') : t('counter.chants')} {t('counter.statsToday').toLowerCase()}
            </Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputRow}>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, Platform.OS === 'android' && !input && styles.inputEmptyAndroid]}
                  placeholder={appConfig.text.counterScreen.inputPlaceholder.replace('{mantra}', appConfig.mantraWord)}
                  placeholderTextColor={colors.lightGray}
                  value={input}
                  onChangeText={handleChangeText}
                  onSelectionChange={(e) => setCursorPos(e.nativeEvent.selection)}
                  selection={Platform.OS === 'android' ? cursorPos : undefined}
                  maxLength={20}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  autoFocus={true}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  caretHidden={false}
                  selectionColor={appConfig.colors.primary}
                  underlineColorAndroid="transparent"
                  onSubmitEditing={() => inputRef.current?.focus()}
                />
                {input.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearInput}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  style={[styles.micButton, isListening && styles.micButtonActive]}
                  onPress={toggleVoice}
                  activeOpacity={0.7}
                >
                  <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
                    <Text style={styles.micIcon}>{isListening ? '🔴' : '🎤'}</Text>
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>
            {isListening && (
              <View style={styles.voiceStatus}>
                <Text style={styles.voiceStatusText}>
                  🎧 {t('counter.listeningHint').replace('{mantra}', appConfig.mantraWord)}
                </Text>
                {voiceText !== '' && (
                  <Text style={styles.voiceTranscript}>{t('counter.heard')}: "{voiceText}"</Text>
                )}
              </View>
            )}
            <Text style={styles.inputHint}>
              {t('counter.inputHint').replace('{mantra}', appConfig.mantraWord).replace('{mantraEn}', appConfig.mantraWordEnglish)}
              {Platform.OS !== 'web' ? t('counter.inputHintVoice') : ''}
            </Text>
            {inputError !== '' && (
              <Text style={styles.inputError}>{inputError}</Text>
            )}
            {isProcessing && (
              <View style={styles.syncingRow}>
                <ActivityIndicator size="small" color={appConfig.colors.primary} />
                <Text style={styles.syncingText}>{t('counter.syncing')}</Text>
              </View>
            )}
          </View>

          {/* Stats Row */}
          {appConfig.features.showStats && (
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillEmoji}>🔥</Text>
                <Text style={styles.statPillValue}>{todayCount}</Text>
                <Text style={styles.statPillLabel}>{t('counter.statsToday')}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillEmoji}>📊</Text>
                <Text style={styles.statPillValue}>{totalCount}</Text>
                <Text style={styles.statPillLabel}>{t('counter.statsTotal')}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillEmoji}>📈</Text>
                <Text style={styles.statPillValue}>
                  {totalCount > 0 ? (totalCount / daysActive).toFixed(0) : '0'}
                </Text>
                <Text style={styles.statPillLabel}>{t('counter.statsAvg')}</Text>
              </View>
              <View style={[styles.statPill, styles.statPillBest]}>
                <Text style={styles.statPillEmoji}>👑</Text>
                <Text style={[styles.statPillValue, styles.statPillValueBest]}>{maxCount}</Text>
                <Text style={[styles.statPillLabel, styles.statPillLabelBest]}>{t('counter.statsBest')}</Text>
              </View>
            </View>
          )}

          {/* Motivational Message */}
          {appConfig.features.showMotivation && (
            <View style={styles.motivationBox}>
              <Text style={styles.motivationText}>
                🙏 {t('counter.motivationMessage').replace('{mantra}', appConfig.mantraWord)}
              </Text>
            </View>
          )}
        </ScrollView>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.xl,
  },

  // Screen header
  screenHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appBadge: {
    fontSize: 15,
    fontWeight: '700',
    color: appConfig.colors.primary,
  },
  userGreeting: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray,
    marginTop: 4,
  },

  // Sync banner
  syncBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  syncBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
  },

  // Quote card
  quoteCard: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadowStyles.medium,
  },
  quoteIcon: {
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  quoteText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  quoteTranslation: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Counter
  counterSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightGray,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  counterOrbWrapper: {
    width: 184,
    height: 184,
    borderRadius: 92,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowStyles.glow,
  },
  counterOrb: {
    width: 174,
    height: 174,
    borderRadius: 87,
    backgroundColor: appConfig.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterNumber: {
    fontSize: 72,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -2,
  },
  counterSubtext: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
    marginTop: spacing.md,
  },

  // Input
  inputSection: {
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
  },
  micButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    borderWidth: 2,
    borderColor: appConfig.colors.primary,
    ...shadowStyles.light,
  },
  micButtonActive: {
    backgroundColor: '#FFF0E0',
    borderColor: '#E53935',
  },
  micIcon: {
    fontSize: 22,
  },
  voiceStatus: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  voiceStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E53935',
  },
  voiceTranscript: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: appConfig.colors.primary,
    fontSize: 26,
    fontWeight: '600',
    color: appConfig.colors.primary,
    ...Platform.select({
      web: { textAlign: 'left' },
      android: { textAlign: 'left', textAlignVertical: 'center' },
      default: { textAlign: 'center' },
    }),
    ...shadowStyles.light,
  },
  inputEmptyAndroid: {
    textAlign: 'left',
  },
  clearButton: {
    position: 'absolute',
    right: 18,
    top: 0,
    bottom: 0,
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.lightGray,
    fontWeight: '700',
  },
  inputHint: {
    fontSize: 13,
    color: colors.lightGray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  inputError: {
    fontSize: 12,
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  syncingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  syncingText: {
    fontSize: 12,
    color: appConfig.colors.primary,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    marginVertical: spacing.md,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    ...shadowStyles.light,
  },
  statPillEmoji: {
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  statPillValue: {
    fontSize: 24,
    fontWeight: '800',
    color: appConfig.colors.primary,
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightGray,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  // Best Day pill — highlighted in gold
  statPillBest: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFB300',
  },
  statPillValueBest: {
    color: '#E65100',
  },
  statPillLabelBest: {
    color: '#F57C00',
    fontWeight: '700',
  },

  // Motivation
  motivationBox: {
    backgroundColor: 'rgba(255, 153, 51, 0.08)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  motivationText: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
});



