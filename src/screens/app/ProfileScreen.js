import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LinearGradient from '../../components/GradientWrapper';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import NoConnection from '../../components/NoConnection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../config/appConfig';
import * as apiService from '../../utils/apiService';
import * as counterService from '../../utils/counterService';

const INFO_CONTENT = {
  about: {
    title: 'About Us',
    sections: [
      {
        heading: '🕉️ राम Bank — Spiritual Devotion Tracker',
        body: 'राम Bank is a devotional app designed to help you track and grow your daily chanting of the sacred name of Lord Ram. Whether you chant 108 times or 10,000 times a day, this app helps you stay consistent on your spiritual journey.',
      },
      {
        heading: '🙏 Our Mission',
        body: 'Our mission is to make spiritual discipline simple, measurable, and joyful. We believe that regular chanting of "राम" brings peace, strength, and divine grace into daily life.',
      },
      {
        heading: '✨ Key Features',
        body: '• One-tap count tracking\n• Daily & lifetime statistics\n• Streak tracking to build consistency\n• Secure personal profile\n• Admin-verified accounts for trust',
      },
      {
        heading: '📿 Our Belief',
        body: '"राम नाम सत्य है" — The name of Ram is the eternal truth. This app is a humble digital tool to support your devotion, not replace it.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By using राम Bank, you agree to these Terms & Conditions. If you do not agree, please discontinue use of the app.',
      },
      {
        heading: '2. Account Registration',
        body: 'You must provide a valid name and mobile number to register. Each mobile number is treated as a unique identity. You are responsible for keeping your login credentials safe.',
      },
      {
        heading: '3. Admin Approval',
        body: 'New accounts require admin approval before access is granted. The admin reserves the right to approve or reject any account without providing a reason.',
      },
      {
        heading: '4. Acceptable Use',
        body: 'This app is intended solely for personal spiritual devotion tracking. Any misuse, data tampering, or attempt to gain unauthorised access will result in immediate account termination.',
      },
      {
        heading: '5. Data Accuracy',
        body: 'Count data is recorded as entered by the user. We are not responsible for inaccurate counts entered manually.',
      },
      {
        heading: '6. Modifications',
        body: 'We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance of the updated terms.',
      },
      {
        heading: '7. Termination',
        body: 'We reserve the right to suspend or terminate accounts that violate these terms or are found to be inactive for extended periods.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect the following information when you register:\n• Full name\n• Mobile number\n• Email address (optional)\n• Chanting count data and activity timestamps',
      },
      {
        heading: '2. How We Use Your Information',
        body: 'Your data is used solely to:\n• Provide and improve the app experience\n• Track your devotional progress\n• Allow admin account management\n• Generate personal statistics',
      },
      {
        heading: '3. Data Storage',
        body: 'All data is stored securely in our database. We do not sell, trade, or rent your personal information to any third parties.',
      },
      {
        heading: '4. Authentication',
        body: 'We use JWT (JSON Web Token) based authentication. Tokens are stored locally on your device and are used to authenticate API requests securely.',
      },
      {
        heading: '5. Data Retention',
        body: 'Your data is retained as long as your account is active. You may request deletion of your account and all associated data by contacting the admin.',
      },
      {
        heading: '6. Third-Party Services',
        body: 'This app does not integrate with any third-party advertising or analytics platforms. Your spiritual data remains private.',
      },
      {
        heading: '7. Contact',
        body: 'For any privacy-related concerns, please contact the app administrator directly through the platform.',
      },
    ],
  },
};

