import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

// Simple phone + password registration (no OTP/Firebase)
export const registerUserWithPhone = async (phoneNumber, name, password) => {
  try {
    console.log('📝 Registering user with phone (simple auth):', { phoneNumber, name });

    const response = await api.post('/auth/register', {
      phoneNumber,
      name,
      password,
    });

    console.log('✅ Registration successful:', response.data);

    const { token, user } = response.data;

    // Save token and user info to AsyncStorage
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));

    console.log('💾 User data saved to AsyncStorage');

    return user;
  } catch (error) {
    console.error('❌ Registration error:', error.response?.data || error.message);

    throw new Error(
      error.response?.data?.errors?.[0]?.msg ||
        error.response?.data?.error ||
        error.message ||
        'Failed to register user'
    );
  }
};

// Simple login with phone + password
export const loginUserWithPhone = async (phoneNumber, password) => {
  try {
    console.log('🔐 Logging in user with phone (simple auth):', { phoneNumber });

    const loginResponse = await api.post('/auth/login', {
      phoneNumber,
      password,
    });

    console.log('✅ Login successful:', loginResponse.data);

    const { token, user } = loginResponse.data;

    // Save token and user info to AsyncStorage
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));

    console.log('💾 User data saved to AsyncStorage');

    return user;
  } catch (error) {
    console.error('❌ Login error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error ||
        error.message ||
        'Failed to login user'
    );
  }
};

// Fetch user data
export const fetchUserData = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('Fetch user error:', error);
    throw error;
  }
};

// Logout
export const logout = async () => {
  try {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('user');
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Admin login
export const adminLogin = async (email, password) => {
  try {
    const response = await api.post('/auth/admin-login', {
      email,
      password,
    });

    const { token } = response.data;
    await AsyncStorage.setItem('adminToken', token);
    return response.data;
  } catch (error) {
    console.error('Admin login error:', error);
    throw error;
  }
};

// Admin logout
export const adminLogout = async () => {
  try {
    await AsyncStorage.removeItem('adminToken');
  } catch (error) {
    console.error('Admin logout error:', error);
    throw error;
  }
};
