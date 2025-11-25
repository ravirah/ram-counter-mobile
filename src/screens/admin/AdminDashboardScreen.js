import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import LinearGradient from '../../components/GradientWrapper';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import api from '../../config/api';
import * as authService from '../../utils/authService';
import moment from 'moment';

export default function AdminDashboardScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
      ]);
      setUsers(usersRes.data.users || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Load dashboard error:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await authService.adminLogout();
              navigation.reset({
                index: 0,
                routes: [{ name: 'AdminLogin' }],
              });
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/admin/export-csv');
      Alert.alert('Success', 'CSV exported successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV');
    }
  };

  const renderUserItem = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name || 'Unknown'}</Text>
          <Text style={styles.userPhone}>{item.phoneNumber}</Text>
          <Text style={styles.userDate}>
            {moment(item.registeredAt).format('MMM DD, YYYY')}
          </Text>
        </View>
      </View>
      <View style={styles.userStats}>
        <Text style={styles.userCount}>{item.todayCount || 0}</Text>
        <Text style={styles.userCountLabel}>Today</Text>
      </View>
    </View>
  );

  const filteredUsers =
    selectedFilter === 'active'
      ? users.filter((u) => (u.todayCount || 0) > 0)
      : selectedFilter === 'inactive'
      ? users.filter((u) => (u.todayCount || 0) === 0)
      : users;

  if (!stats) {
    return (
      <LinearGradient colors={[colors.white, colors.backgroundColor]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.white, colors.backgroundColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>राम Counter Management</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statValue}>{stats.totalUsers || 0}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statValue}>{stats.totalCounts || 0}</Text>
            <Text style={styles.statLabel}>Total Counts</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={styles.statValue}>{stats.activeToday || 0}</Text>
            <Text style={styles.statLabel}>Active Today</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={styles.statValue}>
              {stats.averageCount ? stats.averageCount.toFixed(0) : 0}
            </Text>
            <Text style={styles.statLabel}>Avg Count</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleExportCSV}
          >
            <Text style={styles.actionButtonText}>📥 Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRefresh}
          >
            <Text style={styles.actionButtonText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === 'all' && styles.filterButtonTextActive,
              ]}
            >
              All ({users.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'active' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter('active')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === 'active' && styles.filterButtonTextActive,
              ]}
            >
              Active ({users.filter((u) => (u.todayCount || 0) > 0).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'inactive' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter('inactive')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === 'inactive' && styles.filterButtonTextActive,
              ]}
            >
              Inactive ({users.filter((u) => (u.todayCount || 0) === 0).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Users List */}
        <View style={styles.usersSection}>
          <Text style={styles.usersTitle}>Users List</Text>
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No users found</Text>
            }
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingTop: spacing.xl,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.darkGray,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.gray,
    marginTop: spacing.sm,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadowStyles.light,
  },
  logoutText: {
    fontSize: 20,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
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
    fontSize: 28,
    marginBottom: spacing.sm,
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
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.lg,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    marginHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadowStyles.light,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.lg,
  },
  filterButton: {
    flex: 1,
    marginHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.borderGray,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray,
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  usersSection: {
    marginTop: spacing.lg,
  },
  usersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadowStyles.light,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: spacing.xs,
  },
  userPhone: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  userDate: {
    fontSize: 11,
    color: colors.lightGray,
  },
  userStats: {
    alignItems: 'center',
  },
  userCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  userCountLabel: {
    fontSize: 11,
    color: colors.gray,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
});
