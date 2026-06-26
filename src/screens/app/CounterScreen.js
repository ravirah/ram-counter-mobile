import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as ReactNative from 'react-native';
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
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import moment from 'moment';
import * as counterService from '../../utils/counterService';
import * as apiService from '../../utils/apiService';
import appConfig from '../../config/appConfig';
import { useLanguage } from '../../context/LanguageContext';

let Voice = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch (error) {
  console.warn('Voice module unavailable:', error?.message || error);
}

const getTimeZoneLabel = () => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions()?.timeZone || 'Asia/Calcutta';
    const parts = new Intl.DateTimeFormat('en-IN', { timeZoneName: 'short' }).formatToParts(new Date());
    const shortName = parts.find((part) => part.type === 'timeZoneName')?.value;
    return shortName && shortName !== zone ? `${shortName} (${zone})` : zone;
  } catch (error) {
    return 'Asia/Calcutta';
  }
};

const TIMEZONE_LABEL = getTimeZoneLabel();
const formatTimeWithZone = (value) => value && moment(value).isValid() ? `${moment(value).format('hh:mm A')} ${TIMEZONE_LABEL}` : '-';
const formatDurationCompact = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '-';
  const whole = Math.floor(total);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

export default function CounterScreen({ onLogout }) {
  const { t, lang } = useLanguage();
  const { height: windowHeight, width: windowWidth, fontScale = 1 } = useWindowDimensions();
  const isVoiceAvailable = Platform.OS !== 'web' && Boolean(Voice);
  const [input, setInput] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [daysActive, setDaysActive] = useState(1);
  const [maxCount, setMaxCount] = useState(0);
  const [dailySummaries, setDailySummaries] = useState([]);
  const initialSlogans = appConfig.quotes.map((item) => ({ hi: item.text, en: item.translation }));
  const [slogans, setSlogans] = useState(initialSlogans);
  const [quote, setQuote] = useState(initialSlogans[0] || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputError, setInputError] = useState('');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'error'
  const [userName, setUserName] = useState('');
  const [cursorPos, setCursorPos] = useState({ start: 0, end: 0 });
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const inputRef = useRef(null);
  const validateTimer = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const countFadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const todayCountRef = useRef(0);
  const maxCountRef = useRef(0);
  const voiceCommitTimer = useRef(null);
  // Reload count data every time the tab is focused (real-time data)
  useFocusEffect(
    useCallback(() => {
      const hydrateScreen = async () => {
        await checkDailyReset();
        // Push any counts that failed to sync earlier so the backend total is
        // up to date before we read it back below.
        await counterService.flushPendingSync();
        await loadCountData();
        await loadSlogans();
      };

      hydrateScreen();
      // Load user name for header
      AsyncStorage.getItem('localUser').then(raw => {
        if (raw) {
          try { setUserName(JSON.parse(raw).name || ''); } catch (_) {}
        }
      });
    }, [])
  );

  // Realtime: re-pull live data when the app returns to the foreground (useFocusEffect
  // only fires on tab navigation, not on app resume from background).
  useEffect(() => {
    const sub = ReactNative.AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkDailyReset()
          .then(() => counterService.flushPendingSync())
          .then(() => loadCountData())
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    todayCountRef.current = todayCount;
  }, [todayCount]);

  useEffect(() => {
    maxCountRef.current = maxCount;
  }, [maxCount]);


  function applyVoiceInput(text) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;

    if (validateTimer.current) clearTimeout(validateTimer.current);
    if (voiceCommitTimer.current) clearTimeout(voiceCommitTimer.current);

    setInput(normalizedText);
    setCursorPos({ start: normalizedText.length, end: normalizedText.length });
    setInputError('');
    setVoiceTranscript(normalizedText);
    setVoiceStatus('processing');

    // Keep recognized text visible briefly before validating/counting.
    voiceCommitTimer.current = setTimeout(() => {
      validateAndCountInput(normalizedText);
    }, 900);

  }

  const handleAddRam = useCallback((count = 1) => {
    if (!count || count < 1) return;

    // 1. Optimistic counter updates — instant (use refs to avoid stale closure in voice callbacks)
    const newCount = todayCountRef.current + count;
    todayCountRef.current = newCount;
    setTodayCount(newCount);
    setTotalCount(prev => prev + count);
    if (newCount > maxCountRef.current) {
      maxCountRef.current = newCount;
      setMaxCount(newCount);
    }

    // 2. Clear input + reset cursor + restore focus after IME settles
    setTimeout(() => {
      setInput('');
      setCursorPos({ start: 0, end: 0 });
      setVoiceTranscript('');
      setVoiceStatus('idle');
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
        { text: 'OK' }
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
  }, [scaleAnim]);

  const validateAndCountInput = useCallback((text) => {
    const count = counterService.validateRamInput(text);
    if (count > 0) {
      setInputError('');
      handleAddRam(count);
    } else if (String(text || '').trim().length >= 2) {
      setInputError(`Please type "${appConfig.mantraWord}" or "${appConfig.mantraWordEnglish}"`);
    } else {
      setInputError('');
    }
  }, [handleAddRam]);

  useEffect(() => {
    if (!isVoiceAvailable) return;

    const onSpeechStart = () => {
      setIsListening(true);
      setVoiceStatus('listening');
    };
    const onSpeechEnd = () => {
      setIsListening(false);
      stopPulse();
      setVoiceStatus((current) => (current === 'processing' ? current : 'idle'));
    };
    const onSpeechResults = (e) => {
      const text = e.value?.[0] || '';
      applyVoiceInput(text);
      setTimeout(() => {
        setVoiceTranscript('');
      }, 1500);
    };
    const onSpeechPartialResults = (e) => {
      const text = e.value?.[0] || '';
      setVoiceTranscript(text);
    };
    const onSpeechError = (e) => {
      console.warn('Voice error:', e.error);
      setIsListening(false);
      stopPulse();
      setVoiceStatus('idle');
      // Don't show error for "no match" — user just didn't say anything
      if (e.error?.code !== '7' && e.error?.code !== 7) {
        setVoiceTranscript('');
      }
    };

    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
    Voice.onSpeechError = onSpeechError;

    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, [isVoiceAvailable]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  };
  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {      const permissionsApi = ReactNative.PermissionsAndroid;
      if (!permissionsApi) return true;

      const granted = await permissionsApi.request(
        permissionsApi.PERMISSIONS.RECORD_AUDIO,
        { title: 'Microphone Permission', message: 'App needs mic access for voice chanting', buttonPositive: 'Allow' }
      );
      return granted === permissionsApi.RESULTS.GRANTED;
    }
    return true;
  };

  const toggleVoice = async () => {
    if (!isVoiceAvailable) {
      Alert.alert('Voice unavailable', 'Voice chanting is not available in this build on this device.');
      return;
    }

    Keyboard.dismiss();

    if (isListening) {
      try {
        await Voice.stop();
      } catch (error) {
        console.warn('Voice stop failed:', error?.message || error);
      } finally {
        setIsListening(false);
        stopPulse();
        setVoiceStatus('idle');
      }
      return;
    }

    const granted = await requestMicPermission();
    if (!granted) {
      Alert.alert('Microphone permission', 'Please allow microphone access to use voice chanting.');
      return;
    }

    try {
      setVoiceTranscript('');
      setInputError('');
      setVoiceStatus('listening');
      startPulse();
      await Voice.start(lang === 'hi' ? 'hi-IN' : 'en-IN');
    } catch (error) {
      console.warn('Voice start failed:', error?.message || error);
      setIsListening(false);
      stopPulse();
      setVoiceStatus('idle');
      Alert.alert('Voice error', 'Unable to start voice chanting on this device right now.');
    }
  };

  useEffect(() => {
    selectRandomQuote();
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
      if (voiceCommitTimer.current) clearTimeout(voiceCommitTimer.current);
    };
  }, [slogans]);

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
      validateAndCountInput(text);
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
    try {
      return await counterService.checkDailyReset();
    } catch (error) {
      console.error('Daily reset check error:', error);
      return false;
    }
  };

  const loadCountData = async () => {
    setSyncStatus('syncing');
    // Single source of truth — backend only (same getDisplayStats every screen uses), so
    // Counter / Stats / Profile always show identical, backend-matching numbers.
    const d = await counterService.getDisplayStats();
    if (!d.ok) {
      // Offline / backend unreachable: do NOT overwrite with a locally-computed total
      // (that's what made screens disagree). Keep the current optimistic values and just
      // flag the sync state. The optimistic per-tap count stays visible and reconciles
      // to the backend on the next successful load.
      setSyncStatus('error');
      return;
    }
    const summaries = (d.history || []).map((h) => ({
      date: h.date,
      dailyCount: h.count || 0,
      firstCountAt: h.firstCountAt,
      lastCountAt: h.lastCountAt,
      activeDurationSeconds: h.activeDurationSeconds,
    }));
    setDailySummaries(summaries);
    setTodayCount(d.today);
    setTotalCount(d.total);
    setDaysActive(d.daysActive);
    setMaxCount(d.best);
    setSyncStatus('synced');
  };

  const loadSlogans = async () => {
    try {
      const response = await apiService.getSlogans(appConfig.appId);
      const nextSlogans = response?.slogans || [];
      setSlogans(nextSlogans);
      setQuote(nextSlogans[0] || null);
    } catch (error) {
      console.error('Load slogans error:', error);
      setSlogans(initialSlogans);
      setQuote(initialSlogans[0] || null);
    }
  };

  const selectRandomQuote = (items = slogans) => {
    if (!items || items.length === 0) {
      setQuote(null);
      return;
    }
    const randomQuote = items[Math.floor(Math.random() * items.length)];
    setQuote(randomQuote);
  };


  const handleClearInput = () => {
    setInput('');
    setInputError('');
    setVoiceTranscript('');
    setVoiceStatus('idle');
    if (validateTimer.current) {
      clearTimeout(validateTimer.current);
    }
    if (voiceCommitTimer.current) {
      clearTimeout(voiceCommitTimer.current);
    }
  };

  const handlePadInsert = (value) => {
    handleChangeText(`${input}${value}`);
  };

  const handlePadBackspace = () => {
    handleChangeText(input.slice(0, -1));
  };

  const isCompactScreen = windowHeight < 820;
  const isVeryCompactScreen = windowHeight < 720;
  const isNarrowScreen = windowWidth < 360;
  const isLargeFont = fontScale >= 1.2;
  const counterPanelWidth = Math.max(
    isVeryCompactScreen ? 200 : 224,
    Math.min(windowWidth - (Platform.OS === 'web' ? 190 : 52), isNarrowScreen ? 268 : 320)
  );
  const counterPanelHeight = Math.round((isVeryCompactScreen ? 118 : isCompactScreen ? 132 : 150) * (isLargeFont ? 1.18 : 1));
  const counterNumberBase = counterPanelWidth >= 300 ? 68 : counterPanelWidth >= 260 ? 58 : 50;
  const counterNumberSize = Math.round(counterNumberBase / Math.min(Math.max(fontScale, 1), 1.35));
  const letterButtonSize = isVeryCompactScreen ? 46 : isCompactScreen ? 50 : 56;
  const todayTiming = useMemo(() => {
    const todayKey = moment().format('YYYY-MM-DD');
    return dailySummaries.find((row) => row.date === todayKey) || null;
  }, [dailySummaries]);

  return (
    <LinearGradient
      colors={['#FFF8F0', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <SafeKeyboardView style={styles.keyboardAvoid}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isCompactScreen && styles.scrollContentCompact,
            isVeryCompactScreen && styles.scrollContentVeryCompact,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Screen Header */}
          <View style={styles.screenHeader}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.appBadge}>{t('appName')}</Text>
              {userName !== '' && (
                <Text style={styles.userGreeting}>{t('namaste')}, {userName} 🙏</Text>
              )}
            </View>
            <TouchableOpacity onPress={onLogout} style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={22} color={colors.error || '#D32F2F'} />
            </TouchableOpacity>
          </View>

          {/* Sync Error Banner (non-blocking) */}
          {syncStatus === 'error' && (
            <TouchableOpacity style={styles.syncBanner} onPress={loadCountData}>
              <Text style={styles.syncBannerText}>Unable to sync. Tap to retry.</Text>
            </TouchableOpacity>
          )}

                    {/* Counter Display */}
          <View style={[styles.counterSection, isCompactScreen && styles.counterSectionCompact]}>
            <Text style={[styles.counterLabel, isCompactScreen && styles.counterLabelCompact]}>{t('counter.todayLabel')}</Text>
            <Animated.View
              style={[
                styles.counterPanelWrapper,
                {
                  width: counterPanelWidth,
                  minHeight: counterPanelHeight,

                },
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <View
                style={[
                  styles.counterPanel,
                  {
                    width: counterPanelWidth - 8,
                    minHeight: counterPanelHeight - 8,

                  },
                ]}
              >
                <Animated.Text style={[styles.counterNumber, isCompactScreen && styles.counterNumberCompact, { fontSize: counterNumberSize, opacity: countFadeAnim }]}>
                  {todayCount}
                </Animated.Text>
              </View>
            </Animated.View>
            <Text style={[styles.counterSubtext, isCompactScreen && styles.counterSubtextCompact]}>
              {appConfig.mantraWord} {todayCount === 1 ? t('counter.chant') : t('counter.chants')} {t('counter.statsToday').toLowerCase()}
            </Text>
          </View>

          {/* Input Section */}
          <View style={[styles.inputSection, isCompactScreen && styles.inputSectionCompact]}>
            {(isListening || voiceTranscript !== '') && (
              <View style={styles.voiceOverlay}>
                <Text style={styles.voiceStatusText}>
                  {voiceStatus === 'listening'
                    ? `🔴 ${t('counter.listeningHint').replace('{mantra}', appConfig.mantraWord)}`
                    : `🎙️ ${t('counter.heard')}:`}
                </Text>
                {voiceTranscript !== '' && (
                  <Text style={styles.voiceTranscript}>"{voiceTranscript}"</Text>
                )}
              </View>
            )}
            <View style={styles.inputRow}>
              <View style={[styles.inputWrapper, styles.inputWrapperExpanded]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, isCompactScreen && styles.inputCompact, Platform.OS === 'android' && !input && styles.inputEmptyAndroid]}
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
                  autoFocus={false}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  caretHidden={false}
                  selectionColor={appConfig.colors.primary}
                  underlineColorAndroid="transparent"
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
              {isVoiceAvailable && (
                <TouchableOpacity
                  style={[styles.micButton, isCompactScreen && styles.micButtonCompact, isListening && styles.micButtonActive]}
                  onPress={toggleVoice}
                  activeOpacity={0.7}
                >
                  <Animated.View style={[styles.micButtonInner, isCompactScreen && styles.micButtonInnerCompact]}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <Ionicons
                        name={isListening ? 'mic' : 'mic-outline'}
                        size={26}
                        color={isListening ? '#E53935' : appConfig.colors.primary}
                      />
                    </Animated.View>
                    <Text style={[styles.micButtonLabel, isCompactScreen && styles.micButtonLabelCompact, isListening && styles.micButtonLabelActive]}>
                      {isListening ? 'Stop' : 'Mic'}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.letterPad, isCompactScreen && styles.letterPadCompact]}>
              <View style={[styles.letterPadRow, isCompactScreen && styles.letterPadRowCompact]}>
                {[{ label: 'R', value: 'r' }, { label: 'A', value: 'a' }, { label: 'M', value: 'm' }].map((letter) => (
                  <TouchableOpacity
                    key={letter.value}
                    style={[styles.letterButton, { width: letterButtonSize, height: letterButtonSize }]}
                    onPress={() => handlePadInsert(letter.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.letterButtonText, isCompactScreen && styles.letterButtonTextCompact]}>{letter.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.letterButton, styles.letterButtonAlt, { width: letterButtonSize, height: letterButtonSize }]}
                  onPress={handlePadBackspace}
                  activeOpacity={0.8}
                >
                  <Text style={styles.letterButtonAltText}>⌫</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.letterPadRow, isCompactScreen && styles.letterPadRowCompact]}>
                {['र', 'ा', 'म'].map((letter) => (
                  <TouchableOpacity
                    key={letter}
                    style={[styles.letterButton, styles.letterButtonHindi, { width: letterButtonSize, height: letterButtonSize }]}
                    onPress={() => handlePadInsert(letter)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.letterButtonText, styles.letterButtonTextHindi, isCompactScreen && styles.letterButtonTextHindiCompact]}>{letter}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {!isCompactScreen && (
              <Text style={styles.inputHint}>
                {t('counter.inputHint').replace('{mantra}', appConfig.mantraWord).replace('{mantraEn}', appConfig.mantraWordEnglish)}
                {isVoiceAvailable ? t('counter.inputHintVoice') : ''}
              </Text>
            )}
            {appConfig.features.showQuotes && (
              <LinearGradient
                colors={[appConfig.colors.primary, '#E07B20']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.quoteCard, isCompactScreen && styles.quoteCardCompact, isVeryCompactScreen && styles.quoteCardVeryCompact, styles.quoteCardBelowPad]}
              >
                <Text style={styles.quoteIcon}>💬</Text>
                <Text style={[styles.quoteText, isCompactScreen && styles.quoteTextCompact]}>
                  {quote ? quote[lang] : ''}
                </Text>
                <Text style={[styles.quoteTranslation, isCompactScreen && styles.quoteTranslationCompact]}>
                  {quote ? (lang === 'hi' ? quote.en : quote.hi) : ''}
                </Text>
              </LinearGradient>
            )}
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
            <>
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
              <View style={styles.timingCard}>
                <Text style={styles.timingCardTitle}>{t('counter.todayTiming')}</Text>
                <Text style={styles.timingCardMeta}>{t('counter.allTimes')}: {TIMEZONE_LABEL}</Text>
                <View style={styles.timingGrid}>
                  <View style={styles.timingCell}>
                    <Text style={styles.timingLabel}>{t('counter.dayStart')}</Text>
                    <Text style={styles.timingValue}>{formatTimeWithZone(todayTiming?.firstCountAt)}</Text>
                  </View>
                  <View style={styles.timingCell}>
                    <Text style={styles.timingLabel}>{t('counter.dayEnd')}</Text>
                    <Text style={styles.timingValue}>{formatTimeWithZone(todayTiming?.lastCountAt)}</Text>
                  </View>
                </View>
                <View style={styles.timingFooterRow}>
                  <Text style={styles.timingFooterText}>{t('counter.dayDuration')}: {formatDurationCompact(todayTiming?.activeDurationSeconds)}</Text>
                  <Text style={styles.timingFooterText}>{t('counter.statsToday')}: {todayCount}</Text>
                </View>
              </View>
            </>
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
    paddingBottom: 108,
  },
  scrollContentCompact: {
    paddingTop: 34,
    paddingBottom: 88,
  },
  scrollContentVeryCompact: {
    paddingHorizontal: spacing.md,
    paddingTop: 24,
    paddingBottom: 84,
  },

  // Screen header
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  logoutIcon: {
    padding: 8,
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
    marginTop: 2,
    flexShrink: 1,
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
    textAlign: 'center',
  },

  // Quote card
  quoteCard: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'stretch',
    minHeight: 108,
    ...shadowStyles.medium,
  },
  quoteCardCompact: {
    minHeight: 74,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  quoteCardVeryCompact: {
    minHeight: 64,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  quoteCardBelowPad: {
    marginTop: spacing.sm,
  },
  quoteIcon: {
    fontSize: 18,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
    flexShrink: 1,
  },
  quoteTranslation: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.92)',
    fontStyle: 'italic',
    textAlign: 'center',
    flexShrink: 1,
  },

  // Counter
  counterSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  counterSectionCompact: {
    marginTop: 0,
    marginBottom: spacing.xs,
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightGray,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  counterLabelCompact: {
    marginBottom: spacing.xs,
    fontSize: 10,
  },
  counterPanelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowStyles.glow,
  },
  counterPanel: {
    backgroundColor: appConfig.colors.primary,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  counterNumber: {
    fontSize: 72,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
  },
  counterNumberCompact: {
    letterSpacing: -1,
  },
  counterSubtext: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  counterSubtextCompact: {
    marginTop: spacing.sm,
    fontSize: 13,
  },

  // Input
  inputSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
    width: '100%',
    paddingTop: 56,
    position: 'relative',
  },
  inputSectionCompact: {
    marginTop: 4,
    paddingTop: 38,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWrapperExpanded: {
    flex: 1,
    minWidth: 220,
  },
  micButton: {
    minWidth: 72,
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    marginTop: 0,
    borderWidth: 2,
    borderColor: appConfig.colors.primary,
    ...shadowStyles.light,
  },
  micButtonCompact: {
    minWidth: 60,
    minHeight: 56,
    borderRadius: 16,
  },
  micButtonActive: {
    backgroundColor: '#FFF0E0',
    borderColor: '#E53935',
  },
  micButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  micButtonInnerCompact: {
    gap: 0,
  },
  micButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: appConfig.colors.primary,
  },
  micButtonLabelCompact: {
    fontSize: 10,
  },
  micButtonLabelActive: {
    color: '#E53935',
  },
  micIcon: {
    fontSize: 22,
  },
  voiceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignSelf: 'stretch',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFD2A8',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadowStyles.light,
    zIndex: 2,
  },
  voiceStatus: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  voiceStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E53935',
    textAlign: 'center',
  },
  voiceTranscript: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
    borderWidth: 2,
    borderColor: appConfig.colors.primary,
    fontSize: 24,
    fontWeight: '600',
    color: appConfig.colors.primary,
    ...Platform.select({
      web: { textAlign: 'left' },
      android: { textAlign: 'left', textAlignVertical: 'center' },
      default: { textAlign: 'center' },
    }),
    ...shadowStyles.light,
  },
  inputCompact: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: 20,
  },
  inputEmptyAndroid: {
    textAlign: 'left',
  },
  clearButton: {
    position: 'absolute',
    right: 14,
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
  letterPad: {
    marginTop: spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  letterPadCompact: {
    marginTop: 6,
  },
  letterPadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  letterPadRowCompact: {
    marginBottom: 4,
  },
  letterButton: {
    width: 60,
    height: 60,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: appConfig.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowStyles.light,
  },
  letterButtonAlt: {
    backgroundColor: '#FFF4E8',
  },
  letterButtonHindi: {
    width: 60,
  },
  letterButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: appConfig.colors.primary,
    textTransform: 'none',
  },
  letterButtonTextCompact: {
    fontSize: 24,
  },
  letterButtonAltText: {
    fontSize: 18,
    fontWeight: '700',
    color: appConfig.colors.primary,
  },
  letterButtonAltTextCompact: {
    fontSize: 16,
  },
  letterButtonTextHindi: {
    fontSize: 30,
    textTransform: 'none',
  },
  letterButtonTextHindiCompact: {
    fontSize: 26,
  },
  inputHint: {
    fontSize: 12,
    color: colors.lightGray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  quoteTextCompact: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  quoteTranslationCompact: {
    fontSize: 12,
    lineHeight: 18,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  statPill: {
    width: '48%',
    minWidth: 148,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadowStyles.light,
  },
  statPillEmoji: {
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  statPillValue: {
    fontSize: 22,
    fontWeight: '800',
    color: appConfig.colors.primary,
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.lightGray,
    letterSpacing: 0.3,
    marginTop: 2,
    textAlign: 'center',
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
  timingCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: 2,
    marginBottom: spacing.sm,
    ...shadowStyles.light,
  },
  timingCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.darkGray,
  },
  timingCardMeta: {
    fontSize: 11,
    color: colors.lightGray,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  timingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timingCell: {
    flex: 1,
    minWidth: 132,
    backgroundColor: '#FFF8F0',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  timingLabel: {
    fontSize: 11,
    color: colors.lightGray,
    fontWeight: '600',
  },
  timingValue: {
    fontSize: 13,
    color: colors.darkGray,
    fontWeight: '700',
    marginTop: 4,
    flexShrink: 1,
  },
  timingFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  timingFooterText: {
    fontSize: 12,
    color: appConfig.colors.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  timingEmptyText: {
    fontSize: 13,
    color: colors.lightGray,
    fontWeight: '600',
    marginTop: spacing.xs,
  },

  // Motivation
  motivationBox: {
    backgroundColor: 'rgba(255, 153, 51, 0.08)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  motivationText: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
});




























