export default function ProfileScreen({ navigation, onLogout }) {
  const [user, setUser] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState('06:00');
  const [infoModal, setInfoModal] = useState(null); // 'about' | 'terms' | 'privacy' | null

  // Refresh profile on tab focus (real-time data from backend)
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      setConnectionError(false);
      const profileRes = await apiService.getUserProfile();
      if (profileRes?.user) {
        const merged = { ...profileRes.user, backendSynced: true };
        await AsyncStorage.setItem('localUser', JSON.stringify(merged));
        setUser(merged);
      }
    } catch (error) {
      console.error('Load user error:', error);
      setConnectionError(true);
      // If no user data yet, try loading from local cache
      if (!user) {
        try {
          const cached = await AsyncStorage.getItem('localUser');
          if (cached) setUser(JSON.parse(cached));
        } catch (_) {}
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // window.confirm works reliably on web; Alert callbacks don't fire in RN Web
      if (window.confirm(appConfig.text.profileScreen.logoutConfirmMessage)) {
        onLogout && onLogout();
      }
    } else {
      Alert.alert(
        appConfig.text.profileScreen.logoutConfirmTitle,
        appConfig.text.profileScreen.logoutConfirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: appConfig.text.profileScreen.logoutButton,
            onPress: () => onLogout && onLogout(),
            style: 'destructive',
          },
        ]
      );
    }
  };

  if (!user && connectionError) {
    return (
      <LinearGradient colors={['#FFF8F0', '#FFFFFF']} style={styles.container}>
        <NoConnection onRetry={loadUserData} />
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient
        colors={['#FFF8F0', '#FFFFFF']}
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
      colors={['#FFF8F0', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Connection Error Banner */}
        {connectionError && user && (
          <TouchableOpacity style={styles.syncBanner} onPress={loadUserData}>
            <Text style={styles.syncBannerText}>Unable to refresh. Showing cached data. Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {/* Profile Card */}
        <LinearGradient
          colors={[appConfig.colors.primary, '#E07B20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileCard}
        >
          <View style={styles.profileDecor1} />
          <View style={styles.profileDecor2} />
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          </View>
          <Text style={styles.userName}>{user.name || 'User'}</Text>
          <Text style={styles.userPhone}>{user.phoneNumber || user.mobile}</Text>
          <Text style={styles.joinedDate}>
            Member since {new Date(user.createdAt || user.registeredAt || Date.now()).toLocaleDateString()}
          </Text>
        </LinearGradient>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>👤</Text>
                <Text style={styles.infoLabel}>Full Name</Text>
              </View>
              <Text style={styles.infoValue}>{user.name}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>📱</Text>
                <Text style={styles.infoLabel}>Phone</Text>
              </View>
              <Text style={styles.infoValue}>{user.phoneNumber || user.mobile}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>🔖</Text>
                <Text style={styles.infoLabel}>Account ID</Text>
              </View>
              <Text style={[styles.infoValue, styles.idValue]}>
                {user._id ? user._id.substring(0, 8) + '...' : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
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
                trackColor={{ false: colors.borderGray, true: appConfig.colors.primary }}
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.timePickerRow}>
                  <View style={styles.infoLabelGroup}>
                    <Text style={styles.infoIcon}>⏰</Text>
                    <Text style={styles.infoLabel}>Reminder Time</Text>
                  </View>
                  <Text style={styles.infoValue}>{dailyReminderTime}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* About App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>🕉️</Text>
                <Text style={styles.infoLabel}>App Name</Text>
              </View>
              <Text style={styles.infoValue}>राम Bank</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>📦</Text>
                <Text style={styles.infoLabel}>Version</Text>
              </View>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>✨</Text>
                <Text style={styles.infoLabel}>Purpose</Text>
              </View>
              <Text style={[styles.infoValue, styles.purposeText]}>
                Spiritual devotion tracking
              </Text>
            </View>
          </View>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.linkRow} onPress={() => setInfoModal('about')}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>📖</Text>
                <Text style={styles.linkText}>About Us</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.lightGray} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.linkRow} onPress={() => setInfoModal('terms')}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>📋</Text>
                <Text style={styles.linkText}>Terms & Conditions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.lightGray} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.linkRow} onPress={() => setInfoModal('privacy')}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>🔐</Text>
                <Text style={styles.linkText}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.lightGray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Modal */}
        <Modal
          visible={!!infoModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setInfoModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <LinearGradient
                colors={[appConfig.colors.primary, '#E07B20']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalHeader}
              >
                <Text style={styles.modalTitle}>
                  {infoModal ? INFO_CONTENT[infoModal].title : ''}
                </Text>
                <TouchableOpacity onPress={() => setInfoModal(null)} style={styles.modalClose}>
                  <Ionicons name="close" size={24} color={colors.white} />
                </TouchableOpacity>
              </LinearGradient>

              {/* Modal Body */}
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {infoModal && INFO_CONTENT[infoModal].sections.map((section, idx) => (
                  <View key={idx} style={styles.modalSection}>
                    <Text style={styles.modalSectionHeading}>{section.heading}</Text>
                    <Text style={styles.modalSectionBody}>{section.body}</Text>
                  </View>
                ))}
                <View style={styles.modalFooter}>
                  <Text style={styles.modalFooterText}>राम Bank • Version 1.0.0</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} style={styles.logoutIcon} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Spiritual Message */}
        <LinearGradient
          colors={['#138808', '#0E6B06']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.spiritualCard}
        >
          <Text style={styles.spiritualTitle}>भगवान का आशीर्वाद</Text>
          <Text style={styles.spiritualText}>
            May your devotion bring you peace and inner strength. 🙏
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

  // Profile card
  profileCard: {
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadowStyles.medium,
  },
  profileDecor1: {
    position: 'absolute',
    top: -45,
    right: -35,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileDecor2: {
    position: 'absolute',
    bottom: -30,
    left: -22,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
    color: appConfig.colors.primary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  userPhone: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: spacing.sm,
  },
  joinedDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
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
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 17,
    marginRight: spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGray,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: appConfig.colors.primary,
  },
  idValue: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  purposeText: {
    maxWidth: '55%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderGray,
    marginHorizontal: spacing.lg,
  },

  // Preferences
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: 2,
  },
  preferenceSubtext: {
    fontSize: 12,
    color: colors.lightGray,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // Links
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    marginVertical: spacing.md,
    ...shadowStyles.light,
  },
  logoutIcon: {
    marginRight: spacing.sm,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  modalSection: {
    marginBottom: spacing.lg,
  },
  modalSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: appConfig.colors.primary,
    marginBottom: spacing.xs,
  },
  modalSectionBody: {
    fontSize: 13,
    color: colors.darkGray,
    lineHeight: 20,
  },
  modalFooter: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  modalFooterText: {
    fontSize: 12,
    color: colors.lightGray,
    fontStyle: 'italic',
  },

  // Spiritual footer
  spiritualCard: {
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  spiritualTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  spiritualText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
