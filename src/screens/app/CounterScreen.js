import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import { colors, spacing, borderRadius, shadowStyles, motivationalQuotes, gradients } from '../../config/theme';
import * as counterService from '../../utils/counterService';

export default function CounterScreen() {
  const [input, setInput] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [daysActive, setDaysActive] = useState(1); // Track days active for average calculation
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(motivationalQuotes[0]);
  const [lastAddTime, setLastAddTime] = useState(null);
  const scaleAnim = new Animated.Value(1);

  useEffect(() => {
    loadCountData();
    selectRandomQuote();
    checkDailyReset();
  }, []);

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
      const today = await counterService.getTodayCount();
      const stats = await counterService.getStats();
      setTodayCount(today.count || 0);
      setTotalCount(stats.totalCount || 0);
      // Set days active from stats API, default to 1 to avoid division by zero
      setDaysActive(stats.daysActive || stats.totalDays || 1);
    } catch (error) {
      console.error('Load count error:', error);
      // Fallback values if API fails
      setDaysActive(1);
    }
  };

  const selectRandomQuote = () => {
    const randomQuote = motivationalQuotes[
      Math.floor(Math.random() * motivationalQuotes.length)
    ];
    setQuote(randomQuote);
  };

  const handleAddRam = async () => {
    // Validate input
    if (!counterService.validateRamInput(input)) {
      Alert.alert(
        'Invalid Input',
        'Please type "राम" exactly (in Devanagari script)'
      );
      return;
    }

    try {
      setLoading(true);

      // Trigger animation (useNativeDriver only works on native platforms, not web)
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      // Add count
      await counterService.addCount(1);

      // Update local state
      const newCount = todayCount + 1;
      setTodayCount(newCount);
      setTotalCount(totalCount + 1);
      await counterService.updateLocalCount(newCount);

      // Clear input
      setInput('');
      setLastAddTime(new Date());

      // Optional: Show celebration every 10 counts
      if (newCount % 10 === 0) {
        Alert.alert(
          '🎉 Milestone!',
          `Wonderful! You've completed ${newCount} राम chants today!`
        );
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearInput = () => {
    setInput('');
  };

  return (
    <LinearGradient
      colors={[colors.white, colors.backgroundColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeKeyboardView style={styles.keyboardAvoid}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Daily Quote */}
          <LinearGradient
            colors={gradients.warm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quoteBox}
          >
            <Text style={styles.quoteText}>{quote.quote}</Text>
            <Text style={styles.quoteTranslation}>{quote.translation}</Text>
          </LinearGradient>

          {/* Counter Display */}
          <View style={styles.counterSection}>
            <Text style={styles.counterLabel}>Today's Count</Text>
            <Animated.View
              style={[
                styles.counterCircle,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Text style={styles.counterNumber}>{todayCount}</Text>
            </Animated.View>
            <Text style={styles.counterSubtext}>राम chants today</Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Type "राम" to increment counter</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="राम"
                placeholderTextColor={colors.lightGray}
                value={input}
                onChangeText={setInput}
                editable={!loading}
                maxLength={10}
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
          </View>

          {/* Add Button */}
          <TouchableOpacity
            style={[styles.addButton, loading && styles.buttonDisabled]}
            onPress={handleAddRam}
            disabled={loading}
          >
            <Text style={styles.addButtonText}>
              {loading ? 'Adding...' : '+ Add राम'}
            </Text>
          </TouchableOpacity>

          {/* Stats Summary */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{todayCount}</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalCount}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {totalCount > 0 ? (totalCount / daysActive).toFixed(0) : '0'}
              </Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
          </View>

          {/* Motivational Message */}
          <View style={styles.motivationBox}>
            <Text style={styles.motivationIcon}>🕉️</Text>
            <Text style={styles.motivationText}>
              Each "राम" chant is a step towards inner peace. Continue your spiritual journey!
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  quoteBox: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
    ...shadowStyles.medium,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  quoteTranslation: {
    fontSize: 12,
    color: colors.white,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.9,
  },
  counterSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  counterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: spacing.md,
  },
  counterCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.lg,
    ...shadowStyles.dark,
  },
  counterNumber: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.white,
  },
  counterSubtext: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
  },
  inputSection: {
    marginVertical: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: spacing.md,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    fontSize: 28,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    ...shadowStyles.light,
  },
  clearButton: {
    position: 'absolute',
    right: spacing.md,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
    ...shadowStyles.medium,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    marginHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadowStyles.light,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
  },
  motivationBox: {
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    ...shadowStyles.light,
  },
  motivationIcon: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  motivationText: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 20,
  },
});
