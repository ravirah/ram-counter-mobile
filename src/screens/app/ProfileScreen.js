import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import LinearGradient from '../../components/GradientWrapper';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authService from '../../utils/authService';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState('06:00');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Load user error:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await authService.logout();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
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

  if (!user) {
    return (
      <LinearGradient
        colors={[colors.white, colors.backgroundColor]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user.name || 'User'}</Text>
          <Text style={styles.userPhone}>{user.phoneNumber}</Text>
          <Text style={styles.joinedDate}>
            Member since {new Date(user.registeredAt).toLocaleDateString()}
          </Text>
        </LinearGradient>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{user.name}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user.phoneNumber}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account ID</Text>
              <Text style={[styles.infoValue, styles.idValue]}>
                {user._id ? user._id.substring(0, 8) + '...' : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.preferencesBox}>
            <View style={styles.preferenceRow}>
              <View>
                <Text style={styles.preferenceLabel}>Daily Notifications</Text>
                <Text style={styles.preferenceSubtext}>
                  Get reminded to chant daily
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.borderGray, true: colors.primary }}
              />
            </View>

            {notificationsEnabled && (
              <View style={styles.timePickerBox}>
                <Text style={styles.timeLabel}>Reminder Time</Text>
                <Text style={styles.timeValue}>{dailyReminderTime}</Text>
                <Text style={styles.timeSubtext}>
                  You'll be reminded at {dailyReminderTime} every day
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About App</Text>
          <View style={styles.infoBox}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>App Name</Text>
              <Text style={styles.aboutValue}>राम Counter</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Purpose</Text>
              <Text style={[styles.aboutValue, styles.purposeText]}>
                Spiritual devotion tracking
              </Text>
            </View>
          </View>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <View style={styles.linkBox}>
            <TouchableOpacity style={styles.linkItem}>
              <Text style={styles.linkText}>📖 About Us</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.linkItem}>
              <Text style={styles.linkText}>📋 Terms & Conditions</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.linkItem}>
              <Text style={styles.linkText}>🔐 Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>🚪 Logout</Text>
        </TouchableOpacity>

        {/* Spiritual Message */}
        <View style={styles.spiritualBox}>
          <Text style={styles.spiritualTitle}>भगवान का आशीर्वाद</Text>
          <Text style={styles.spiritualText}>
            May your devotion bring you peace and inner strength. 🙏
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
  profileHeader: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadowStyles.medium,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  userPhone: {
    fontSize: 14,
    color: colors.white,
    marginBottom: spacing.md,
    opacity: 0.9,
  },
  joinedDate: {
    fontSize: 12,
    color: colors.white,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  section: {
    marginVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  idValue: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderGray,
  },
  preferencesBox: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadowStyles.light,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: spacing.sm,
  },
  preferenceSubtext: {
    fontSize: 12,
    color: colors.gray,
  },
  timePickerBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderGray,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: spacing.sm,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  timeSubtext: {
    fontSize: 12,
    color: colors.gray,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  aboutLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  purposeText: {
    maxWidth: '60%',
    textAlign: 'right',
  },
  linkBox: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadowStyles.light,
  },
  linkItem: {
    paddingVertical: spacing.md,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.lg,
    ...shadowStyles.medium,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  spiritualBox: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  spiritualTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  spiritualText: {
    fontSize: 13,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 20,
  },
});
