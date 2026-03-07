import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your backend URL
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://bhagwan-backend-u0n9.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry once on network/timeout errors (handles Render free-tier cold starts ~30-60s)
api.interceptors.response.use(null, async (error) => {
  const config = error.config;
  const isNetworkError = !error.response && (
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    error.code === 'ETIMEDOUT' ||
    error.message?.includes('Network Error') ||
    error.message?.includes('timeout')
  );
  if (!config._retried && isNetworkError) {
    config._retried = true;
    config.timeout = 60000;
    return api.request(config);
  }
  return Promise.reject(error);
});

// In-memory token cache — avoids async AsyncStorage reads inside interceptors (unreliable on web)
let _authToken = null;
let _adminToken = null;

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
    const response = await axios.get(`${API_URL}/health`, { timeout: 30000 });
    return response.data.status === 'OK';
  } catch (error) {
    return false;
  }
};

// Auth APIs
export const loginUser = async (name, pin, mobile, email, appId = 'ram-bank') => {
  const response = await api.post('/auth/login', { name, pin, mobile, email, appId });
  if (response.data.token) {
    _authToken = response.data.token;
    await AsyncStorage.setItem('authToken', response.data.token);
  }
  return response.data;
};

export const lookupUser = async (mobile, appId = 'ram-bank') => {
  const response = await api.post('/auth/lookup', { mobile, appId });
  return response.data;
};

export const loginAdmin = async (username, password) => {
  const response = await api.post('/auth/admin/login', { username, password });
  if (response.data.token) {
    _adminToken = response.data.token;
    await AsyncStorage.setItem('adminToken', response.data.token);
  }
  return response.data;
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

export default api;
