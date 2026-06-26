import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple local-only authentication (no backend required)
export const registerUserWithPhone = async (phoneNumber, name, password) => {
  try {
    console.log('📝 Registering user locally:', { phoneNumber, name });

    // Create user object
    const user = {
      id: Date.now().toString(),
      phoneNumber,
      name,
      password, // In a real app, this should be hashed
      createdAt: new Date().toISOString(),
    };

    // Save user info to AsyncStorage
    await AsyncStorage.setItem('user', JSON.stringify(user));

    console.log('✅ Local registration successful');

    return user;
  } catch (error) {
    console.error('❌ Local registration error:', error.message);
    throw new Error(error.message || 'Failed to register user locally');
  }
};

// Simple local login
export const loginUserWithPhone = async (phoneNumber, password) => {
  try {
    console.log('🔐 Logging in user locally:', { phoneNumber });

    // Get stored user
    const storedUser = await AsyncStorage.getItem('user');
    if (!storedUser) {
      throw new Error('User not found. Please register first.');
    }

    const user = JSON.parse(storedUser);

    // Simple password check (in real app, use proper hashing)
    if (user.password !== password) {
      throw new Error('Invalid password');
    }

    console.log('✅ Local login successful');
    return user;
  } catch (error) {
    console.error('❌ Local login error:', error.message);
    throw new Error(error.message || 'Failed to login');
  }
};

// Get current user from local storage
export const getCurrentUser = async () => {
  try {
    const storedUser = await AsyncStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('❌ Get current user error:', error.message);
    return null;
  }
};

// Logout (clear local storage)
export const logout = async () => {
  try {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('userToken');
    console.log('✅ Local logout successful');
  } catch (error) {
    console.error('❌ Local logout error:', error.message);
    throw new Error(error.message || 'Failed to logout');
  }
};

// NOTE: Admin login is handled server-side via apiService.loginAdmin ->
// POST /auth/admin/login (env/bcrypt credentials, change-password supported).
// The previous client-side check with hardcoded credentials was a security
// risk (an on-device admin bypass) and has been removed.
