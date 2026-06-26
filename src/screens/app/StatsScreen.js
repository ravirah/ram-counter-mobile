import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from '../../components/GradientWrapper';
import NoConnection from '../../components/NoConnection';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as counterService from '../../utils/counterService';
import * as apiService from '../../utils/apiService';
import moment from 'moment';
import appConfig from '../../config/appConfig';
import { useLanguage } from '../../context/LanguageContext';

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

export default function StatsScreen({ onLogout }) {
  const { t } = useLanguage();
  const { width: windowWidth, fontScale = 1 } = useWindowDimensions();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [userName, setUserName] = useState('');

  // Reload whenever the tab is focused (real-time data)
  useFocusEffect(
    useCallback(() => {
      loadStats();
      AsyncStorage.getItem('localUser').then(raw => {
        if (raw) { try { setUserName(JSON.parse(raw).name || ''); } catch (_) {} }
      });
    }, [])
  );

  const loadStats = async () => {
    try {
      setLoading(true);
      // Single source of truth — backend only, identical to every other screen. No local
      // fallback: if the backend is unreachable we show the offline state, never a
      // locally-computed number that would disagree with the backend.
      const d = await counterService.getDisplayStats();
      if (!d.ok) {
        setConnectionError(true);
        return;
      }
      setStats({
        totalCount: d.total,
        today: d.today,
        best: d.best,
        daysActive: d.daysActive,
        average: d.average,
        currentStreak: d.currentStreak,
        bestStreak: d.bestStreak,
      });
      setHistory(d.history);
      setConnectionError(false);
    } catch (error) {
      console.error('Load stats error:', error);
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  };
  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  };


  if (!stats && connectionError) {
    return (
      <LinearGradient colors={['#FFF8F0', '#FFFFFF']} style={styles.container}>
        <NoConnection onRetry={loadStats} />
      </LinearGradient>
    );
  }

  const todayKey = moment().format('YYYY-MM-DD');
  const todayTiming = history.find((item) => item.date === todayKey) || history[history.length - 1] || null;
  const daysActive = stats?.daysActive || 1;
  const averageDaily = stats?.average ?? ((stats?.totalCount || 0) / Math.max(daysActive, 1));
  const maxDaily = stats?.best ?? Math.max(...history.map(h => h.count || 0), 0);
  const last7Count = history.slice(-7).reduce((sum, h) => sum + (h.count || 0), 0);
  const last30Count = history.reduce((sum, h) => sum + (h.count || 0), 0);
  const isLargeFont = fontScale >= 1.2;
  const statCardBasis = windowWidth < 380 || isLargeFont ? '100%' : '31%';

  if (!stats) {
    return (
      <LinearGradient
        colors={['#FFF8F0', '#FFFFFF']}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('stats.loadingStats')}</Text>
        </View>
      </LinearGradient>
    );
  }


  return (
    <LinearGradient
      colors={['#FFF8F0', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Screen Header */}
        <View style={styles.screenHeader}>
          {userName !== '' && (
            <Text style={styles.userGreeting}>{t('namaste')}, {userName} 🙏</Text>
          )}
          <TouchableOpacity onPress={onLogout} style={styles.logoutIcon}>
            <Ionicons name="log-out-outline" size={22} color={colors.error || '#D32F2F'} />
          </TouchableOpacity>
        </View>

        {/* Connection Error Banner */}
        {connectionError && stats && (
          <TouchableOpacity style={styles.syncBanner} onPress={loadStats}>
            <Text style={styles.syncBannerText}>{t('cachedDataError')}</Text>
          </TouchableOpacity>
        )}

        {/* Hero Header — total count */}
        <LinearGradient
          colors={[appConfig.colors.primary, '#E07B20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroHeader}
        >
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
          <Text style={styles.heroLabel}>{t('stats.totalChants')}</Text>
          <Text style={styles.heroValue}>{stats.totalCount || 0}</Text>
          <Text style={styles.heroSub}>{t('stats.allTimeDevotion')}</Text>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { width: statCardBasis }]}>
            <Text style={styles.statCardEmoji}>🔥</Text>
            <Text style={styles.statCardValue}>{stats.currentStreak || 0}</Text>
            <Text style={styles.statCardLabel}>{t('stats.streak')}</Text>
          </View>
          <View style={[styles.statCard, { width: statCardBasis }]}>
            <Text style={styles.statCardEmoji}>📈</Text>
            <Text style={styles.statCardValue}>{averageDaily.toFixed(0)}</Text>
            <Text style={styles.statCardLabel}>{t('stats.dailyAvg')}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardBestDay, { width: statCardBasis }]}>
            <Text style={styles.statCardEmoji}>👑</Text>
            <Text style={[styles.statCardValue, styles.statCardValueBestDay]}>{maxDaily}</Text>
            <Text style={[styles.statCardLabel, styles.statCardLabelBestDay]}>{t('stats.bestDay')}</Text>
          </View>
        </View>

        {/* Progress Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats.progressOverview')}</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('stats.daysActive')}</Text>
              <Text style={styles.infoValue}>{daysActive} {t('stats.days')}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('stats.last7Days')}</Text>
              <Text style={styles.infoValue}>{last7Count} {appConfig.mantraWord}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('stats.last30Days')}</Text>
              <Text style={styles.infoValue}>{last30Count} {appConfig.mantraWord}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats.todayTiming')}</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('stats.allTimes')}</Text>
              <Text style={styles.infoValueSmall}>{TIMEZONE_LABEL}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('stats.dayStart')}</Text>
              <Text style={styles.infoValueSmall}>{formatTimeWithZone(todayTiming?.firstCountAt)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('stats.dayEnd')}</Text>
              <Text style={styles.infoValueSmall}>{formatTimeWithZone(todayTiming?.lastCountAt)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('stats.dayDuration')}</Text>
              <Text style={styles.infoValueSmall}>{formatDurationCompact(todayTiming?.activeDurationSeconds)}</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats.recentActivity')}</Text>
          <View style={styles.card}>
            {history.slice().reverse().slice(0, 7).map((item, index) => {
              const isMax = (item.count || 0) === maxDaily && maxDaily > 0;
              return (
                <View key={index} style={[styles.historyItem, index > 0 && styles.historyItemBorder, isMax && styles.historyItemMax]}>
                  <View style={styles.historyDateCol}>
                    <Text style={[styles.historyDateText, isMax && styles.historyDateTextMax]}>
                      {moment(item.date).format('MMM DD')}
                    </Text>
                    <Text style={styles.historyDayText}>
                      {moment(item.date).format('ddd')}
                    </Text>
                  </View>
                  <View style={styles.historyBarTrack}>
                    <View
                      style={[
                        styles.historyBarFill,
                        { width: `${Math.max(4, ((item.count || 0) / maxDaily) * 100)}%` },
                        isMax && styles.historyBarFillMax,
                      ]}
                    />
                  </View>
                  <Text style={[styles.historyCountText, isMax && styles.historyCountTextMax]}>
                    {isMax ? '👑 ' : ''}{item.count || 0}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats.achievements')}</Text>
          <View style={styles.achievementsGrid}>
            {stats.currentStreak >= 1 && (
              <View style={[styles.achieveBadge, styles.achieveBadgeOrange]}>
                <Text style={styles.achieveBadgeEmoji}>🔥</Text>
                <Text style={styles.achieveBadgeText}>
                  {t('stats.streakAchieve').replace('{n}', stats.currentStreak)}
                </Text>
              </View>
            )}
            {stats.totalCount >= 100 && (
              <View style={[styles.achieveBadge, styles.achieveBadgeRed]}>
                <Text style={styles.achieveBadgeEmoji}>💯</Text>
                <Text style={styles.achieveBadgeText}>{t('stats.chants100')}</Text>
              </View>
            )}
            {stats.totalCount >= 500 && (
              <View style={[styles.achieveBadge, styles.achieveBadgeBlue]}>
                <Text style={styles.achieveBadgeEmoji}>🎯</Text>
                <Text style={styles.achieveBadgeText}>{t('stats.chants500')}</Text>
              </View>
            )}
            {stats.totalCount >= 1000 && (
              <View style={[styles.achieveBadge, styles.achieveBadgeGold]}>
                <Text style={styles.achieveBadgeEmoji}>👑</Text>
                <Text style={styles.achieveBadgeText}>{t('stats.chants1000')}</Text>
              </View>
            )}
            {stats.totalCount < 100 && stats.currentStreak < 1 && (
              <Text style={styles.noAchievements}>
                {t('stats.noAchievements')}
              </Text>
            )}
          </View>
        </View>

        {/* Motivational Footer */}
        <LinearGradient
          colors={['#138808', '#0E6B06']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.footerCard}
        >
          <Text style={styles.footerTitle}>{t('stats.footerTitle')}</Text>
          <Text style={styles.footerText}>
            {t('stats.footerMessage').replace('{mantra}', appConfig.mantraWord)}
          </Text>
        </LinearGradient>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray,
  },

  // Screen header
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logoutIcon: {
    padding: 8,
  },
  userGreeting: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray,
    flex: 1,
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

  // Hero header
  heroHeader: {
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadowStyles.medium,
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -28,
    left: -18,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  heroValue: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
    marginVertical: spacing.xs,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    minWidth: 148,
    ...shadowStyles.light,
  },
  statCardEmoji: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: appConfig.colors.primary,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightGray,
    letterSpacing: 0.3,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Best Day card highlight
  statCardBestDay: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFB300',
  },
  statCardValueBestDay: {
    color: '#E65100',
  },
  statCardLabelBestDay: {
    color: '#F57C00',
    fontWeight: '700',
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: spacing.sm,
  },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
    ...shadowStyles.light,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray,
    flexShrink: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: appConfig.colors.primary,
    maxWidth: '100%',
    textAlign: 'right',
    flexShrink: 1,
  },
  infoValueSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: appConfig.colors.primary,
    maxWidth: '100%',
    textAlign: 'right',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderGray,
    marginHorizontal: spacing.lg,
  },

  // History
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  historyItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderGray,
  },
  historyDateCol: {
    width: 52,
    marginRight: spacing.md,
  },
  historyDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.darkGray,
  },
  historyDayText: {
    fontSize: 11,
    color: colors.lightGray,
  },
  historyBarTrack: {
    flex: 1,
    minWidth: 120,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  historyBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: appConfig.colors.primary,
  },
  historyCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.darkGray,
    minWidth: 28,
    textAlign: 'right',
    marginLeft: 'auto',
  },
  // Max count row highlight
  historyItemMax: {
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
  },
  historyDateTextMax: {
    color: '#E65100',
  },
  historyBarFillMax: {
    backgroundColor: '#FFB300',
  },
  historyCountTextMax: {
    color: '#E65100',
    fontSize: 15,
  },

  // Achievements
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  achieveBadge: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    minWidth: 88,
  },
  achieveBadgeOrange: {
    backgroundColor: 'rgba(255, 153, 51, 0.12)',
  },
  achieveBadgeRed: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  achieveBadgeBlue: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  achieveBadgeGold: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
  },
  achieveBadgeEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  achieveBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkGray,
    textAlign: 'center',
  },
  noAchievements: {
    fontSize: 14,
    color: colors.lightGray,
    fontStyle: 'italic',
    paddingHorizontal: spacing.sm,
  },

  // Footer
  footerCard: {
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 20,
    textAlign: 'center',
  },
});



