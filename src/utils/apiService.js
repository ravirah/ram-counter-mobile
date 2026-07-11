import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import appJson from '../../app.json';

// Every request advertises this app's build (Android versionCode). The backend uses it
// to block old APKs from destructive ops / login and to drive the force-update screen.
export const APP_BUILD = Number(appJson?.expo?.android?.versionCode) || 0;
axios.defaults.headers.common['X-App-Version'] = String(APP_BUILD);
// Always fetch live data — never let a browser/proxy serve a cached API response.
axios.defaults.headers.common['Cache-Control'] = 'no-cache';

const LOCAL_WEB_PROXY_URL = 'http://localhost:5001/api';
const isLocalWeb = typeof window !== 'undefined' && window.location?.hostname === 'localhost';
const API_URL = isLocalWeb
  ? LOCAL_WEB_PROXY_URL
  : (process.env.EXPO_PUBLIC_API_URL || 'https://bhagwan-backend-u0n9.onrender.com/api');

console.log('🔵 API base URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-Version': String(APP_BUILD),
    'Cache-Control': 'no-cache',
  },
});

// Launch-time version check. Returns { minSupportedVersion, updateUrl, ... } so the app
// can show a blocking "update required" screen when this build is too old.
export const getAppConfig = async () => {
  const response = await axios.get(`${API_URL}/app-config`, { timeout: 8000 });
  return response.data;
};

const isRetriableNetworkError = (error) => {
  return !error?.response && (
    error?.code === 'ECONNABORTED' ||
    error?.code === 'ERR_NETWORK' ||
    error?.code === 'ETIMEDOUT' ||
    error?.message?.includes('Network Error') ||
    error?.message?.includes('timeout')
  );
};

// Retry once on network/timeout errors (handles temporary backend cold starts)
api.interceptors.response.use(null, async (error) => {
  const config = error.config || {};
  if (!config._retried && !config._skipRetry && isRetriableNetworkError(error)) {
    config._retried = true;
    config.timeout = 20000;
    return api.request(config);
  }
  return Promise.reject(error);
});

// In-memory token cache - avoids async AsyncStorage reads inside interceptors (unreliable on web)
let _authToken = null;
let _adminToken = null;
let _warmupPromise = null;

export const restoreTokens = async () => {
  _authToken = await AsyncStorage.getItem('authToken');
  _adminToken = await AsyncStorage.getItem('adminToken');
};

// Add token to requests (admin functions use raw axios with explicit headers, so this only needs _authToken)
api.interceptors.request.use((config) => {
  if (!config.headers.Authorization && _authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

// Check if backend is available
export const checkBackendAvailability = async () => {
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 10000 });
    return response.data.status === 'OK';
  } catch (error) {
    return false;
  }
};

// Wake backend once to reduce first-login delay (Render cold starts)
export const warmBackend = async () => {
  if (_warmupPromise) return _warmupPromise;
  _warmupPromise = axios
    .get(`${API_URL}/health`, { timeout: 10000 })
    .catch(() => null)
    .finally(() => {
      _warmupPromise = null;
    });
  return _warmupPromise;
};

export const parseApiError = (error) => {
  const data = error?.response?.data || {};
  return {
    statusCode: error?.response?.status || null,
    status: data?.status || null,
    approved: data?.approved,
    message: data?.message || error?.message || 'Request failed',
    isNetwork: isRetriableNetworkError(error),
    raw: data,
  };
};

const safeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const pickFirstDateValue = (...values) => {
  for (const value of values) {
    if (!value) continue;
    const parsed = moment(value);
    if (parsed.isValid()) return parsed.toISOString();
  }
  return null;
};

