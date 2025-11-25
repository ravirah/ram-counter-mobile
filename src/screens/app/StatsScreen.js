import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import LinearGradient from '../../components/GradientWrapper';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as counterService from '../../utils/counterService';
import moment from 'moment';

export default function StatsScreen() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [statsData, historyData] = await Promise.all([
        counterService.getStats(),
        counterService.getCountHistory(30),
      ]);
      setStats(statsData);
      setHistory(historyData || []);
    } catch (error) {
      console.error('Load stats error:', error);
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

  if (!stats) {
    return (
      <LinearGradient
        colors={[colors.white, colors.backgroundColor]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </LinearGradient>
    );
  }

  const totalDays = history.length || 1;
  const averageDaily = stats.totalCount / totalDays;
  const maxDaily = Math.max(...history.map(h => h.count || 0), 0);

  return (
    <LinearGradient
      colors={[colors.white, colors.backgroundColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Key Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statValue}>{stats.totalCount || 0}</Text>
            <Text style={styles.statName}>Total Count</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={styles.statValue}>{stats.currentStreak || 0}</Text>
            <Text style={styles.statName}>Current Streak</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={styles.statValue}>{averageDaily.toFixed(0)}</Text>
            <Text style={styles.statName}>Avg Daily</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>{maxDaily}</Text>
            <Text style={styles.statName}>Best Day</Text>
          </View>
        </View>

        {/* Progress Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress Overview</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Days Active</Text>
              <Text style={styles.infoValue}>{totalDays} days</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last 7 Days</Text>
              <Text style={styles.infoValue}>
                {history.slice(-7).reduce((sum, h) => sum + (h.count || 0), 0)} राम
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last 30 Days</Text>
              <Text style={styles.infoValue}>
                {history.reduce((sum, h) => sum + (h.count || 0), 0)} राम
              </Text>
            </View>
          </View>
        </View>

        {/* Recent History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.historyContainer}>
            {history.slice().reverse().slice(0, 7).map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyDate}>
                  <Text style={styles.historyDateText}>
                    {moment(item.date).format('MMM DD')}
                  </Text>
                  <Text style={styles.historyDay}>
                    {moment(item.date).format('ddd')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.historyBar,
                    {
                      width:
                        (item.count / maxDaily) * 200 || 10,
                      backgroundColor:
                        item.count > 50
                          ? colors.primary
                          : item.count > 25
                          ? colors.accent
                          : colors.lightGray,
                    },
                  ]}
                />
                <Text style={styles.historyCount}>{item.count || 0}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.achievementContainer}>
            {stats.currentStreak >= 1 && (
              <View style={styles.achievement}>
                <Text style={styles.achievementIcon}>🔥</Text>
                <Text style={styles.achievementText}>
                  {stats.currentStreak} Day{stats.currentStreak > 1 ? 's' : ''} Streak
                </Text>
              </View>
            )}

            {stats.totalCount >= 100 && (
              <View style={styles.achievement}>
                <Text style={styles.achievementIcon}>💯</Text>
                <Text style={styles.achievementText}>100+ Chants</Text>
              </View>
            )}

            {stats.totalCount >= 500 && (
              <View style={styles.achievement}>
                <Text style={styles.achievementIcon}>🎯</Text>
                <Text style={styles.achievementText}>500+ Chants</Text>
              </View>
            )}

            {stats.totalCount >= 1000 && (
              <View style={styles.achievement}>
                <Text style={styles.achievementIcon}>👑</Text>
                <Text style={styles.achievementText}>1000+ Chants Master</Text>
              </View>
            )}
          </View>
        </View>

        {/* Motivational Footer */}
        <View style={styles.footerBox}>
          <Text style={styles.footerTitle}>Keep Going! 🙏</Text>
          <Text style={styles.footerText}>
            Your consistent devotion is your greatest strength. Every राम chant brings you closer to spiritual peace.
          </Text>
        </View>
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
    paddingVertical: spacing.lg,
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
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    marginHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadowStyles.light,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  statName: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
  },
  section: {
    marginVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: spacing.md,
  },
  infoBox: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadowStyles.light,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderGray,
  },
  historyContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadowStyles.light,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  historyDate: {
    width: 50,
    marginRight: spacing.md,
  },
  historyDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.darkGray,
  },
  historyDay: {
    fontSize: 11,
    color: colors.gray,
  },
  historyBar: {
    height: 24,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.md,
  },
  historyCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.darkGray,
    minWidth: 30,
    textAlign: 'right',
  },
  achievementContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadowStyles.light,
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  achievementIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  achievementText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
  },
  footerBox: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  footerText: {
    fontSize: 13,
    color: colors.white,
    lineHeight: 20,
  },
});
