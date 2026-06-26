import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

import * as apiService from '../../utils/apiService';
import appConfig from '../../config/appConfig';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import { useLanguage } from '../../context/LanguageContext';

const normalizeUserId = (user) => user?._id || user?.id || user?.userId || null;

const formatDateTime = (value, fallback = '—') => {
  if (!value) return fallback;
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format('DD MMM YYYY, HH:mm') : fallback;
};

const formatDuration = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '—';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${Math.max(0, Math.round(total))}s`;
};

const deriveDailyRows = (detail) => {
  const directRows = detail?.dailySummaries || detail?.dailySummary || detail?.summaries;
  if (Array.isArray(directRows) && directRows.length > 0) {
    return directRows;
  }

  const activities = Array.isArray(detail?.recentActivities)
    ? detail.recentActivities
    : Array.isArray(detail?.activities)
      ? detail.activities
      : [];

  const grouped = new Map();
  activities.forEach((activity) => {
    const timestamp = activity?.timestamp || activity?.createdAt || activity?.date;
    if (!timestamp) return;
    const day = moment(timestamp).format('YYYY-MM-DD');
    const existing = grouped.get(day) || {
      date: day,
      dailyCount: 0,
      firstCountAt: null,
      lastCountAt: null,
      activeDurationSeconds: 0,
    };

    const activityCount = Number(activity?.count || activity?.dailyCount || 1) || 1;
    existing.dailyCount += activityCount;
    if (!existing.firstCountAt || moment(timestamp).isBefore(existing.firstCountAt)) {
      existing.firstCountAt = timestamp;
    }
    if (!existing.lastCountAt || moment(timestamp).isAfter(existing.lastCountAt)) {
      existing.lastCountAt = timestamp;
    }
    grouped.set(day, existing);
  });

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      activeDurationSeconds:
        row.firstCountAt && row.lastCountAt
          ? Math.max(0, moment(row.lastCountAt).diff(moment(row.firstCountAt), 'seconds'))
          : 0,
    }))
    .sort((a, b) => (a.date > b.date ? -1 : 1));
};

export default function AdminUserDetailPanel({
  selectedApp,
  users,
}) {
  const { t, lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailError, setDetailError] = useState('');

  const appFilter = selectedApp === 'all' ? null : selectedApp;

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0));
    if (!query) return sorted;
    return sorted.filter((user) => {
      return [user.name, user.mobile, user.email, user.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [searchTerm, users]);

  const selectedUserId = normalizeUserId(selectedUser || detail?.user);
  const detailUser = detail?.user || selectedUser || null;
  const summary = detail?.summary || detail?.stats || {};
  const dailyRows = useMemo(() => deriveDailyRows(detail), [detail]);
  const recentActivities = useMemo(() => {
    const rows = detail?.recentActivities || detail?.activities || [];
    return [...rows].sort((a, b) => {
      const at = new Date(a?.timestamp || a?.createdAt || 0).getTime();
      const bt = new Date(b?.timestamp || b?.createdAt || 0).getTime();
      return bt - at;
    });
  }, [detail]);

  const loadSelectedUser = async (user) => {
    const userId = normalizeUserId(user);
    setSelectedUser(user);
    setDetailError('');

    if (!userId) {
      setDetail({ user, recentActivities: [] });
      return;
    }

    setLoadingDetail(true);
    try {
      const [userDetail, activityRes] = await Promise.all([
        apiService.getUserDetails(userId).catch(() => null),
        apiService.getAllActivities(100, 1, '', userId, appFilter).catch(() => null),
      ]);

      const mergedDetail = userDetail || {};
      const mergedUser = mergedDetail.user || mergedDetail.profile || userDetail?.user || user;
      const mergedActivities = mergedDetail.recentActivities || mergedDetail.activities || activityRes?.activities || [];
      setDetail({
        ...mergedDetail,
        user: mergedUser,
        recentActivities: mergedActivities,
      });
    } catch (error) {
      console.error('Failed to load admin user detail:', error);
      setDetailError(error.response?.data?.message || error.message || (lang === 'hi' ? 'यूजर विवरण लोड नहीं हो पाया' : 'Failed to load user details'));
      setDetail({ user, recentActivities: [] });
    } finally {
      setLoadingDetail(false);
    }
  };

  const onRefresh = async () => {
    if (!selectedUserId) return;
    setRefreshing(true);
    try {
      await loadSelectedUser(selectedUser || detail?.user || selectedUserId);
    } finally {
      setRefreshing(false);
    }
  };

  const clearSelection = () => {
    setSelectedUser(null);
    setDetail(null);
    setDetailError('');
  };

  const renderUserCard = (user) => {
    const userId = normalizeUserId(user);
    const statusColor = user.status === 'approved' ? '#22c55e' : user.status === 'rejected' ? '#ef4444' : '#f59e0b';
    return (
      <TouchableOpacity key={userId || `${user.name}-${user.mobile}`} style={styles.userCard} activeOpacity={0.85} onPress={() => loadSelectedUser(user)}>
        <View style={styles.userRow}>
          <View style={styles.userIdentity}>
            <Text style={styles.userName}>{user.name || (lang === 'hi' ? 'अज्ञात यूजर' : 'Unknown User')}</Text>
            <Text style={styles.userMeta}>{user.mobile || user.email || (lang === 'hi' ? 'विवरण उपलब्ध नहीं' : 'No contact details')}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
            <Text style={styles.statusPillText}>{String(user.status || 'pending').toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.userStatsRow}>
          <View style={styles.userStatBlock}>
            <Text style={styles.userStatValue}>{user.totalCount || 0}</Text>
            <Text style={styles.userStatLabel}>{t('admin.totalCount')}</Text>
          </View>
          <View style={styles.userStatBlock}>
            <Text style={styles.userStatValue}>{user.todayCount || user.todayTotalCount || 0}</Text>
            <Text style={styles.userStatLabel}>{t('admin.todayCount')}</Text>
          </View>
          <View style={styles.userStatBlock}>
            <Text style={styles.userStatValue}>{user.lastActiveDate ? moment(user.lastActiveDate).fromNow() : '—'}</Text>
            <Text style={styles.userStatLabel}>{t('admin.lastActive')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSummaryCard = (label, value, subtitle, accent = false) => (
    <View style={[styles.summaryCard, accent && styles.summaryCardAccent]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && styles.summaryValueAccent]}>{value}</Text>
      {subtitle ? <Text style={styles.summarySubtitle}>{subtitle}</Text> : null}
    </View>
  );

  const renderDetail = () => {
    const user = detailUser || selectedUser || {};
    return (
      <View style={styles.detailWrap}>
        <View style={styles.detailTopBar}>
          <TouchableOpacity style={styles.backBtn} onPress={clearSelection}>
            <Ionicons name="arrow-back" size={18} color={colors.primary} />
            <Text style={styles.backBtnText}>{t('admin.backToUsers')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{String(user.name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name || (lang === 'hi' ? 'अज्ञात यूजर' : 'Unknown User')}</Text>
              <Text style={styles.profileMeta}>{user.mobile || '—'}</Text>
              <Text style={styles.profileMeta}>{user.email || (lang === 'hi' ? 'ईमेल उपलब्ध नहीं' : 'Email unavailable')}</Text>
            </View>
          </View>

          <View style={styles.profilePillRow}>
            <View style={styles.profilePill}><Text style={styles.profilePillText}>{String(user.status || 'pending').toUpperCase()}</Text></View>
            <View style={styles.profilePill}><Text style={styles.profilePillText}>{user.appId || selectedApp || appConfig.appId}</Text></View>
            <View style={styles.profilePill}><Text style={styles.profilePillText}>{user.createdAt ? moment(user.createdAt).format('DD MMM YYYY') : (lang === 'hi' ? 'बनाया गया: उपलब्ध नहीं' : 'Created: unavailable')}</Text></View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {renderSummaryCard(t('admin.totalCount'), detail?.summary?.totalCount ?? user.totalCount ?? 0, null, true)}
          {renderSummaryCard(t('admin.todayCount'), summary.todayCount ?? summary.dailyCount ?? user.todayCount ?? 0, null)}
          {renderSummaryCard(t('admin.lastActive'), user.lastActiveDate ? moment(user.lastActiveDate).fromNow() : '—', user.lastActiveDate ? formatDateTime(user.lastActiveDate) : null)}
          {renderSummaryCard(t('admin.currentStreak'), summary.currentStreak ?? detail?.currentStreak ?? 0, null)}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.dailyTiming')}</Text>
            <Text style={styles.sectionHint}>{lang === 'hi' ? 'बैकएंड उपलब्ध होने पर यह सही टाइमिंग दिखाएगा' : 'Shows backend timing when available'}</Text>
          </View>
          {loadingDetail ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.inlineLoadingText}>{t('admin.loadingUserDetails')}</Text>
            </View>
          ) : dailyRows.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin.noTimingData')}</Text>
          ) : (
            dailyRows.slice(0, 14).map((row, index) => {
              const date = row.date || row.day || row.createdAt;
              const dailyCount = row.dailyCount ?? row.count ?? 0;
              const startAt = row.firstCountAt || row.startTime || row.startedAt || row.startAt;
              const endAt = row.lastCountAt || row.endTime || row.endedAt || row.endAt;
              const duration = row.activeDurationSeconds ?? row.durationSeconds ?? row.sessionSeconds ?? 0;
              return (
                <View key={`${date || index}-${index}`} style={styles.timingRow}>
                  <View style={styles.timingDateCol}>
                    <Text style={styles.timingDate}>{date ? moment(date).format('DD MMM YYYY') : '—'}</Text>
                    <Text style={styles.timingCount}>{dailyCount} {appConfig.mantraWord}</Text>
                  </View>
                  <View style={styles.timingInfoCol}>
                    <Text style={styles.timingLine}>{t('admin.dayStart')}: {formatDateTime(startAt, 'N/A')}</Text>
                    <Text style={styles.timingLine}>{t('admin.dayEnd')}: {formatDateTime(endAt, 'N/A')}</Text>
                    <Text style={styles.timingLine}>{t('admin.duration')}: {formatDuration(duration)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.recentActivities')}</Text>
            <Text style={styles.sectionHint}>{recentActivities.length ? `${recentActivities.length} ${lang === 'hi' ? 'रिकॉर्ड' : 'records'}` : ''}</Text>
          </View>
          {recentActivities.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin.noActivityRecords')}</Text>
          ) : (
            recentActivities.slice(0, 12).map((activity, index) => {
              const info = activity.activityType || activity.type || (lang === 'hi' ? 'गतिविधि' : 'Activity');
              return (
                <View key={`${activity._id || activity.id || index}`} style={styles.activityRow}>
                  <View style={styles.activityLeft}>
                    <Text style={styles.activityType}>{info}</Text>
                    <Text style={styles.activityMeta}>{activity.count ? `+${activity.count}` : (activity.dailyCount ?? '')}</Text>
                  </View>
                  <Text style={styles.activityTime}>{(moment(activity.timestamp || activity.createdAt || activity.date).isValid() ? moment(activity.timestamp || activity.createdAt || activity.date).fromNow() : '—')}</Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {!selectedUser ? (
        <View>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{t('admin.activitiesUsersTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('admin.activitiesUsersSubtitle')}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('admin.searchUsersInActivities')}
              placeholderTextColor="#9CA3AF"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          {filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('admin.noUsersForActivities')}</Text>
            </View>
          ) : (
            filteredUsers.map(renderUserCard)
          )}
        </View>
      ) : (
        renderDetail()
      )}

      {detailError ? <Text style={styles.errorText}>{detailError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadowStyles.medium,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  heroSubtitle: {
    marginTop: 6,
    marginBottom: spacing.md,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#111827',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadowStyles.small,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  userIdentity: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  userMeta: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  userStatsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  userStatBlock: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: spacing.sm,
  },
  userStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  userStatLabel: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 11,
  },
  detailWrap: {
    gap: spacing.md,
  },
  detailTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadowStyles.small,
  },
  backBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.lg,
    ...shadowStyles.medium,
  },
  profileHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1E6',
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  profileMeta: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
  },
  profilePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  profilePill: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  profilePillText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: spacing.md,
    ...shadowStyles.small,
  },
  summaryCardAccent: {
    backgroundColor: '#FFF1E6',
  },
  summaryLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6B7280',
    fontWeight: '700',
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  summaryValueAccent: {
    color: colors.primary,
  },
  summarySubtitle: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 12,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.md,
    ...shadowStyles.medium,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  sectionHint: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
  },
  timingRow: {
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  timingDateCol: {
    marginBottom: spacing.sm,
  },
  timingDate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  timingCount: {
    marginTop: 3,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  timingInfoCol: {
    gap: 4,
  },
  timingLine: {
    color: '#374151',
    fontSize: 12,
    lineHeight: 18,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  activityType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  activityMeta: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
  },
  activityTime: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'right',
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  inlineLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 10,
  },
  inlineLoadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
  errorText: {
    marginTop: spacing.md,
    color: '#B91C1C',
    fontSize: 12,
  },
});