const formatDuration = (seconds) => {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return null;

  const wholeSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const APPROVAL_GRACE_PERIOD_DAYS = 2;

const deriveApprovalState = (payload = {}) => {
  const user =
    payload?.user ||
    payload?.data?.user ||
    payload?.profile ||
    null;
  const createdAt = pickFirstDateValue(
    payload?.createdAt,
    payload?.registeredAt,
    payload?.joinedAt,
    user?.createdAt,
    user?.registeredAt,
    user?.joinedAt
  );
  const rawStatus = String(payload?.status || user?.status || '').toLowerCase();
  const rawApproved = typeof payload?.approved === 'boolean'
    ? payload.approved
    : (typeof user?.approved === 'boolean' ? user.approved : null);
  const isRejected = rawStatus === 'rejected';
  const withinGracePeriod = createdAt
    ? moment().isBefore(moment(createdAt).add(APPROVAL_GRACE_PERIOD_DAYS, 'days'))
    : false;
  const requiresApproval = !isRejected && !withinGracePeriod && (rawStatus === 'pending' || rawApproved === false);

  let approvalState = 'approved';
  if (isRejected) approvalState = 'rejected';
  else if (requiresApproval) approvalState = 'pending';
  else if (withinGracePeriod && (rawStatus === 'pending' || rawApproved === false)) approvalState = 'grace';

  return {
    createdAt,
    rawStatus: rawStatus || null,
    rawApproved,
    withinGracePeriod,
    requiresApproval,
    isRejected,
    approvalState,
    approvalRequiredAt: createdAt
      ? moment(createdAt).add(APPROVAL_GRACE_PERIOD_DAYS, 'days').toISOString()
      : null,
  };
};

const normalizeTimingRow = (row = {}) => {
  const firstCountAt = pickFirstDateValue(
    row.firstCountAt,
    row.startTime,
    row.startedAt,
    row.dayStartAt,
    row.firstActivityAt,
    row.startAt
  );
  const lastCountAt = pickFirstDateValue(
    row.lastCountAt,
    row.endTime,
    row.endedAt,
    row.dayEndAt,
    row.lastActivityAt,
    row.endAt
  );
  const dailyCount = Number(row.dailyCount ?? row.count ?? row.totalCount ?? 0) || 0;
  const durationRaw = row.activeDurationSeconds ?? row.durationSeconds ?? row.sessionDurationSeconds ?? row.duration;
  const parsedDuration = Number(durationRaw);
  const derivedDuration = firstCountAt && lastCountAt
    ? Math.max(0, moment(lastCountAt).diff(moment(firstCountAt), 'seconds'))
    : null;
  const activeDurationSeconds = Number.isFinite(parsedDuration) && parsedDuration >= 0
    ? Math.floor(parsedDuration)
    : derivedDuration;

  return {
    ...row,
    date: row.date || row.day || row.dayKey || null,
    dailyCount,
    firstCountAt,
    lastCountAt,
    activeDurationSeconds,
    activeDurationLabel: activeDurationSeconds === null ? null : formatDuration(activeDurationSeconds),
  };
};

export const getApprovalGateState = (payload = {}) => deriveApprovalState(payload);

export const normalizeAdminUser = (user = {}) => {
  const normalizedUser = {
    ...user,
    id: user.id || user._id || user.userId || null,
    _id: user._id || user.id || user.userId || null,
    name: safeString(user.name || user.fullName || user.username),
    mobile: safeString(user.mobile || user.phone || user.phoneNumber),
    email: safeString(user.email || user.emailAddress),
    appId: user.appId || user.app || null,
    totalCount: Number(user.totalCount ?? user.totalChantCount ?? 0) || 0,
    todayCount: Number(user.todayCount ?? user.dailyCount ?? 0) || 0,
    lastActiveDate: pickFirstDateValue(user.lastActiveDate, user.lastActiveAt, user.lastActivityAt),
    createdAt: pickFirstDateValue(user.createdAt, user.joinedAt, user.registeredAt),
  };
  const approval = deriveApprovalState(normalizedUser);

  return {
    ...normalizedUser,
    status: normalizedUser.status || approval.rawStatus || 'approved',
    approved: approval.requiresApproval ? false : (approval.isRejected ? false : (approval.rawApproved ?? true)),
    approvalState: approval.approvalState,
    requiresApproval: approval.requiresApproval,
    withinGracePeriod: approval.withinGracePeriod,
    approvalRequiredAt: approval.approvalRequiredAt,
  };
};

export const normalizeAdminUserDetail = (response = {}) => {
  const user = response.user || response.data?.user || response.profile || response;
  const dailySummariesSource =
    response.dailySummaries ||
    response.dailySummary ||
    response.summaries ||
    user?.dailySummaries ||
    [];
  const recentActivitiesSource =
    response.recentActivities ||
    response.activities ||
    user?.recentActivities ||
    [];

  const normalizedUser = user && typeof user === 'object'
    ? normalizeAdminUser(user)
    : user;

  return {
    ...response,
    user: normalizedUser,
    dailySummaries: Array.isArray(dailySummariesSource)
      ? dailySummariesSource.map(normalizeTimingRow)
      : [],
    recentActivities: Array.isArray(recentActivitiesSource)
      ? recentActivitiesSource.map((activity) => ({
          ...activity,
          timestamp: pickFirstDateValue(activity.timestamp, activity.createdAt, activity.time),
        }))
      : [],
  };
};

export const normalizeDailySummaryResponse = (response = {}) => {
  const summariesSource = response.summaries || response.dailySummaries || response.days || [];
  return {
    ...response,
    summaries: Array.isArray(summariesSource)
      ? summariesSource.map(normalizeTimingRow)
      : [],
  };
};

export const normalizeAdminActivitiesResponse = (response = {}) => {
  const activitiesSource = response.activities || response.items || [];
  return {
    ...response,
    activities: Array.isArray(activitiesSource)
      ? activitiesSource.map((activity) => ({
          ...activity,
          timestamp: pickFirstDateValue(activity.timestamp, activity.createdAt, activity.time),
        }))
      : [],
  };
};

// Auth APIs
export const loginUser = async (name, pin, mobile, email, appId = 'ram-bank') => {
  // Start warmup in background; do not block login on health check.
  warmBackend().catch(() => {});
  const response = await api.post('/auth/login', { name, pin, mobile, email, appId });
  if (response.data.token) {
    _authToken = response.data.token;
    await AsyncStorage.setItem('authToken', response.data.token);
  }
  return response.data;
};

export const lookupUser = async (mobile, appId = 'ram-bank', options = {}) => {
  // Start warmup in background; do not delay lookup UX.
  warmBackend().catch(() => {});
  const response = await api.post(
    '/auth/lookup',
    { mobile, appId },
    {
      timeout: options.timeout || 6000,
      _skipRetry: true,
    }
  );
  return response.data;
};

export const loginAdmin = async (username, password) => {
  warmBackend().catch(() => {});
  const response = await api.post('/auth/admin/login', { username, password });
  if (response.data.token) {
    _adminToken = response.data.token;
    await AsyncStorage.setItem('adminToken', response.data.token);
  }
  return response.data;
};

export const logoutAdmin = async () => {
  _adminToken = null;
  await AsyncStorage.removeItem('adminToken');
};

// User APIs
export const getUserProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data;
};

