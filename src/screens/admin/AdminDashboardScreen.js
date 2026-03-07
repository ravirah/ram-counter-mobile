import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import appConfig from '../../config/appConfig';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as apiService from '../../utils/apiService';
import moment from 'moment';

export default function AdminDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('stats'); // stats, users, activities
  const [selectedApp, setSelectedApp] = useState('all'); // all, ram-bank, krishna-bank, etc.
  const [appsList, setAppsList] = useState([
    { id: 'all', name: 'All Apps', userCount: 0 }
  ]); // Dynamic list from backend
  
  // App name mapping for display
  const appNameMap = {
    'ram-bank': 'राम Bank',
    'krishna-bank': 'कृष्ण Bank',
    'hanuman-bank': 'हनुमान Bank',
    'shiva-bank': 'शिव Bank',
    'ganesh-bank': 'गणेश Bank',
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadDashboardData(); // Reload when selectedApp changes
    }
  }, [selectedApp]);

  const loadDashboardData = async () => {
    try {
      console.log('🔵 Loading dashboard data for app:', selectedApp);
      const appFilter = selectedApp === 'all' ? null : selectedApp;
      
      const [statsData, usersData, activitiesData, appsData] = await Promise.all([
        apiService.getAdminStats(appFilter),
        apiService.getAllUsers(20, 1, '', appFilter),
        apiService.getAllActivities(50, 1, '', '', appFilter),
        apiService.getApps(), // Fetch dynamic app list
      ]);
      
      console.log('🔵 Stats data:', statsData);
      console.log('🔵 Users data:', usersData);
      console.log('🔵 Activities data:', activitiesData);
      console.log('🔵 Apps data:', appsData);
      
      setStats(statsData.stats);
      setUsers(usersData.users || []);
      setActivities(activitiesData.activities || []);
      
      // Build dynamic app list with "All Apps" first
      if (appsData.success && appsData.apps) {
        const totalUsers = appsData.apps.reduce((sum, app) => sum + app.userCount, 0);
        const dynamicApps = [
          { id: 'all', name: 'All Apps', userCount: totalUsers },
          ...appsData.apps.map(app => ({
            id: app.appId,
            name: appNameMap[app.appId] || app.appId, // Use mapped name or fallback to appId
            userCount: app.userCount
          }))
        ];
        setAppsList(dynamicApps);
      }
    } catch (error) {
      console.error('🔴 Failed to load dashboard:', error);
      console.error('🔴 Error details:', error.response?.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const [editModal, setEditModal] = useState(null); // { userId, name, mobile, email }
  const [editLoading, setEditLoading] = useState(false);

  const refreshUsers = async () => {
    const appFilter = selectedApp === 'all' ? null : selectedApp;
    const [usersData, statsData] = await Promise.all([
      apiService.getAllUsers(20, 1, '', appFilter),
      apiService.getAdminStats(appFilter),
    ]);
    setUsers(usersData.users || []);
    setStats(statsData.stats);
  };

  const handleUpdateStatus = async (userId, status) => {
    try {
      await apiService.updateUserStatus(userId, status);
      await refreshUsers();
    } catch (error) {
      console.error('🔴 Failed to update user status:', error);
    }
  };

  const handleEditSave = async () => {
    if (!editModal.name.trim() || !editModal.mobile.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Name and mobile are required');
      } else {
        Alert.alert('Error', 'Name and mobile are required');
      }
      return;
    }
    setEditLoading(true);
    try {
      await apiService.editUser(editModal.userId, {
        name: editModal.name.trim(),
        mobile: editModal.mobile.trim(),
        email: editModal.email?.trim() || null,
      });
      setEditModal(null);
      await refreshUsers();
    } catch (error) {
      console.error('🔴 Failed to edit user:', error);
      if (Platform.OS === 'web') {
        window.alert(error.response?.data?.message || 'Failed to update user');
      } else {
        Alert.alert('Error', error.response?.data?.message || 'Failed to update user');
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = (userId, userName) => {
    const doDelete = async () => {
      try {
        await apiService.deleteUser(userId);
        await refreshUsers();
      } catch (error) {
        console.error('🔴 Failed to delete user:', error);
        if (Platform.OS === 'web') {
          window.alert('Failed to delete user');
        } else {
          Alert.alert('Error', 'Failed to delete user');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${userName}" and all their data? This cannot be undone.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete User',
        `Delete "${userName}" and all their data? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const renderStats = () => (
    <View>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalUsers || 0}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#FF8C00' }]}>{stats?.pendingUsers || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.activeToday || 0}</Text>
          <Text style={styles.statLabel}>Active Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.todayTotalCount || 0}</Text>
          <Text style={styles.statLabel}>Today's Count</Text>
        </View>
      </View>
      <View style={styles.totalCountBanner}>
        <Text style={styles.totalCountBannerLabel}>ALL-TIME TOTAL CHANTS</Text>
        <Text style={styles.totalCountBannerValue}>{stats?.allTimeTotalCount || 0}</Text>
        <Text style={styles.totalCountBannerSub}>Across all users · All time</Text>
      </View>

      {/* Top Chanters */}
      <View style={styles.topChantersSection}>
        <Text style={styles.topChantersTitle}>Top Chanters</Text>
        <View style={styles.topChantersRow}>
          <View style={styles.topChanterCard}>
            <Text style={styles.topChanterEmoji}>🏆</Text>
            <Text style={styles.topChanterLabel}>Today's Best</Text>
            {stats?.topChanterToday ? (
              <>
                <Text style={styles.topChanterName}>{stats.topChanterToday.name}</Text>
                <Text style={styles.topChanterCount}>{stats.topChanterToday.count} chants</Text>
              </>
            ) : (
              <Text style={styles.topChanterNone}>No activity today</Text>
            )}
          </View>
          <View style={[styles.topChanterCard, styles.topChanterCardGold]}>
            <Text style={styles.topChanterEmoji}>👑</Text>
            <Text style={styles.topChanterLabel}>All-Time Best</Text>
            {stats?.topChanterAllTime ? (
              <>
                <Text style={styles.topChanterName}>{stats.topChanterAllTime.name}</Text>
                <Text style={styles.topChanterCount}>{stats.topChanterAllTime.count} chants</Text>
              </>
            ) : (
              <Text style={styles.topChanterNone}>No data yet</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const renderUsers = () => {
    const maxTotalCount = Math.max(...users.map(u => u.totalCount || 0), 0);
    const filteredUsers = users.filter(u =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return (
    <View style={styles.listContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder={appConfig.text.adminScreen.searchPlaceholder}
        value={searchTerm}
        onChangeText={setSearchTerm}
      />
      {users.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{appConfig.text.adminScreen.noUsersMessage}</Text>
          <Text style={styles.emptySubtext}>Users will appear here once they register in the app</Text>
        </View>
      ) : (
        filteredUsers.map((user) => {
          const userId = user._id || user.id;
          const statusColor = user.status === 'approved' ? '#22c55e' : user.status === 'rejected' ? '#ef4444' : '#FF8C00';
          const isTopUser = maxTotalCount > 0 && (user.totalCount || 0) === maxTotalCount;
          return (
            <View key={userId} style={[styles.userCard, isTopUser && styles.userCardTop]}>
              <View style={styles.userCardHeader}>
                <Text style={styles.userName}>{isTopUser ? '👑 ' : ''}{user.name}</Text>
                <View style={styles.userCardActions}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusBadgeText}>{(user.status || 'pending').toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setEditModal({ userId, name: user.name, mobile: user.mobile, email: user.email || '' })}
                  >
                    <Text style={styles.iconBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, styles.iconBtnDanger]}
                    onPress={() => handleDeleteUser(userId, user.name)}
                  >
                    <Text style={styles.iconBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.userDetail}>Mobile: {user.mobile}</Text>
              <Text style={[styles.userDetail, isTopUser && styles.userDetailTop]}>
                Total Count: {user.totalCount || 0}{isTopUser ? ' 👑' : ''}
              </Text>
              <Text style={styles.userDetail}>
                Last Active: {user.lastActiveDate ? moment(user.lastActiveDate).fromNow() : 'Never'}
              </Text>
              <View style={styles.statusButtons}>
                {user.status !== 'approved' && (
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleUpdateStatus(userId, 'approved')}
                  >
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                )}
                {user.status !== 'rejected' && (
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleUpdateStatus(userId, 'rejected')}
                  >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
    );
  };

  const activityTypeMap = {
    COUNT_INCREMENT: { label: `Chanted ${appConfig.mantraWord}`, icon: '🙏', color: '#4CAF50' },
    REGISTER: { label: 'New Registration', icon: '🆕', color: '#2196F3' },
    LOGIN: { label: 'User Login', icon: '🔑', color: '#FF9800' },
    LOGOUT: { label: 'User Logout', icon: '🚪', color: '#9E9E9E' },
    PROFILE_UPDATE: { label: 'Profile Updated', icon: '✏️', color: '#9C27B0' },
    STATUS_CHANGE: { label: 'Status Changed', icon: '🔄', color: '#00BCD4' },
    ADMIN_LOGIN: { label: 'Admin Login', icon: '🛡️', color: '#F44336' },
  };

  const getActivityInfo = (type) => activityTypeMap[type] || { label: type, icon: '📌', color: '#666' };

  const renderActivities = () => (
    <View style={styles.listContainer}>
      {activities.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{appConfig.text.adminScreen.noActivitiesMessage}</Text>
          <Text style={styles.emptySubtext}>Activities will appear here once users start using the app</Text>
        </View>
      ) : (
        activities.map((activity, index) => {
          const info = getActivityInfo(activity.activityType);
          return (
            <View key={index} style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <View style={[styles.activityIconBadge, { backgroundColor: info.color + '18' }]}>
                  <Text style={styles.activityIcon}>{info.icon}</Text>
                </View>
                <View style={styles.activityInfo}>
                  <Text style={[styles.activityType, { color: info.color }]}>{info.label}</Text>
                  <Text style={styles.activityUser}>
                    {activity.User?.name || 'Unknown User'}
                  </Text>
                </View>
                <Text style={styles.activityTime}>
                  {moment(activity.timestamp).fromNow()}
                </Text>
              </View>
              {activity.count > 0 && (
                <View style={styles.activityCountRow}>
                  <Text style={styles.activityCountLabel}>Count:</Text>
                  <Text style={styles.activityCountValue}>+{activity.count}</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'stats' && styles.tabActive]}
          onPress={() => setSelectedTab('stats')}
        >
          <Text style={[styles.tabText, selectedTab === 'stats' && styles.tabTextActive]}>
            Stats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'users' && styles.tabActive]}
          onPress={() => setSelectedTab('users')}
        >
          <Text style={[styles.tabText, selectedTab === 'users' && styles.tabTextActive]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'activities' && styles.tabActive]}
          onPress={() => setSelectedTab('activities')}
        >
          <Text style={[styles.tabText, selectedTab === 'activities' && styles.tabTextActive]}>
            Activities
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.appSelector}>
        <Text style={styles.appSelectorLabel}>Filter by App:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.appButtons}>
          {appsList.map((app) => (
            <TouchableOpacity
              key={app.id}
              style={[
                styles.appButton,
                selectedApp === app.id && styles.appButtonActive
              ]}
              onPress={() => setSelectedApp(app.id)}
            >
              <Text style={[
                styles.appButtonText,
                selectedApp === app.id && styles.appButtonTextActive
              ]}>
                {app.name} {app.userCount !== undefined && `(${app.userCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {selectedTab === 'stats' && renderStats()}
        {selectedTab === 'users' && renderUsers()}
        {selectedTab === 'activities' && renderActivities()}
      </ScrollView>

      {/* Edit User Modal */}
      <Modal
        visible={!!editModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalBox}>
            <Text style={styles.editModalTitle}>Edit User</Text>

            <Text style={styles.editLabel}>Name *</Text>
            <TextInput
              style={styles.editInput}
              value={editModal?.name || ''}
              onChangeText={(v) => setEditModal(p => ({ ...p, name: v }))}
              placeholder="Full name"
            />

            <Text style={styles.editLabel}>Mobile *</Text>
            <TextInput
              style={styles.editInput}
              value={editModal?.mobile || ''}
              onChangeText={(v) => setEditModal(p => ({ ...p, mobile: v }))}
              placeholder="Mobile number"
              keyboardType="phone-pad"
            />

            <Text style={styles.editLabel}>Email</Text>
            <TextInput
              style={styles.editInput}
              value={editModal?.email || ''}
              onChangeText={(v) => setEditModal(p => ({ ...p, email: v }))}
              placeholder="Email (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setEditModal(null)}
                disabled={editLoading}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveBtn}
                onPress={handleEditSave}
                disabled={editLoading}
              >
                {editLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.editSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    ...shadowStyles.small,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: colors.accent,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  totalCountBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadowStyles.medium,
  },
  totalCountBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  totalCountBannerValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  totalCountBannerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    width: '48%',
    marginBottom: spacing.sm,
    ...shadowStyles.medium,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    padding: spacing.md,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 14,
    ...shadowStyles.small,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadowStyles.small,
  },
  userCardTop: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFB300',
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    flex: 1,
  },
  statusBadge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  userDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  userDetailTop: {
    color: '#E65100',
    fontWeight: '700',
  },
  approveButton: {
    marginTop: spacing.sm,
    backgroundColor: '#22c55e',
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  rejectButton: {
    marginTop: spacing.xs,
    backgroundColor: '#fff',
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 13,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  userCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  iconBtnDanger: {
    backgroundColor: '#fff0f0',
  },
  iconBtnText: {
    fontSize: 14,
  },
  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  editModalBox: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...shadowStyles.medium,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: spacing.lg,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: spacing.lg,
  },
  editCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  editCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  editSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    minWidth: 70,
    alignItems: 'center',
  },
  editSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadowStyles.small,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  activityIcon: {
    fontSize: 18,
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 14,
    fontWeight: '700',
  },
  activityUser: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },
  activityTime: {
    fontSize: 11,
    color: '#aaa',
  },
  activityCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginLeft: 48,
  },
  activityCountLabel: {
    fontSize: 12,
    color: '#888',
    marginRight: 4,
  },
  activityCountValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4CAF50',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.lightGray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  appSelector: {
    backgroundColor: '#fff',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadowStyles.small,
  },
  appSelectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: spacing.sm,
  },
  appButtons: {
    flexDirection: 'row',
  },
  appButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: '#f0f0f0',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  appButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  appButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  appButtonTextActive: {
    color: '#fff',
  },
  // Top Chanters
  topChantersSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  topChantersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: spacing.sm,
  },
  topChantersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  topChanterCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadowStyles.small,
  },
  topChanterCardGold: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFB300',
  },
  topChanterEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  topChanterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  topChanterName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  topChanterCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 2,
  },
  topChanterNone: {
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
});
