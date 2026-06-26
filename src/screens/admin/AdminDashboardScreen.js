import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, TextInput, Modal, Platform, Alert, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import appConfig from '../../config/appConfig';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as apiService from '../../utils/apiService';
import { suggestEnglishSlogan, shouldReplaceWithAutoEnglish } from '../../utils/sloganTranslation';
import { useLanguage } from '../../context/LanguageContext';
import ReportsPanel from './ReportsPanel';
import { APP_VERSION } from '../../config/appVersion';
import { activityInfo } from '../../config/activityLabels';

const getUserId = (user) => user?._id || user?.id || user?.userId || null;
const getStatusColor = (status) => status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#FF8C00';
const safe = (v) => String(v || '');
const byDateDesc = (a, b) => (safe(a.date) < safe(b.date) ? 1 : -1);
const ACT_PAGE_SIZE = 10; // activities fetched per "More" click (one API call each)
const byTsDesc = (a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0);
const getTimeZoneLabel = () => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions()?.timeZone || 'Asia/Kolkata';
    const parts = new Intl.DateTimeFormat('en-IN', { timeZoneName: 'short' }).formatToParts(new Date());
    const shortName = parts.find((part) => part.type === 'timeZoneName')?.value;
    return shortName && shortName !== zone ? `${shortName} (${zone})` : zone;
  } catch (error) {
    return 'Asia/Kolkata';
  }
};
const TIMEZONE_LABEL = getTimeZoneLabel();
const fmtDate = (v) => v && moment(v).isValid() ? moment(v).format('DD MMM YYYY') : '-';
const fmtTime = (v) => v && moment(v).isValid() ? `${moment(v).format('hh:mm A')} ${TIMEZONE_LABEL}` : '-';
const fmtDateTime = (v) => v && moment(v).isValid() ? `${moment(v).format('DD MMM YYYY, hh:mm A')} ${TIMEZONE_LABEL}` : '-';
const fmtDuration = (s) => {
  if (s == null || Number.isNaN(Number(s))) return '-';
  const total = Math.max(0, Number(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const deriveDaily = (activities = []) => {
  const map = new Map();
  activities.forEach((activity) => {
    const ts = activity.timestamp || activity.createdAt;
    if (!ts || !moment(ts).isValid()) return;
    const date = moment(ts).format('YYYY-MM-DD');
    const row = map.get(date) || { date, dailyCount: 0, firstCountAt: null, lastCountAt: null, activeDurationSeconds: 0 };
    if (activity.activityType === 'COUNT_INCREMENT') {
      row.dailyCount += Number(activity.count || 0);
      if (!row.firstCountAt || moment(ts).isBefore(row.firstCountAt)) row.firstCountAt = moment(ts).toISOString();
      if (!row.lastCountAt || moment(ts).isAfter(row.lastCountAt)) row.lastCountAt = moment(ts).toISOString();
    }
    map.set(date, row);
  });
  return Array.from(map.values()).map((row) => {
    const start = row.firstCountAt ? new Date(row.firstCountAt).getTime() : null;
    const end = row.lastCountAt ? new Date(row.lastCountAt).getTime() : null;
    return { ...row, activeDurationSeconds: start != null && end != null && end >= start ? Math.floor((end - start) / 1000) : 0 };
  }).filter((row) => row.dailyCount > 0 || row.firstCountAt || row.lastCountAt).sort(byDateDesc);
};

export default function AdminDashboardScreen({ navigation, onLogout }) {
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedTab, setSelectedTab] = useState('stats');
  const [selectedApp, setSelectedApp] = useState('all');
  const [appsList, setAppsList] = useState([{ id: 'all', name: t('admin.allApps'), userCount: 0 }]);
  const [slogans, setSlogans] = useState([]);
  const [sloganModal, setSloganModal] = useState(false);
  const [newSloganHi, setNewSloganHi] = useState('');
  const [newSloganEn, setNewSloganEn] = useState('');
  const [lastAutoSloganEn, setLastAutoSloganEn] = useState('');
  const [savingSlogan, setSavingSlogan] = useState(false);
  const [editingSlogan, setEditingSlogan] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [editModal, setEditModal] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deletedModal, setDeletedModal] = useState(false);
  const [deletedList, setDeletedList] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNext, setPwdNext] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  // Paginated activities for the selected user (10 per page, one API call per "More").
  const [actItems, setActItems] = useState([]);
  const [actPage, setActPage] = useState(1);
  const [actTotalPages, setActTotalPages] = useState(1);
  const [actLoadingMore, setActLoadingMore] = useState(false);
  const [activityUserQuery, setActivityUserQuery] = useState('');
  const [selectedActivityType, setSelectedActivityType] = useState('');
  const [selectedActivityDateFilter, setSelectedActivityDateFilter] = useState('all');
  const [selectedActivityUser, setSelectedActivityUser] = useState(null);
  const [activityDetail, setActivityDetail] = useState(null);
  const [activityDetailLoading, setActivityDetailLoading] = useState(false);
  const [activityDetailError, setActivityDetailError] = useState('');

  const appFilter = selectedApp === 'all' ? null : selectedApp;
  const appNameMap = { 'ram-bank': t('appName'), 'krishna-bank': 'कृष्ण Bank', 'hanuman-bank': 'हनुमान Bank', 'shiva-bank': 'शिव Bank', 'ganesh-bank': 'गणेश Bank' };

  const loadDashboardData = async () => {
    try {
      const sloganAppId = appFilter || appConfig.appId;
      const [statsData, usersData, appsData, sloganData] = await Promise.all([
        apiService.getAdminStats(appFilter),
        apiService.getAllUsers(100, 1, '', appFilter),
        apiService.getApps(),
        apiService.getAdminSlogans(sloganAppId),
      ]);
      setStats(statsData?.stats || null);
      setUsers(Array.isArray(usersData?.users) ? usersData.users : []);
      setSlogans(Array.isArray(sloganData?.slogans) ? sloganData.slogans : []);
      if (appsData?.success && Array.isArray(appsData.apps)) {
        const totalUsers = appsData.apps.reduce((sum, app) => sum + Number(app.userCount || 0), 0);
        setAppsList([{ id: 'all', name: t('admin.allApps'), userCount: totalUsers }, ...appsData.apps.map((app) => ({ id: app.appId, name: appNameMap[app.appId] || app.appId, userCount: Number(app.userCount || 0) }))]);
      }
    } catch (error) {
      console.error('🔴 Failed to load dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshUsers = async () => {
    const [usersData, statsData] = await Promise.all([apiService.getAllUsers(100, 1, '', appFilter), apiService.getAdminStats(appFilter)]);
    setUsers(Array.isArray(usersData?.users) ? usersData.users : []);
    setStats(statsData?.stats || null);
  };

  const loadActivityUserDetail = async (userLike) => {
    const userId = getUserId(userLike);
    if (!userId) return;
    setActivityDetailLoading(true);
    setActivityDetailError('');
    try {
      // Activities are paginated 10-at-a-time from the backend (one API call per page) so
      // the list loads fast and "More" fetches the next 10 older on demand.
      const [detailResponse, activityResponse] = await Promise.all([
        apiService.getUserDetails(userId),
        apiService.getAllActivities(ACT_PAGE_SIZE, 1, selectedActivityType, userId, appFilter),
      ]);
      const user = { ...userLike, ...(apiService.extractAdminUserPayload(detailResponse) || {}) };
      const detailRecent = apiService.extractAdminRecentActivities(detailResponse);
      const daily = (apiService.extractAdminDailySummaries(detailResponse).length > 0 ? apiService.extractAdminDailySummaries(detailResponse) : deriveDaily(detailRecent)).sort(byDateDesc);
      setActivityDetail({ user, dailySummaries: daily });
      const page1 = (Array.isArray(activityResponse?.activities) ? activityResponse.activities : []).slice().sort(byTsDesc);
      setActItems(page1);
      setActPage(1);
      setActTotalPages(activityResponse?.pagination?.totalPages || 1);
    } catch (error) {
      console.error('🔴 Failed to load activity detail:', error);
      setActivityDetail(null);
      setActivityDetailError(error?.response?.data?.message || (lang === 'hi' ? 'यूजर विवरण लोड नहीं हो सके।' : 'Failed to load user details.'));
    } finally {
      setActivityDetailLoading(false);
    }
  };

  // "More": fetch the NEXT page of older activities (one API call) and append. Keeps the
  // list small/fast — we only load 10 more on demand, back to the beginning.
  const loadMoreActivities = async () => {
    if (actLoadingMore || actPage >= actTotalPages) return;
    const userId = getUserId(selectedActivityUser);
    if (!userId) return;
    setActLoadingMore(true);
    try {
      const next = actPage + 1;
      const res = await apiService.getAllActivities(ACT_PAGE_SIZE, next, selectedActivityType, userId, appFilter);
      const more = Array.isArray(res?.activities) ? res.activities : [];
      setActItems((prev) => {
        const map = new Map(prev.map((a) => [a._id || a.id || `${a.activityType}-${a.timestamp}`, a]));
        more.forEach((a) => map.set(a._id || a.id || `${a.activityType}-${a.timestamp}`, a));
        return Array.from(map.values()).sort(byTsDesc);
      });
      setActPage(next);
      setActTotalPages(res?.pagination?.totalPages || actTotalPages);
    } catch (_) { /* keep what we have */ } finally {
      setActLoadingMore(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, [selectedApp]);
  useEffect(() => { setActItems([]); setActPage(1); setActTotalPages(1); if (selectedActivityUser) loadActivityUserDetail(selectedActivityUser); else { setActivityDetail(null); setActivityDetailError(''); } }, [selectedActivityUser, selectedApp, selectedActivityType]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
    if (selectedActivityUser) loadActivityUserDetail(selectedActivityUser);
  };

  const isToday = (value) => value ? moment(value).isSame(moment(), 'day') : false;
  const openUsersShortcut = (filter) => { setSelectedUserFilter(filter); setSelectedTab('users'); setSearchTerm(''); };
  const openActivitiesShortcut = ({ type = '', dateFilter = 'all', user = null } = {}) => { setSelectedTab('activities'); setSelectedActivityType(type); setSelectedActivityDateFilter(dateFilter); if (user) { setSelectedActivityUser(user); setActivityUserQuery(''); } };
  const clearUserShortcut = () => { setSelectedUserFilter('all'); setSearchTerm(''); };
  const clearActivityShortcut = () => { setSelectedActivityType(''); setSelectedActivityDateFilter('all'); };
  const openUserActivityView = (userLike) => { const match = users.find((user) => getUserId(user) === getUserId(userLike)) || userLike; setSelectedTab('activities'); setSelectedActivityUser(match); setActivityUserQuery(''); };

  const handleAdminLogout = () => {
    const doLogout = async () => {
      try {
        await apiService.logoutAdmin();
      } catch (e) {
        console.warn('Admin token cleanup failed, proceeding with logout:', e);
      }
      if (typeof onLogout === 'function') onLogout();
      else navigation.replace('Login');
    };
    if (Platform.OS === 'web') { if (window.confirm('Logout from admin panel?')) doLogout(); }
    else { Alert.alert('Logout', 'Logout from admin panel?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: doLogout }]); }
  };
  const handleAdminBack = () => {
    if (sloganModal) {
      closeSloganModal();
      return;
    }

    if (editModal) {
      setEditModal(null);
      return;
    }

    if (selectedActivityUser) {
      setSelectedActivityUser(null);
      return;
    }

    if (selectedTab !== 'stats') {
      setSelectedTab('stats');
      clearUserShortcut();
      clearActivityShortcut();
      setActivityUserQuery('');
      return;
    }
      return;
  };
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleAdminBack();
      return true;
    });

    return () => subscription.remove();
  }, [handleAdminBack]);
  const handleUpdateStatus = async (userId, status) => { try { await apiService.updateUserStatus(userId, status); await refreshUsers(); if (selectedActivityUser && getUserId(selectedActivityUser) === userId) setSelectedActivityUser((prev) => ({ ...prev, status })); } catch (error) { console.error('🔴 Failed to update user status:', error); } };
  const handleEditSave = async () => {
    if (!editModal?.name?.trim() || !editModal?.mobile?.trim()) { if (Platform.OS === 'web') window.alert('Name and mobile are required'); else Alert.alert('Error', 'Name and mobile are required'); return; }
    setEditLoading(true);
    try {
      await apiService.editUser(editModal.userId, { name: editModal.name.trim(), mobile: editModal.mobile.trim(), email: editModal.email?.trim() || null });
      // If the admin changed the राम count, apply it via the audited set-count endpoint
      // (which also backfills DailySummary so reports stay consistent).
      const newCount = Math.floor(Number(editModal.count));
      if (Number.isFinite(newCount) && newCount >= 0 && newCount !== Number(editModal.originalCount || 0)) {
        await apiService.setUserCount(editModal.userId, newCount, 'Admin manual update');
      }
      setEditModal(null); await refreshUsers();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update user';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Error', msg);
    } finally { setEditLoading(false); }
  };
  const handleDeleteUser = (userId, userName) => {
    const doDelete = async () => { try { await apiService.deleteUser(userId); if (selectedActivityUser && getUserId(selectedActivityUser) === userId) setSelectedActivityUser(null); await refreshUsers(); } catch (error) { if (Platform.OS === 'web') window.alert('Failed to delete user'); else Alert.alert('Error', 'Failed to delete user'); } };
    if (Platform.OS === 'web') { if (window.confirm(`Delete "${userName}"? They will be hidden from lists, but their data is preserved and can be restored.`)) doDelete(); }
    else { Alert.alert('Delete User', `Delete "${userName}"? They'll be hidden from lists, but their data is preserved and can be restored.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: doDelete }]); }
  };
  const openDeletedUsers = async () => {
    setDeletedModal(true); setDeletedLoading(true);
    try { const res = await apiService.getDeletedUsers(appFilter); setDeletedList(Array.isArray(res?.users) ? res.users : []); }
    catch (_) { setDeletedList([]); }
    finally { setDeletedLoading(false); }
  };
  const handleRestoreUser = async (userId) => {
    try { await apiService.restoreUser(userId); await openDeletedUsers(); await refreshUsers(); }
    catch (error) { if (Platform.OS === 'web') window.alert('Failed to restore user'); else Alert.alert('Error', 'Failed to restore user'); }
  };
  const openPwdModal = () => { setPwdCurrent(''); setPwdNext(''); setPwdConfirm(''); setPwdModal(true); };
  const notify = (title, message) => { if (Platform.OS === 'web') window.alert(`${title}\n${message}`); else Alert.alert(title, message); };
  const handleChangePassword = async () => {
    if (!pwdCurrent || !pwdNext || !pwdConfirm) { notify(lang === 'hi' ? 'त्रुटि' : 'Error', lang === 'hi' ? 'सभी फ़ील्ड भरें।' : 'Please fill all fields.'); return; }
    if (pwdNext.length < 6) { notify(lang === 'hi' ? 'त्रुटि' : 'Error', lang === 'hi' ? 'नया पासवर्ड कम से कम 6 अक्षरों का हो।' : 'New password must be at least 6 characters.'); return; }
    if (pwdNext !== pwdConfirm) { notify(lang === 'hi' ? 'त्रुटि' : 'Error', lang === 'hi' ? 'नया पासवर्ड और पुष्टि मेल नहीं खाते।' : 'New password and confirmation do not match.'); return; }
    setPwdLoading(true);
    try {
      await apiService.changeAdminPassword(pwdCurrent, pwdNext);
      setPwdModal(false);
      notify(lang === 'hi' ? 'सफल' : 'Success', lang === 'hi' ? 'एडमिन पासवर्ड बदल दिया गया।' : 'Admin password changed successfully.');
    } catch (error) {
      notify(lang === 'hi' ? 'त्रुटि' : 'Error', apiService.parseApiError ? apiService.parseApiError(error) : (error?.response?.data?.message || (lang === 'hi' ? 'पासवर्ड बदलने में विफल।' : 'Failed to change password.')));
    } finally { setPwdLoading(false); }
  };
  const openCreateSloganModal = () => { setEditingSlogan(null); setNewSloganHi(''); setNewSloganEn(''); setLastAutoSloganEn(''); setSloganModal(true); };
  const closeSloganModal = () => { setSloganModal(false); setEditingSlogan(null); setNewSloganHi(''); setNewSloganEn(''); setLastAutoSloganEn(''); };
  const handleEditSlogan = (slogan) => { const hi = slogan.hi || ''; const autoEnglish = suggestEnglishSlogan(hi); setEditingSlogan(slogan); setNewSloganHi(hi); setNewSloganEn(slogan.en || autoEnglish); setLastAutoSloganEn(autoEnglish); setSloganModal(true); };
  const handleHindiSloganChange = (value) => { const autoEnglish = suggestEnglishSlogan(value); setNewSloganHi(value); setNewSloganEn((currentEnglish) => shouldReplaceWithAutoEnglish(currentEnglish, lastAutoSloganEn) ? autoEnglish : currentEnglish); setLastAutoSloganEn(autoEnglish); };
  const handleEnglishSloganChange = (value) => { setNewSloganEn(value); };
  const handleAutoFillEnglish = () => { const autoEnglish = suggestEnglishSlogan(newSloganHi); setNewSloganEn(autoEnglish); setLastAutoSloganEn(autoEnglish); };
  const getSloganApiErrorMessage = (error, mode = 'save') => { const parsed = apiService.parseApiError ? apiService.parseApiError(error) : null; return parsed?.message || error?.message || (mode === 'delete' ? 'Failed to delete slogan' : 'Failed to save slogan'); };
  const handleSaveSlogan = async () => {
    const trimmedHi = newSloganHi.trim();
    const resolvedEn = (newSloganEn.trim() || suggestEnglishSlogan(trimmedHi)).trim();
    if (!trimmedHi) { Alert.alert('Error', lang === 'hi' ? 'हिंदी स्लोगन जरूरी है' : 'Hindi slogan is required'); return; }
    if (!resolvedEn) { Alert.alert('Error', lang === 'hi' ? 'अंग्रेज़ी अपने आप नहीं बन पाई। कृपया जरूरत हो तो अंग्रेज़ी लिखें।' : 'English could not be auto-filled. Please enter it manually if needed.'); return; }
    try {
      setSavingSlogan(true);
      const sloganAppId = selectedApp === 'all' ? appConfig.appId : selectedApp;
      const sloganId = editingSlogan?._id || editingSlogan?.id;
      const effectiveAppId = sloganId && editingSlogan?.appId ? editingSlogan.appId : sloganAppId;
      const result = sloganId ? await apiService.updateAdminSlogan(sloganId, trimmedHi, resolvedEn, effectiveAppId) : await apiService.addAdminSlogan(trimmedHi, resolvedEn, sloganAppId);
      setSlogans(Array.isArray(result?.slogans) ? result.slogans : []); closeSloganModal();
    } catch (error) { Alert.alert('Error', getSloganApiErrorMessage(error, 'save')); } finally { setSavingSlogan(false); }
  };
  const handleDeleteSlogan = (slogan) => {
    const sloganId = slogan?._id || slogan?.id; if (!sloganId) return;
    const doDelete = async () => { try { const sloganAppId = selectedApp === 'all' ? appConfig.appId : selectedApp; const result = await apiService.deleteAdminSlogan(sloganId, sloganAppId); setSlogans(Array.isArray(result?.slogans) ? result.slogans : []); if ((editingSlogan?._id || editingSlogan?.id) === sloganId) closeSloganModal(); } catch (error) { Alert.alert('Error', getSloganApiErrorMessage(error, 'delete')); } };
    if (Platform.OS === 'web') { if (window.confirm(t('admin.deleteSloganConfirm'))) doDelete(); }
    else { Alert.alert(t('admin.deleteSloganTitle'), t('admin.deleteSloganConfirm'), [{ text: t('profile.cancel'), style: 'cancel' }, { text: t('admin.deleteSlogan'), style: 'destructive', onPress: doDelete }]); }
  };

  const topUsers = useMemo(() => [...users].sort((a, b) => Number(b.totalCount || 0) - Number(a.totalCount || 0)).slice(0, 3), [users]);
  const filteredUsers = useMemo(() => users.filter((u) => { const matches = safe(u.name).toLowerCase().includes(searchTerm.toLowerCase()) || safe(u.email).toLowerCase().includes(searchTerm.toLowerCase()) || safe(u.mobile).toLowerCase().includes(searchTerm.toLowerCase()); if (!matches) return false; if (selectedUserFilter === 'pending') return (u.status || 'pending') === 'pending'; if (selectedUserFilter === 'activeToday') return isToday(u.lastActiveDate); return true; }), [users, searchTerm, selectedUserFilter]);
  const activityUsers = useMemo(() => users.filter((u) => { const q = activityUserQuery.trim().toLowerCase(); return !q || safe(u.name).toLowerCase().includes(q) || safe(u.mobile).toLowerCase().includes(q) || safe(u.email).toLowerCase().includes(q); }), [users, activityUserQuery]);
  const currentDaily = activityDetail?.dailySummaries || [];
  const todayTiming = useMemo(() => currentDaily.find((row) => row.date === moment().format('YYYY-MM-DD')) || null, [currentDaily]);
  const todayCount = useMemo(() => { const user = activityDetail?.user; const apiToday = user?.todayCount ?? user?.dailyCount; if (apiToday != null) return Number(apiToday || 0); const today = currentDaily.find((row) => row.date === moment().format('YYYY-MM-DD')); return Number(today?.dailyCount || 0); }, [activityDetail, currentDaily]);

  const renderStats = () => <View><View style={styles.section}><Text style={styles.title}>{t('admin.topChanters')}</Text><View style={styles.row}><View style={styles.box}><Text style={styles.emoji}>🏆</Text><Text style={styles.muted}>{t('admin.todaysBest')}</Text><Text style={styles.centerText}>{stats?.topChanterToday?.name || t('admin.noActivityToday')}</Text></View><View style={[styles.box, styles.boxGold]}><Text style={styles.emoji}>👑</Text><Text style={styles.muted}>{t('admin.allTimeBest')}</Text><Text style={styles.centerText}>{stats?.topChanterAllTime?.name || t('admin.noDataYet')}</Text></View></View></View><View style={styles.section}><Text style={styles.title}>Top 3 Users</Text>{topUsers.map((user, index) => <TouchableOpacity key={getUserId(user) || index} style={styles.userRow} onPress={() => openUserActivityView(user)}><Text style={styles.userRowName}>#{index + 1} {user.name}</Text><Text style={styles.userRowMeta}>{user.mobile || '-'} · {user.totalCount || 0}</Text></TouchableOpacity>)}</View><View style={styles.grid}><TouchableOpacity style={styles.card} onPress={() => openUsersShortcut('all')}><Text style={styles.cardValue}>{stats?.totalUsers || 0}</Text><Text style={styles.cardLabel}>{t('admin.totalUsers')}</Text></TouchableOpacity><TouchableOpacity style={styles.card} onPress={() => openUsersShortcut('pending')}><Text style={[styles.cardValue, { color: '#FF8C00' }]}>{stats?.pendingUsers || 0}</Text><Text style={styles.cardLabel}>{t('admin.pending')}</Text></TouchableOpacity><TouchableOpacity style={styles.card} onPress={() => openUsersShortcut('activeToday')}><Text style={styles.cardValue}>{stats?.activeToday || 0}</Text><Text style={styles.cardLabel}>{t('admin.activeToday')}</Text></TouchableOpacity><TouchableOpacity style={styles.card} onPress={() => openActivitiesShortcut({ type: 'COUNT_INCREMENT', dateFilter: 'today' })}><Text style={styles.cardValue}>{stats?.todayTotalCount || 0}</Text><Text style={styles.cardLabel}>{t('admin.todayCount')}</Text></TouchableOpacity></View></View>;

  const renderUsers = () => <View style={styles.section}>{selectedUserFilter !== 'all' && <View style={styles.banner}><Text style={styles.bannerText}>{lang === 'hi' ? 'फ़िल्टर लगा है' : 'Filter applied'}</Text><TouchableOpacity onPress={clearUserShortcut}><Text style={styles.link}>Clear</Text></TouchableOpacity></View>}<TextInput style={styles.input} placeholder={t('admin.searchPlaceholder')} value={searchTerm} onChangeText={setSearchTerm} /><TouchableOpacity style={styles.smallTextBtn} onPress={openDeletedUsers}><Text style={styles.link}>🗑️ {lang === 'hi' ? 'हटाए गए यूजर / इतिहास' : 'Deleted Users / History'}</Text></TouchableOpacity>{filteredUsers.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>{appConfig.text.adminScreen.noUsersMessage}</Text></View> : filteredUsers.map((user) => <View key={getUserId(user)} style={styles.panel}><View style={styles.between}><Text style={styles.name}>{user.name}</Text><View style={[styles.badge, { backgroundColor: getStatusColor(user.status) }]}><Text style={styles.badgeText}>{String(user.status || 'pending').toUpperCase()}</Text></View></View><Text style={styles.meta}>{(lang === 'hi' ? 'मोबाइल' : 'Mobile')}: {user.mobile || '-'}</Text><Text style={styles.meta}>{(lang === 'hi' ? 'ईमेल' : 'Email')}: {user.email || '-'}</Text><Text style={styles.meta}>{t('admin.totalCount')}: {user.totalCount || 0}</Text><Text style={styles.meta}>{t('admin.lastActive')}: {user.lastActiveDate ? moment(user.lastActiveDate).fromNow() : '-'}</Text><View style={styles.wrapRow}><TouchableOpacity style={styles.primaryBtn} onPress={() => openUserActivityView(user)}><Text style={styles.primaryBtnText}>{(lang === 'hi' ? 'गतिविधि देखें' : 'View Activity')}</Text></TouchableOpacity><TouchableOpacity style={styles.smallBtn} onPress={() => setEditModal({ userId: getUserId(user), name: user.name, mobile: user.mobile, email: user.email || '', count: String(user.totalCount || 0), originalCount: Number(user.totalCount || 0) })}><Text>✏️</Text></TouchableOpacity><TouchableOpacity style={styles.smallBtn} onPress={() => handleDeleteUser(getUserId(user), user.name)}><Text>🗑️</Text></TouchableOpacity></View><View style={styles.wrapRow}>{user.status !== 'approved' && <TouchableOpacity style={styles.approveBtn} onPress={() => handleUpdateStatus(getUserId(user), 'approved')}><Text style={styles.actionText}>{t('admin.approve')}</Text></TouchableOpacity>}{user.status !== 'rejected' && <TouchableOpacity style={styles.rejectBtn} onPress={() => handleUpdateStatus(getUserId(user), 'rejected')}><Text style={styles.rejectText}>{t('admin.reject')}</Text></TouchableOpacity>}</View></View>)}</View>;

  const renderSlogans = () => <View style={styles.section}><View style={styles.between}><View><Text style={styles.title}>{t('admin.slogansTitle')}</Text><Text style={styles.muted}>{t('admin.slogansHint')}</Text></View><TouchableOpacity style={styles.primaryBtn} onPress={openCreateSloganModal}><Text style={styles.primaryBtnText}>{t('admin.addSlogan')}</Text></TouchableOpacity></View>{slogans.length === 0 ? <Text style={styles.meta}>{t('admin.noSlogans')}</Text> : slogans.map((slogan, index) => <View key={slogan._id || slogan.id || index} style={styles.panel}><Text style={styles.name}>{slogan.hi}</Text><Text style={styles.meta}>{slogan.en}</Text><View style={styles.wrapRow}><TouchableOpacity style={styles.smallTextBtn} onPress={() => handleEditSlogan(slogan)}><Text style={styles.link}>{t('admin.editSlogan')}</Text></TouchableOpacity><TouchableOpacity style={styles.smallTextBtn} onPress={() => handleDeleteSlogan(slogan)}><Text style={styles.dangerLink}>{t('admin.deleteSlogan')}</Text></TouchableOpacity></View></View>)}</View>;


  const renderActivities = () => {
    if (!selectedActivityUser) {
      return <View style={styles.section}>{(selectedActivityType || selectedActivityDateFilter !== 'all') && <View style={styles.banner}><Text style={styles.bannerText}>{lang === 'hi' ? 'फ़िल्टर लगा है' : 'Filter applied'}</Text><TouchableOpacity onPress={clearActivityShortcut}><Text style={styles.link}>Clear</Text></TouchableOpacity></View>}<Text style={styles.title}>{t('admin.activitiesUsersTitle')}</Text><Text style={styles.muted}>{t('admin.activitiesUsersSubtitle')}</Text><TextInput style={styles.input} placeholder={t('admin.userFilterPlaceholder')} value={activityUserQuery} onChangeText={setActivityUserQuery} />{activityUsers.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>{t('admin.noUserMatches')}</Text></View> : activityUsers.map((user) => <TouchableOpacity key={getUserId(user)} style={styles.panel} onPress={() => openUserActivityView(user)}><View style={styles.between}><View><Text style={styles.name}>{user.name || 'Unknown User'}</Text><Text style={styles.meta}>{user.mobile || '-'}</Text></View><View style={[styles.badge, { backgroundColor: getStatusColor(user.status) }]}><Text style={styles.badgeText}>{String(user.status || 'pending').toUpperCase()}</Text></View></View><View style={styles.row}><View style={styles.statPill}><Text style={styles.statPillValue}>{user.totalCount || 0}</Text><Text style={styles.statPillLabel}>{t('admin.totalCount')}</Text></View><View style={styles.statPill}><Text style={styles.statPillValue}>{user.todayCount ?? '-'}</Text><Text style={styles.statPillLabel}>{(lang === 'hi' ? 'आज की गिनती' : 'Today Count')}</Text></View></View><Text style={styles.meta}>{t('admin.lastActive')}: {user.lastActiveDate ? moment(user.lastActiveDate).fromNow() : '-'}</Text></TouchableOpacity>)}</View>;
    }
    if (activityDetailLoading) return <View style={styles.empty}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.meta}>{t('admin.loadingUserDetails')}</Text></View>;
    if (activityDetailError) return <View style={styles.section}><TouchableOpacity style={styles.backRow} onPress={() => setSelectedActivityUser(null)}><Ionicons name="arrow-back" size={16} color={colors.primary} /><Text style={styles.link}>{t('admin.activitiesUsersTitle')}</Text></TouchableOpacity><View style={styles.empty}><Text style={styles.emptyText}>{activityDetailError}</Text></View></View>;
    const user = activityDetail?.user || selectedActivityUser;
    return <View style={styles.section}><TouchableOpacity style={styles.backRow} onPress={() => setSelectedActivityUser(null)}><Ionicons name="arrow-back" size={16} color={colors.primary} /><Text style={styles.link}>{t('admin.activitiesUsersTitle')}</Text></TouchableOpacity><View style={styles.hero}><View style={styles.between}><View><Text style={styles.heroTitle}>{user?.name || 'Unknown User'}</Text><Text style={styles.muted}>{t('admin.userDetails')}</Text></View><View style={[styles.badge, { backgroundColor: getStatusColor(user?.status) }]}><Text style={styles.badgeText}>{String(user?.status || 'pending').toUpperCase()}</Text></View></View><Text style={styles.meta}>{(lang === 'hi' ? 'मोबाइल' : 'Mobile')}: {user?.mobile || '-'}</Text><Text style={styles.meta}>{(lang === 'hi' ? 'ईमेल' : 'Email')}: {user?.email || '-'}</Text><Text style={styles.meta}>{(lang === 'hi' ? 'निर्मित दिनांक' : 'Created On')}: {fmtDate(user?.createdAt)}</Text><Text style={styles.meta}>{t('admin.lastActive')}: {user?.lastActiveDate ? moment(user.lastActiveDate).fromNow() : '-'}</Text></View><View style={styles.row}><View style={styles.statPill}><Text style={styles.statPillValue}>{user?.totalCount || 0}</Text><Text style={styles.statPillLabel}>{t('admin.totalCount')}</Text></View><View style={styles.statPill}><Text style={styles.statPillValue}>{todayCount}</Text><Text style={styles.statPillLabel}>{(lang === 'hi' ? 'आज की गिनती' : 'Today Count')}</Text></View></View><View style={styles.panel}><Text style={styles.name}>{t('admin.todayTiming')}</Text><Text style={styles.meta}>{t('admin.allTimes')}: {TIMEZONE_LABEL}</Text>{todayTiming?.firstCountAt || todayTiming?.lastCountAt ? <><Text style={styles.meta}>{t('admin.dayStart')}: {fmtTime(todayTiming?.firstCountAt)}</Text><Text style={styles.meta}>{t('admin.dayEnd')}: {fmtTime(todayTiming?.lastCountAt)}</Text><Text style={styles.meta}>{t('admin.duration')}: {fmtDuration(todayTiming?.activeDurationSeconds)}</Text></> : <Text style={styles.meta}>{t('admin.noCountsToday')}</Text>}</View><Text style={styles.title}>{t('admin.dailyTiming')}</Text><Text style={styles.meta}>{t('admin.allTimes')}: {TIMEZONE_LABEL}</Text>{currentDaily.length === 0 ? <View style={styles.panel}><Text style={styles.meta}>{t('admin.noTimingData')}</Text></View> : currentDaily.slice(0, 7).map((row, index) => <View key={`${row.date}-${index}`} style={styles.panel}><View style={styles.between}><Text style={styles.name}>{fmtDate(row.date)}</Text><Text style={styles.countText}>+{row.dailyCount || 0}</Text></View><Text style={styles.meta}>{t('admin.dayStart')}: {fmtTime(row.firstCountAt)}</Text><Text style={styles.meta}>{t('admin.dayEnd')}: {fmtTime(row.lastCountAt)}</Text><Text style={styles.meta}>{t('admin.duration')}: {fmtDuration(row.activeDurationSeconds)}</Text></View>)}<Text style={styles.title}>{t('admin.recentActivities')}</Text>{actItems.length === 0 ? <View style={styles.panel}><Text style={styles.meta}>{lang === 'hi' ? 'कोई गतिविधि नहीं।' : 'No activity.'}</Text></View> : actItems.map((activity, index) => { const info = activityInfo(activity.activityType); return <View key={activity._id || activity.id || index} style={styles.panel}><View style={styles.row}><Text style={styles.emoji}>{info.icon}</Text><View style={styles.flex}><Text style={[styles.name, { color: info.color }]}>{info.label}</Text><Text style={styles.meta}>{fmtDateTime(activity.timestamp || activity.createdAt)}</Text></View></View>{Number(activity.count || 0) > 0 && <Text style={styles.countText}>+{activity.count}</Text>}</View>; })}{actPage < actTotalPages && <TouchableOpacity style={styles.smallTextBtn} onPress={loadMoreActivities} disabled={actLoadingMore}><Text style={styles.link}>{actLoadingMore ? (lang === 'hi' ? 'लोड हो रहा है…' : 'Loading…') : (lang === 'hi' ? 'और देखें (अगले 10)' : 'More (next 10)')}</Text></TouchableOpacity>}</View>;
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return <View style={styles.container}><View style={styles.header}><TouchableOpacity onPress={handleAdminBack} style={styles.headerBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity><View style={styles.headerCenter}><Text style={styles.headerTitle}>{t('admin.loginTitle')} Panel</Text><TouchableOpacity onPress={openCreateSloganModal}><Text style={styles.headerLink}>{t('admin.addSlogan')}</Text></TouchableOpacity><Text style={styles.headerLink}>v{APP_VERSION}</Text></View><TouchableOpacity onPress={openPwdModal} style={styles.headerBtn}><Ionicons name="key-outline" size={20} color="#fff" /></TouchableOpacity><TouchableOpacity onPress={handleAdminLogout} style={styles.headerBtn}><Ionicons name="log-out-outline" size={22} color="#fff" /></TouchableOpacity></View><View style={styles.tabs}><TouchableOpacity style={[styles.tab, selectedTab === 'stats' && styles.tabActive]} onPress={() => setSelectedTab('stats')}><Text style={[styles.tabText, selectedTab === 'stats' && styles.tabTextActive]}>{t('admin.tabStats')}</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, selectedTab === 'slogans' && styles.tabActive]} onPress={() => setSelectedTab('slogans')}><Text style={[styles.tabText, selectedTab === 'slogans' && styles.tabTextActive]}>{t('admin.tabSlogans')}</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, selectedTab === 'users' && styles.tabActive]} onPress={() => { setSelectedTab('users'); clearUserShortcut(); }}><Text style={[styles.tabText, selectedTab === 'users' && styles.tabTextActive]}>{t('admin.tabUsers')}</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, selectedTab === 'activities' && styles.tabActive]} onPress={() => setSelectedTab('activities')}><Text style={[styles.tabText, selectedTab === 'activities' && styles.tabTextActive]}>{t('admin.tabActivities')}</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, selectedTab === 'reports' && styles.tabActive]} onPress={() => setSelectedTab('reports')}><Text style={[styles.tabText, selectedTab === 'reports' && styles.tabTextActive]}>{t('admin.tabReports')}</Text></TouchableOpacity></View><View style={styles.appBar}><Text style={styles.appLabel}>{t('admin.filterByApp')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{appsList.map((app) => <TouchableOpacity key={app.id} style={[styles.appBtn, selectedApp === app.id && styles.appBtnActive]} onPress={() => { setSelectedApp(app.id); setSelectedActivityUser(null); setActivityUserQuery(''); }}><Text style={[styles.appBtnText, selectedApp === app.id && styles.appBtnTextActive]}>{app.name} {app.userCount !== undefined ? `(${app.userCount})` : ''}</Text></TouchableOpacity>)}</ScrollView></View><ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>{selectedTab === 'stats' && renderStats()}{selectedTab === 'slogans' && renderSlogans()}{selectedTab === 'users' && renderUsers()}{selectedTab === 'activities' && renderActivities()}{selectedTab === 'reports' && <ReportsPanel appId={appFilter} adminEmail={''} />}</ScrollView><Modal visible={sloganModal} transparent animationType="fade" onRequestClose={() => setSloganModal(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.title}>{editingSlogan ? t('admin.updateSlogan') : t('admin.addSlogan')}</Text><TextInput style={[styles.input, styles.modalInput]} placeholder={t('admin.sloganHindi')} value={newSloganHi} onChangeText={handleHindiSloganChange} multiline numberOfLines={4} textAlignVertical="top" /><TextInput style={[styles.input, styles.modalInput]} placeholder={t('admin.sloganEnglish')} value={newSloganEn} onChangeText={handleEnglishSloganChange} multiline numberOfLines={4} textAlignVertical="top" /><Text style={styles.meta}>{lang === 'hi' ? 'हिंदी लिखते ही अंग्रेज़ी अपने आप भर जाएगी। जरूरत हो तो इसे बदलें।' : 'English is auto-filled from Hindi when possible. You can still edit it before saving.'}</Text><TouchableOpacity style={styles.smallTextBtn} onPress={handleAutoFillEnglish}><Text style={styles.link}>{lang === 'hi' ? 'अंग्रेज़ी ऑटो-फिल करें' : 'Auto-fill English'}</Text></TouchableOpacity><View style={styles.wrapRow}><TouchableOpacity style={styles.secondaryBtn} onPress={closeSloganModal}><Text>{t('profile.cancel')}</Text></TouchableOpacity><TouchableOpacity style={styles.primaryBtn} onPress={handleSaveSlogan} disabled={savingSlogan}><Text style={styles.primaryBtnText}>{savingSlogan ? t('login.saving') : (editingSlogan ? t('admin.updateSlogan') : t('admin.saveSlogan'))}</Text></TouchableOpacity></View></View></View></Modal><Modal visible={!!editModal} transparent animationType="fade" onRequestClose={() => setEditModal(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.title}>{lang === 'hi' ? 'यूजर संपादित करें' : 'Edit User'}</Text><TextInput style={styles.input} value={editModal?.name || ''} onChangeText={(value) => setEditModal((prev) => ({ ...prev, name: value }))} placeholder={lang === 'hi' ? 'पूरा नाम' : 'Full name'} /><TextInput style={styles.input} value={editModal?.mobile || ''} onChangeText={(value) => setEditModal((prev) => ({ ...prev, mobile: value }))} placeholder={lang === 'hi' ? 'मोबाइल नंबर' : 'Mobile number'} keyboardType="phone-pad" /><TextInput style={styles.input} value={editModal?.email || ''} onChangeText={(value) => setEditModal((prev) => ({ ...prev, email: value }))} placeholder={lang === 'hi' ? 'ईमेल (वैकल्पिक)' : 'Email (optional)'} keyboardType="email-address" autoCapitalize="none" /><Text style={styles.meta}>{lang === 'hi' ? 'राम गिनती (कुल)' : 'राम Count (total)'}</Text><TextInput style={styles.input} value={String(editModal?.count ?? '')} onChangeText={(value) => setEditModal((prev) => ({ ...prev, count: value.replace(/[^0-9]/g, '') }))} placeholder={lang === 'hi' ? 'कुल राम गिनती' : 'Total राम count'} keyboardType="number-pad" /><View style={styles.wrapRow}><TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditModal(null)} disabled={editLoading}><Text>{t('profile.cancel')}</Text></TouchableOpacity><TouchableOpacity style={styles.primaryBtn} onPress={handleEditSave} disabled={editLoading}>{editLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>{t('profile.save')}</Text>}</TouchableOpacity></View></View></View></Modal><Modal visible={deletedModal} transparent animationType="fade" onRequestClose={() => setDeletedModal(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.title}>{lang === 'hi' ? 'हटाए गए यूजर' : 'Deleted Users'}</Text><Text style={styles.meta}>{lang === 'hi' ? 'इनका डेटा सुरक्षित है — पुनर्स्थापित कर सकते हैं।' : 'Their data is preserved — restore any to bring them back.'}</Text>{deletedLoading ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} /> : (deletedList.length === 0 ? <Text style={styles.meta}>{lang === 'hi' ? 'कोई हटाया गया यूजर नहीं।' : 'No deleted users.'}</Text> : <ScrollView style={{ maxHeight: 380 }}>{deletedList.map((u) => <View key={getUserId(u)} style={styles.panel}><View style={styles.between}><Text style={styles.name}>{u.name || '-'}</Text><TouchableOpacity style={styles.approveBtn} onPress={() => handleRestoreUser(getUserId(u))}><Text style={styles.actionText}>{lang === 'hi' ? 'पुनर्स्थापित' : 'Restore'}</Text></TouchableOpacity></View><Text style={styles.meta}>{(lang === 'hi' ? 'मोबाइल' : 'Mobile')}: {u.mobile || '-'}</Text><Text style={styles.meta}>{t('admin.totalCount')}: {u.totalCount || 0}</Text><Text style={styles.meta}>{(lang === 'hi' ? 'हटाया गया' : 'Deleted')}: {u.deletedAt ? moment(u.deletedAt).format('DD MMM YYYY, hh:mm A') : '-'}</Text></View>)}</ScrollView>)}<View style={styles.wrapRow}><TouchableOpacity style={styles.secondaryBtn} onPress={() => setDeletedModal(false)}><Text>{lang === 'hi' ? 'बंद करें' : 'Close'}</Text></TouchableOpacity></View></View></View></Modal><Modal visible={pwdModal} transparent animationType="fade" onRequestClose={() => setPwdModal(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.title}>{lang === 'hi' ? 'एडमिन पासवर्ड बदलें' : 'Change Admin Password'}</Text><TextInput style={styles.input} value={pwdCurrent} onChangeText={setPwdCurrent} placeholder={lang === 'hi' ? 'मौजूदा पासवर्ड' : 'Current password'} secureTextEntry autoCapitalize="none" /><TextInput style={styles.input} value={pwdNext} onChangeText={setPwdNext} placeholder={lang === 'hi' ? 'नया पासवर्ड (कम से कम 6 अक्षर)' : 'New password (min 6 characters)'} secureTextEntry autoCapitalize="none" /><TextInput style={styles.input} value={pwdConfirm} onChangeText={setPwdConfirm} placeholder={lang === 'hi' ? 'नया पासवर्ड दोबारा' : 'Confirm new password'} secureTextEntry autoCapitalize="none" /><Text style={styles.meta}>{lang === 'hi' ? 'ध्यान दें: सर्वर का मूल पासवर्ड हमेशा रिकवरी के लिए मान्य रहता है, इसलिए लॉक-आउट नहीं होगा।' : 'Note: the server master password always stays valid for recovery, so you can never get locked out.'}</Text><View style={styles.wrapRow}><TouchableOpacity style={styles.secondaryBtn} onPress={() => setPwdModal(false)} disabled={pwdLoading}><Text>{t('profile.cancel')}</Text></TouchableOpacity><TouchableOpacity style={styles.primaryBtn} onPress={handleChangePassword} disabled={pwdLoading}>{pwdLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>{t('profile.save')}</Text>}</TouchableOpacity></View></View></View></Modal></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: appConfig.colors.primary || '#E65100', paddingTop: Platform.OS === 'ios' ? 50 : 36, paddingBottom: 12, paddingHorizontal: 12 },
  headerBtn: { padding: 8 }, headerCenter: { flex: 1, alignItems: 'center' }, headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' }, headerLink: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', ...shadowStyles.small }, tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: colors.accent }, tabText: { fontSize: 14, fontWeight: '600', color: '#666' }, tabTextActive: { color: colors.accent },
  appBar: { backgroundColor: '#fff', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, ...shadowStyles.small }, appLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: spacing.sm }, appBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: '#f0f0f0', marginRight: spacing.sm, borderWidth: 1, borderColor: '#e0e0e0' }, appBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent }, appBtnText: { fontSize: 12, fontWeight: '600', color: '#666' }, appBtnTextActive: { color: '#fff' },
  section: { padding: spacing.md }, title: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: spacing.sm }, muted: { fontSize: 12, color: '#777', marginBottom: spacing.sm }, row: { flexDirection: 'row', gap: spacing.sm }, wrapRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  box: { flex: 1, backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', ...shadowStyles.small }, boxGold: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFB300' }, emoji: { fontSize: 22, marginRight: spacing.sm }, centerText: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: spacing.md, paddingTop: 0 }, card: { backgroundColor: '#fff', width: '48%', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, alignItems: 'center', ...shadowStyles.small }, cardValue: { fontSize: 28, fontWeight: '800', color: colors.accent }, cardLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
  panel: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadowStyles.small }, hero: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadowStyles.medium }, name: { fontSize: 16, fontWeight: '700', color: '#222' }, meta: { fontSize: 12, color: '#666', marginTop: 4 }, countText: { fontSize: 15, fontWeight: '800', color: '#16a34a', marginTop: 6 },
  badge: { borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 2 }, badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  userRow: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadowStyles.small }, userRowName: { fontSize: 15, fontWeight: '700', color: '#222' }, userRowMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  banner: { backgroundColor: '#FFF3E0', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, bannerText: { color: colors.primary, fontSize: 13, fontWeight: '700' }, link: { color: colors.primary, fontWeight: '700' }, dangerLink: { color: '#D32F2F', fontWeight: '700' },
  input: { backgroundColor: '#fff', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm, fontSize: 14, ...shadowStyles.small }, modalInput: { minHeight: 110 },
  statPill: { flex: 1, backgroundColor: '#FFF8F0', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }, statPillValue: { fontSize: 20, fontWeight: '800', color: colors.primary }, statPillLabel: { fontSize: 11, color: '#777', marginTop: 2 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 9 }, primaryBtnText: { color: '#fff', fontWeight: '700' }, secondaryBtn: { backgroundColor: '#f3f4f6', borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 9 }, smallBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }, smallTextBtn: { paddingVertical: 6, paddingRight: 12 },
  approveBtn: { backgroundColor: '#22c55e', borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 8 }, rejectBtn: { backgroundColor: '#fff', borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: 1, borderColor: '#ef4444' }, actionText: { color: '#fff', fontWeight: '700', fontSize: 13 }, rejectText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }, heroTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  empty: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }, emptyText: { fontSize: 14, color: '#777', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg }, modal: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.lg, ...shadowStyles.medium },
});