export const updateUserProfile = async (name, email, mobile) => {
  const response = await api.put('/users/profile', { name, email, mobile });
  return response.data;
};

// Activity APIs
export const addCount = async (count = 1) => {
  const token = _authToken || (await AsyncStorage.getItem('authToken'));
  const response = await api.post('/activities/add-count', { count }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Idempotent batch sync. `events` = [{ clientEventId, delta, ts? }]. The backend dedupes on
// (userId, clientEventId), so retries/replays never double-count. Returns { success, accepted[],
// totalCount }. Used by the durable client sync queue (Phase 2).
export const syncEvents = async (events) => {
  const token = _authToken || (await AsyncStorage.getItem('authToken'));
  const response = await api.post('/activities/sync-events', { events }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getMyActivities = async (limit = 50, page = 1) => {
  const response = await api.get('/activities/my-activities', { params: { limit, page } });
  return response.data;
};

export const getDailySummary = async (days = 7) => {
  const response = await api.get('/activities/daily-summary', { params: { days } });
  return normalizeDailySummaryResponse(response.data);
};

// Admin APIs
export const getAllUsers = async (limit = 50, page = 1, search = '', appId = null) => {
  const token = await AsyncStorage.getItem('adminToken');
  const params = { limit, page, search };
  if (appId) params.appId = appId;

  const response = await axios.get(`${API_URL}/admin/users`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return {
    ...response.data,
    users: Array.isArray(response.data?.users)
      ? response.data.users.map(normalizeAdminUser)
      : [],
  };
};

export const getUserDetails = async (userId) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return normalizeAdminUserDetail(response.data);
};

export const extractAdminUserPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.user && typeof payload.user === 'object') return payload.user;
  if (payload.data?.user && typeof payload.data.user === 'object') return payload.data.user;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data;
  return payload;
};

export const normalizeAdminTimingEntry = (entry = {}) => {
  const dailyCount = entry.dailyCount ?? entry.count ?? entry.totalCount ?? 0;
  const firstCountAt = entry.firstCountAt ?? entry.startTime ?? entry.startedAt ?? entry.firstActivityAt ?? null;
  const lastCountAt = entry.lastCountAt ?? entry.endTime ?? entry.endedAt ?? entry.lastActivityAt ?? null;

  let activeDurationSeconds = entry.activeDurationSeconds ?? entry.durationSeconds ?? null;
  if (activeDurationSeconds == null && firstCountAt && lastCountAt) {
    const startMs = new Date(firstCountAt).getTime();
    const endMs = new Date(lastCountAt).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      activeDurationSeconds = Math.floor((endMs - startMs) / 1000);
    }
  }

  return {
    ...entry,
    date: entry.date ?? entry.day ?? entry.summaryDate ?? null,
    dailyCount,
    firstCountAt,
    lastCountAt,
    activeDurationSeconds,
  };
};

export const extractAdminDailySummaries = (payload) => {
  const raw =
    payload?.dailySummaries ||
    payload?.summaries ||
    payload?.userStats?.dailySummaries ||
    payload?.userStats?.summaries ||
    payload?.stats?.dailySummaries ||
    payload?.activitySummary?.dailySummaries ||
    payload?.data?.dailySummaries ||
    payload?.data?.summaries ||
    [];

  return Array.isArray(raw) ? raw.map(normalizeAdminTimingEntry) : [];
};

export const extractAdminRecentActivities = (payload) => {
  const raw =
    payload?.recentActivities ||
    payload?.activities ||
    payload?.activityLog ||
    payload?.data?.recentActivities ||
    payload?.data?.activities ||
    [];

  return Array.isArray(raw) ? raw : [];
};

export const getAllActivities = async (limit = 100, page = 1, type = '', userId = '', appId = null) => {
  const token = await AsyncStorage.getItem('adminToken');
  const params = { limit, page, type, userId };
  if (appId) params.appId = appId;

  const response = await axios.get(`${API_URL}/admin/activities`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return normalizeAdminActivitiesResponse(response.data);
};

export const getAdminStats = async (appId = null) => {
  const token = await AsyncStorage.getItem('adminToken');
  const params = {};
  if (appId) params.appId = appId;

  const response = await axios.get(`${API_URL}/admin/stats`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const editUser = async (userId, data) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.put(`${API_URL}/admin/users/${userId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const deleteUser = async (userId) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.delete(`${API_URL}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateUserStatus = async (userId, status) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.put(`${API_URL}/admin/users/${userId}/status`, { status }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Admin: set a user's राम count (audited; backfills DailySummary so reports stay correct).
export const setUserCount = async (userId, totalCount, reason = 'Admin manual update') => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.put(`${API_URL}/admin/users/${userId}/set-count`, { totalCount, reason }, {
    headers: { Authorization: `Bearer ${token}`, 'X-App-Version': String(APP_BUILD) }
  });
  return response.data;
};

// Admin: change the admin password (in-app). The Render env ADMIN_PASSWORD stays valid
// as a recovery master, so this can never lock the admin out.
export const changeAdminPassword = async (currentPassword, newPassword) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.put(`${API_URL}/admin/change-password`, { currentPassword, newPassword }, {
    headers: { Authorization: `Bearer ${token}`, 'X-App-Version': String(APP_BUILD) }
  });
  return response.data;
};

// Admin: restore a soft-deleted user (clears deletedAt).
export const restoreUser = async (userId) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.put(`${API_URL}/admin/users/${userId}/restore`, {}, {
    headers: { Authorization: `Bearer ${token}`, 'X-App-Version': String(APP_BUILD) }
  });
  return response.data;
};

// Admin: list soft-deleted users (the deletion/recovery view).
export const getDeletedUsers = async (appId = null) => {
  const token = await AsyncStorage.getItem('adminToken');
  const params = {};
  if (appId) params.appId = appId;
  const response = await axios.get(`${API_URL}/admin/deleted-users`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return {
    ...response.data,
    users: Array.isArray(response.data?.users) ? response.data.users.map(normalizeAdminUser) : [],
  };
};

// Admin: audit trail (deletion / count-update / status history).
export const getAuditLogs = async (limit = 100) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/audit-logs`, {
    params: { limit },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getApps = async () => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/apps`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getChantReport = async ({
  type = 'weekly',
  periodStart,
  periodEnd,
  appId = null,
  userId = null,
  bucket = 'day',
  topN = null,
} = {}) => {
  const token = await AsyncStorage.getItem('adminToken');
  const params = { type, periodStart, periodEnd, bucket };
  if (appId) params.appId = appId;
  if (userId) params.userId = userId;
  if (topN && Number(topN) > 0) params.topN = Number(topN);

  const response = await axios.get(`${API_URL}/admin/reports/chant-summary`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  return response.data;
};

// Build the server-side राम-PDF endpoint URL (the PDF is generated on the backend,
// which can write every राम without the on-device expo-print memory limit).
export const getRamPdfUrl = ({ periodStart, periodEnd, appId = null, userId = null, topN = null } = {}) => {
  const params = [`periodStart=${encodeURIComponent(periodStart)}`, `periodEnd=${encodeURIComponent(periodEnd)}`];
  if (appId) params.push(`appId=${encodeURIComponent(appId)}`);
  if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
  if (topN && Number(topN) > 0) params.push(`topN=${Number(topN)}`);
  return `${API_URL}/admin/reports/ram-pdf?${params.join('&')}`;
};

export const getAdminToken = async () => {
  return _adminToken || (await AsyncStorage.getItem('adminToken'));
};

export const getSlogans = async (appId = 'ram-bank') => {
  const response = await api.get('/slogans', { params: { appId } });
  return response.data;
};

export const getAdminSlogans = async (appId = 'ram-bank') => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/slogans`, {
    params: { appId },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const addAdminSlogan = async (hi, en, appId = 'ram-bank') => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/slogans`, { hi, en, appId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateAdminSlogan = async (sloganId, hi, en, appId = 'ram-bank') => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.put(`${API_URL}/admin/slogans/${sloganId}`, { hi, en, appId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const deleteAdminSlogan = async (sloganId, appId = 'ram-bank') => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.delete(`${API_URL}/admin/slogans/${sloganId}`, {
    params: { appId },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export default api;



