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
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LinearGradient from '../../components/GradientWrapper';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import NoConnection from '../../components/NoConnection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../config/appConfig';
import * as apiService from '../../utils/apiService';
import * as counterService from '../../utils/counterService';
import { useLanguage } from '../../context/LanguageContext';
import profileInfoContent from '../../config/profileInfoContent';
import { buildRamRepetitionHtml, generateAndSaveRamPdfs, planRamRepetitionParts, RAM_PER_PDF } from '../../utils/pdfReportService';
import moment from 'moment';
import appJson from '../../../app.json';

// Real build version (from app.json at build time) so users/admins can confirm which
// build is actually installed — the old hardcoded "1.0.0" made that impossible to verify.
const APP_VERSION = `${appJson?.expo?.version || '1.0.0'}${appJson?.expo?.android?.versionCode ? ` (build ${appJson.expo.android.versionCode})` : ''}`;

export default function ProfileScreen({ navigation, onLogout }) {
  const { t, lang, toggleLanguage } = useLanguage();
  const { width: windowWidth, fontScale = 1 } = useWindowDimensions();
  const isLargeFont = fontScale >= 1.2;
  const shouldStackProfileActions = isLargeFont || windowWidth < 380;
  const infoContent = profileInfoContent[lang] || profileInfoContent.en;
  const [user, setUser] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState('06:00');
  const [infoModal, setInfoModal] = useState(null); // 'about' | 'terms' | 'privacy' | null
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [generatingRamPdf, setGeneratingRamPdf] = useState(false);
  const [pdfPeriod, setPdfPeriod] = useState('all'); // 'today' | 'week' | 'month' | 'year' | 'all'
  const [pdfStage, setPdfStage] = useState(null); // null | 'preparing' | 'building' | 'sharing'
  const [pdfStartedAt, setPdfStartedAt] = useState(null);
  const [pdfElapsed, setPdfElapsed] = useState(0);
  const [pdfLastResult, setPdfLastResult] = useState(null); // { ok, filename?, durationSec?, error? }

  // Tick the elapsed counter while a PDF is being built so the user sees progress.
  useEffect(() => {
    if (!pdfStage || !pdfStartedAt) return undefined;
    const tick = () => setPdfElapsed((Date.now() - pdfStartedAt) / 1000);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [pdfStage, pdfStartedAt]);

  // Compute totalCount for the chosen period.
  // Source of truth = backend `DailySummary` (same table the admin's chant-summary report aggregates),
  // so the user's PDF count exactly matches what the admin sees for them in the same period.
  // Falls back to local count history only when the backend is unreachable (offline).
  // Returns { count, periodStart, periodEnd, label, source: 'backend' | 'local' | 'all-time' }.
  const computePeriodCount = async (filter, fallbackTotal) => {
    if (filter === 'all') {
      return {
        count: Number(fallbackTotal || 0),
        periodStart: null,
        periodEnd: null,
        label: t('profile.periodAll') || 'All Time',
        source: 'all-time',
      };
    }
    const now = moment();
    let start;
    let end = now.clone().endOf('day');
    let label;
    if (filter === 'today') {
      start = now.clone().startOf('day');
      label = t('profile.periodToday') || 'Today';
    } else if (filter === 'week') {
      start = now.clone().isoWeekday(1).startOf('day'); // Monday-start ISO week
      label = t('profile.periodWeek') || 'This Week';
    } else if (filter === 'month') {
      start = now.clone().startOf('month');
      label = t('profile.periodMonth') || 'This Month';
    } else {
      start = now.clone().startOf('year');
      label = t('profile.periodYear') || 'This Year';
    }
    const days = Math.max(1, end.diff(start, 'days') + 1);
    const startStr = start.format('YYYY-MM-DD');
    const endStr = end.format('YYYY-MM-DD');

    // Primary path: backend DailySummary (canonical, matches admin view).
    try {
      const res = await apiService.getDailySummary(days + 1);
      const summaries = Array.isArray(res?.summaries) ? res.summaries : [];
      const count = summaries.reduce((sum, s) => {
        const d = s?.date;
        if (!d) return sum;
        if (d >= startStr && d <= endStr) return sum + Number(s.dailyCount || 0);
        return sum;
      }, 0);
      return {
        count,
        periodStart: startStr,
        periodEnd: endStr,
        label,
        source: 'backend',
      };
    } catch (_) {
      // No local fallback — the PDF must reflect the backend exactly. If the backend is
      // unreachable, fail so the caller shows an error rather than a divergent local count.
      const err = new Error('BACKEND_UNREACHABLE');
      err.isConnection = true;
      throw err;
    }
  };

  const PERIOD_OPTIONS = [
    { id: 'today', i18n: 'periodToday', fallback: 'Today' },
    { id: 'week', i18n: 'periodWeek', fallback: 'This Week' },
    { id: 'month', i18n: 'periodMonth', fallback: 'This Month' },
    { id: 'year', i18n: 'periodYear', fallback: 'This Year' },
    { id: 'all', i18n: 'periodAll', fallback: 'All Time' },
  ];

  const stageLabel = (stage) => {
    if (stage === 'preparing') return t('pdf.stagePreparing') || 'Preparing data...';
    if (stage === 'building') return t('pdf.stageBuilding') || 'Building PDF...';
    if (stage === 'sharing') return t('pdf.stageSharing') || 'Opening share...';
    return '';
  };
  const elapsedLabel = (sec) => {
    const n = Math.max(0, Math.floor(sec));
    const tpl = t('pdf.elapsedSeconds') || '{n}s';
    return tpl.replace('{n}', String(n));
  };

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

  const handleEditName = () => {
    setEditName(user?.name || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Invalid', 'Name cannot be empty');
      return;
    }
    if (trimmed === user?.name) {
      setEditingName(false);
      return;
    }
    try {
      setSavingName(true);
      await apiService.updateUserProfile(trimmed, user?.email, user?.mobile);
      setUser(prev => ({ ...prev, name: trimmed }));
      await AsyncStorage.setItem('localUser', JSON.stringify({ ...user, name: trimmed }));
      setEditingName(false);
    } catch (error) {
      console.error('Update name error:', error);
      Alert.alert('Error', 'Failed to update name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleDownloadRamPdf = async () => {
    if (generatingRamPdf) return;
    setGeneratingRamPdf(true);
    setPdfLastResult(null);
    const startedAt = Date.now();
    setPdfStartedAt(startedAt);
    setPdfStage('preparing');
    // Yield so React paints the spinner + stage label before the synchronous build runs.
    await new Promise((r) => setTimeout(r, 0));
    try {
      // Prefer the freshest data: state (refreshed on focus) → AsyncStorage → empty placeholder.
      let profile = user;
      if (!profile) {
        try {
          const cached = await AsyncStorage.getItem('localUser');
          if (cached) profile = JSON.parse(cached);
        } catch (_) {}
      }
      // All-time baseline = fresh BACKEND total (single source of truth, matches admin).
      // No local fallback — if the backend is unreachable, computePeriodCount throws below
      // and we show an error rather than a divergent local number.
      let allTimeTotal = Number(profile?.totalCount || 0);
      try {
        const ds = await counterService.getDisplayStats();
        if (ds.ok) allTimeTotal = ds.total;
      } catch (_) {}
      // Apply the user's period filter on top (backend-sourced; throws if offline).
      const period = await computePeriodCount(pdfPeriod, allTimeTotal);
      const totalCount = Number(period.count || 0);
      const usedLocalFallback = false;

      const safeName = profile?.name || 'User';
      const safeMobile = profile?.mobile || '';
      const safeEmail = profile?.email || '';
      const userId = profile?._id || profile?.id || profile?.userId || safeMobile;

      setPdfStage('building');
      await new Promise((r) => setTimeout(r, 0));
      const translations = {
        ramNamPdfTitle: t('admin.ramNamPdfTitle') || 'Ram Naam Repetition Report',
        ramNamCumulative: t('admin.ramNamCumulative') || 'Cumulative — All Users',
        ramNamTruncated:
          t('admin.ramNamTruncated') ||
          'This section\'s render reached the page limit at {rendered} of {original} राम (full count preserved in data).',
        cumulativeSampleNote:
          t('pdf.cumulativeSampleNote') ||
          'OVERVIEW SAMPLE: showing first {rendered} of {original} system-wide राम. Each user\'s full count appears in their own section below.',
        totalUsers: t('admin.totalUsers') || 'Total Users',
        totalCounts: t('admin.totalCounts') || t('admin.totalCount') || 'Total Counts',
        colMobile: t('admin.colMobile') || 'Mobile',
        colEmail: t('admin.colEmail') || 'Email',
        colPeriod: t('admin.colPeriod') || 'Period',
        reportScope: t('admin.reportScope') || 'Scope',
        scopeAllUsers: t('admin.scopeAllUsers') || 'All Users',
        scopeSingleUser: t('admin.scopeSingleUser') || 'Single User',
        reportFooterGenerated: t('admin.reportFooterGenerated') || 'Generated',
        noDataForPeriod: t('admin.noDataForPeriod') || 'No data for this period',
      };

      const baseRow = {
        userId: String(userId),
        name: safeName,
        mobile: safeMobile,
        email: safeEmail,
        totalCount,
        buckets: [],
      };
      // The 10K split is an Android printToFileAsync memory safeguard. The browser's
      // print engine has no such limit (and multiple print windows get popup-blocked),
      // so on WEB we render the FULL count in one document; on native we split.
      const perPdf = Platform.OS === 'web' ? Math.max(totalCount, 1) : RAM_PER_PDF;
      // Write EVERY राम: split into multiple PDFs only when the count exceeds one PDF's
      // safe size. Normal counts → 1 file; large yearly counts → a few files, no truncation.
      const planned = planRamRepetitionParts([baseRow], perPdf);
      const totalParts = Math.max(1, planned.length);
      const meta = {
        generatedAt: new Date().toISOString(),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      };
      const appTitleBase = `${t('appName') || 'Shri Ram Nam Bank'} — ${period.label}`;
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const slug = (safeMobile || safeName).replace(/[^\w]+/g, '_').slice(0, 40) || 'user';

      const htmlParts = (planned.length ? planned : [{ rows: [baseRow] }]).map((part, i) => ({
        html: buildRamRepetitionHtml({
          scope: 'single',
          meta,
          totals: { totalCount },
          rows: part.rows,
          translations,
          appTitle: appTitleBase,
          adminEmail: '',
          batchInfo: totalParts > 1 ? { number: i + 1, total: totalParts } : null,
        }),
        filename: totalParts > 1
          ? `ram-naam-${slug}-${pdfPeriod}-part${i + 1}of${totalParts}-${stamp}.pdf`
          : `ram-naam-${slug}-${pdfPeriod}-${stamp}.pdf`,
      }));

      setPdfStage('sharing');
      await new Promise((r) => setTimeout(r, 0));
      const result = await generateAndSaveRamPdfs(htmlParts);
      const savedCount = result?.saved?.length || totalParts;
      setPdfLastResult({
        ok: true,
        filename: htmlParts[0]?.filename,
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
        totalCount,
        fromLocal: usedLocalFallback,
        partsCount: savedCount,
      });
      // Clear confirmation so the user sees the download actually happened.
      if (Platform.OS !== 'web' && result?.mode === 'saved') {
        const savedMsg = (t('profile.ramNamPdfSaved') || 'Saved {n} PDF(s) to your chosen folder. Total: {count} राम.')
          .replace('{n}', String(savedCount))
          .replace('{count}', Number(totalCount).toLocaleString('en-IN'));
        Alert.alert(t('profile.ramNamPdfButton') || 'राम PDF', savedMsg);
      }
    } catch (error) {
      const msg = error?.message || t('profile.ramNamPdfError') || 'Failed to build PDF';
      setPdfLastResult({ ok: false, error: msg, durationSec: ((Date.now() - startedAt) / 1000).toFixed(1) });
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(t('profile.ramNamPdfError') || 'Error', msg);
    } finally {
      setGeneratingRamPdf(false);
      setPdfStage(null);
      setPdfStartedAt(null);
      setPdfElapsed(0);
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

  const formatJoinDate = (raw) => {
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '';
      return typeof d.toLocaleDateString === 'function' ? d.toLocaleDateString() : d.toISOString().slice(0, 10);
    } catch {
      return '';
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
        {/* Screen Header */}
        <View style={styles.screenHeader}>
          <Text style={styles.userGreeting}>{t('namaste')}, {user.name || 'User'} 🙏</Text>
        </View>

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
                {user.name ? String(user.name).charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          </View>
          <Text style={styles.userName}>{user.name || 'User'}</Text>
          <Text style={styles.userPhone}>{user.phoneNumber || user.mobile}</Text>
          <Text style={styles.joinedDate}>
            {t('profile.memberSince')} {formatJoinDate(user.createdAt || user.registeredAt || Date.now())}
          </Text>
        </LinearGradient>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.account')}</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>👤</Text>
                <Text style={styles.infoLabel}>{t('profile.fullName')}</Text>
              </View>
              {editingName ? (
                <View style={[styles.editNameRow, shouldStackProfileActions && styles.editNameRowStacked]}>
                  <TextInput
                    style={[styles.editNameInput, shouldStackProfileActions && styles.editNameInputStacked]}
                    value={editName}
                    onChangeText={setEditName}
                    autoFocus
                    maxLength={50}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveName}
                  />
                  <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={styles.editNameBtn}>
                    <Text style={styles.editNameBtnText}>{savingName ? '...' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)} style={styles.editNameCancelBtn}>
                    <Text style={styles.editNameCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={handleEditName} style={styles.editableValue}>
                  <Text style={styles.infoValue}>{user.name}</Text>
                  <Ionicons name="pencil-outline" size={14} color={colors.lightGray} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>📱</Text>
                <Text style={styles.infoLabel}>{t('profile.phone')}</Text>
              </View>
              <Text style={styles.infoValue}>{user.phoneNumber || user.mobile}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>🔖</Text>
                <Text style={styles.infoLabel}>{t('profile.accountId')}</Text>
              </View>
              <Text style={[styles.infoValue, styles.idValue]}>
                {user._id ? String(user._id).substring(0, 8) + '...' : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.preferences')}</Text>
          <View style={styles.card}>
            <View style={styles.preferenceRow}>
              <View>
                <Text style={styles.preferenceLabel}>{t('profile.dailyNotifications')}</Text>
                <Text style={styles.preferenceSubtext}>
                  {t('profile.getReminded')}
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
                    <Text style={styles.infoLabel}>{t('profile.reminderTime')}</Text>
                  </View>
                  <Text style={styles.infoValue}>{dailyReminderTime}</Text>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.preferenceRow}>
              <View>
                <Text style={styles.preferenceLabel}>{t('profile.language')}</Text>
                <Text style={styles.preferenceSubtext}>
                  {t('profile.languageHint')}
                </Text>
              </View>
              <TouchableOpacity style={styles.langToggle} onPress={toggleLanguage}>
                <Text style={[styles.langOption, lang === 'en' && styles.langOptionActive]}>EN</Text>
                <Text style={styles.langSeparator}>|</Text>
                <Text style={[styles.langOption, lang === 'hi' && styles.langOptionActive]}>हि</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* About App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.about')}</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>🙏</Text>
                <Text style={styles.infoLabel}>{t('profile.appName')}</Text>
              </View>
              <Text style={styles.infoValue}>{t('appName')}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>📦</Text>
                <Text style={styles.infoLabel}>{t('profile.version')}</Text>
              </View>
              <Text style={styles.infoValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>✨</Text>
                <Text style={styles.infoLabel}>{t('profile.purpose')}</Text>
              </View>
              <Text style={[styles.infoValue, styles.purposeText]}>
                {t('profile.purposeText')}
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
                <Text style={styles.linkText}>{t('profile.aboutUs')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.lightGray} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.linkRow} onPress={() => setInfoModal('terms')}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>📋</Text>
                <Text style={styles.linkText}>{t('profile.terms')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.lightGray} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.linkRow} onPress={() => setInfoModal('privacy')}>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoIcon}>🔐</Text>
                <Text style={styles.linkText}>{t('profile.privacy')}</Text>
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
                  {infoModal ? (infoContent?.[infoModal]?.title || '') : ''}
                </Text>
                <TouchableOpacity onPress={() => setInfoModal(null)} style={styles.modalClose}>
                  <Ionicons name="close" size={24} color={colors.white} />
                </TouchableOpacity>
              </LinearGradient>

              {/* Modal Body */}
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {infoModal && (infoContent?.[infoModal]?.sections || []).map((section, idx) => (
                  <View key={idx} style={styles.modalSection}>
                    <Text style={styles.modalSectionHeading}>{section.heading}</Text>
                    <Text style={styles.modalSectionBody}>{section.body}</Text>
                  </View>
                ))}
                <View style={styles.modalFooter}>
                  <Text style={styles.modalFooterText}>{t('appName')} • Version {APP_VERSION}</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Period filter for the राम PDF */}
        <Text style={styles.periodLabel}>{t('profile.periodLabel') || 'Filter period'}</Text>
        <View style={styles.periodChipRow}>
          {PERIOD_OPTIONS.map((opt) => {
            const active = pdfPeriod === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => setPdfPeriod(opt.id)}
                disabled={generatingRamPdf}
              >
                <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                  {t('profile.' + opt.i18n) || opt.fallback}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Download राम PDF Button */}
        <TouchableOpacity
          style={[styles.ramPdfButton, generatingRamPdf && styles.ramPdfButtonDisabled]}
          onPress={handleDownloadRamPdf}
          disabled={generatingRamPdf}
        >
          {generatingRamPdf ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={styles.logoutIcon} />
              <Text style={styles.ramPdfButtonText}>
                {stageLabel(pdfStage)} · {elapsedLabel(pdfElapsed)}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={18} color="#fff" style={styles.logoutIcon} />
              <Text style={styles.ramPdfButtonText}>{t('profile.ramNamPdfButton') || 'Download my राम PDF'}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Progress hint while generating */}
        {generatingRamPdf && (
          <View style={styles.pdfProgressBox}>
            <Text style={styles.pdfProgressHint}>
              {t('pdf.hintLargeCount') || 'Large counts may take a few seconds.'}
            </Text>
          </View>
        )}

        {/* Result summary after last run (success or failure) */}
        {!generatingRamPdf && pdfLastResult && (
          <View style={[styles.pdfResultBox, pdfLastResult.ok ? styles.pdfResultOk : styles.pdfResultErr]}>
            <Ionicons
              name={pdfLastResult.ok ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={pdfLastResult.ok ? '#138808' : '#d33'}
              style={styles.logoutIcon}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfResultText} numberOfLines={2}>
                {pdfLastResult.ok
                  ? `${pdfLastResult.filename} · ${pdfLastResult.durationSec}s · ${(pdfLastResult.totalCount || 0).toLocaleString('en-IN')} राम`
                  : `${t('profile.ramNamPdfError') || 'Failed'}: ${pdfLastResult.error}`}
              </Text>
              {pdfLastResult.ok && pdfLastResult.fromLocal && (
                <Text style={styles.pdfResultHint} numberOfLines={2}>
                  {t('profile.pdfFromLocalCache') || 'Counts loaded from local cache (offline). They will match the admin view once you reconnect.'}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} style={styles.logoutIcon} />
          <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* Spiritual Message */}
        <LinearGradient
          colors={['#138808', '#0E6B06']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.spiritualCard}
        >
          <Text style={styles.spiritualTitle}>{t('profile.blessingTitle')}</Text>
          <Text style={styles.spiritualText}>
            {t('profile.blessingText')} 🙏
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
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  userGreeting: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  userPhone: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  joinedDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
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
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '100%',
  },
  infoIcon: {
    fontSize: 17,
    marginRight: spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGray,
    flexShrink: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: appConfig.colors.primary,
    maxWidth: '100%',
    textAlign: 'right',
    flexShrink: 1,
  },
  idValue: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  purposeText: {
    maxWidth: '55%',
    textAlign: 'right',
  },
  editableValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  editNameRowStacked: {
    justifyContent: 'flex-start',
  },
  editNameInput: {
    borderWidth: 1,
    borderColor: appConfig.colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 14,
    color: colors.darkGray,
    minWidth: 100,
    maxWidth: 140,
  },
  editNameInputStacked: {
    minWidth: '100%',
    maxWidth: '100%',
  },
  editNameBtn: {
    marginLeft: 8,
    backgroundColor: appConfig.colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  editNameBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  editNameCancelBtn: {
    marginLeft: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  editNameCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightGray,
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    maxWidth: '100%',
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // Language toggle
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  langOption: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightGray,
    paddingHorizontal: 6,
  },
  langOptionActive: {
    color: appConfig.colors.primary,
    fontWeight: '800',
  },
  langSeparator: {
    fontSize: 14,
    color: colors.borderGray,
  },

  // Links
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
    flexShrink: 1,
  },

  // Period filter chips (above the राम PDF download button)
  periodLabel: { fontSize: 11, fontWeight: '700', color: '#6B6B6B', marginTop: spacing.md, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  periodChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  periodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  periodChipActive: {
    backgroundColor: appConfig.colors.primary,
    borderColor: appConfig.colors.primary,
  },
  periodChipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  periodChipTextActive: { color: '#fff' },

  // Ram PDF download (matches logoutButton dimensions for visual harmony)
  ramPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appConfig.colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    ...shadowStyles.light,
  },
  ramPdfButtonDisabled: {
    opacity: 0.85,
  },
  ramPdfButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  pdfProgressBox: {
    backgroundColor: '#FFF8F0',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#FFD8A8',
  },
  pdfProgressHint: {
    fontSize: 11,
    color: '#5a3a0f',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  pdfResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
  },
  pdfResultOk: { backgroundColor: '#E8F5E9', borderColor: '#9DCB9F' },
  pdfResultErr: { backgroundColor: '#FDECEA', borderColor: '#F1B0B7' },
  pdfResultText: { flex: 1, fontSize: 12, color: '#333' },
  pdfResultHint: { fontSize: 10, color: '#8a5a1a', marginTop: 2, fontStyle: 'italic' },

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
    textAlign: 'center',
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
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    flex: 1,
    flexShrink: 1,
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
    textAlign: 'center',
  },
  spiritualText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    lineHeight: 20,
  },
});



