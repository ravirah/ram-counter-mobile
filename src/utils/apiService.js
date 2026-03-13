import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For local web dev, force a local proxy to avoid backend CORS blocks.
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
  },
});

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

// In-memory token cache — avoids async AsyncStorage reads inside interceptors (unreliable on web)
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

export const getMyActivities = async (limit = 50, page = 1) => {
  const response = await api.get('/activities/my-activities', { params: { limit, page } });
  return response.data;
};

export const getDailySummary = async (days = 7) => {
  const response = await api.get('/activities/daily-summary', { params: { days } });
  return response.data;
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
  return response.data;
};

export const getUserDetails = async (userId) => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAllActivities = async (limit = 100, page = 1, type = '', userId = '', appId = null) => {
  const token = await AsyncStorage.getItem('adminToken');
  const params = { limit, page, type, userId };
  if (appId) params.appId = appId;

  const response = await axios.get(`${API_URL}/admin/activities`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
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

export const getApps = async () => {
  const token = await AsyncStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/apps`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
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

export default api;


