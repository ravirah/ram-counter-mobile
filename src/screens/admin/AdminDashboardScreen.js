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
  
  const appsList = [
    { id: 'all', name: 'All Apps' },
    { id: 'ram-bank', name: 'राम Bank' },
    { id: 'krishna-bank', name: 'कृष्ण Bank' },
    // Add more apps as they are created
  ];

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
      
      const [statsData, usersData, activitiesData] = await Promise.all([
        apiService.getAdminStats(appFilter),
        apiService.getAllUsers(20, 1, '', appFilter),
        apiService.getAllActivities(50, 1, '', '', appFilter),
      ]);
      
      console.log('🔵 Stats data:', statsData);
      console.log('🔵 Users data:', usersData);
      console.log('🔵 Activities data:', activitiesData);
      
      setStats(statsData.stats);
      setUsers(usersData.users || []);
      setActivities(activitiesData.activities || []);
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

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats?.totalUsers || 0}</Text>
        <Text style={styles.statLabel}>Total Users</Text>
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
  );

  const renderUsers = () => (
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
        users.filter(u => 
          u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase())
        ).map((user) => (
          <TouchableOpacity 
            key={user._id || user.id} 
            style={styles.userCard}
            onPress={() => navigation.navigate('UserDetails', { userId: user._id || user.id })}
          >
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userDetail}>Total Count: {user.totalCount || 0}</Text>
            <Text style={styles.userDetail}>
              Last Active: {user.lastActiveDate ? moment(user.lastActiveDate).fromNow() : 'Never'}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderActivities = () => (
    <View style={styles.listContainer}>
      {activities.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{appConfig.text.adminScreen.noActivitiesMessage}</Text>
          <Text style={styles.emptySubtext}>Activities will appear here once users start using the app</Text>
        </View>
      ) : (
        activities.map((activity, index) => (
          <View key={index} style={styles.activityCard}>
            <Text style={styles.activityType}>{activity.activityType}</Text>
            <Text style={styles.activityDetail}>
              User: {activity.User?.name || activity.userId}
            </Text>
            {activity.count > 0 && (
              <Text style={styles.activityDetail}>Count: {activity.count}</Text>
            )}
            <Text style={styles.activityTime}>
              {moment(activity.timestamp).format('MMM DD, YYYY HH:mm')}
            </Text>
          </View>
        ))
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
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

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
                {app.name}
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
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadowStyles.small,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
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
    justifyContent: 'space-around',
    padding: spacing.lg,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    minWidth: 100,
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
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: spacing.xs,
  },
  userDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadowStyles.small,
  },
  activityType: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  activityDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
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
});
