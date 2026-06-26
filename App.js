import React, { useEffect, useState } from 'react';
import { StyleSheet, LogBox, View, ActivityIndicator, Platform, Text, TouchableOpacity, Alert, BackHandler } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';

import Constants from 'expo-constants';
import appConfig from './src/config/appConfig';
import { restoreTokens, getAppConfig } from './src/utils/apiService';
import { initUserMobile } from './src/utils/counterService';
import { Linking } from 'react-native';

const APP_VERSION = Constants.expoConfig?.version || '1.1.0';
const APP_BUILD = Number(Constants.expoConfig?.android?.versionCode) || 0;

if (!__DEV__) {
  LogBox.ignoreAllLogs();
} else {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
  ]);
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const getLanguageToggle = () => require('./src/components/LanguageToggle').default;
const getLoginScreen = () => require('./src/screens/auth/LoginScreen').default;
const getCounterScreen = () => require('./src/screens/app/CounterScreen').default;
const getStatsScreen = () => require('./src/screens/app/StatsScreen').default;
const getProfileScreen = () => require('./src/screens/app/ProfileScreen').default;
const getAdminLoginScreen = () => require('./src/screens/admin/AdminLoginScreen').default;
const getAdminDashboardScreen = () => require('./src/screens/admin/AdminDashboardScreen').default;

// Error boundary — prevents white/splash screen if a screen crashes
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null, stack: '', showDetails: false };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Screen crash caught:', error, info?.componentStack);
    this.setState({ stack: info?.componentStack || '' });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFF8F0' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#D32F2F' }}>Something went wrong</Text>
          <TouchableOpacity onLongPress={() => this.setState(s => ({ showDetails: !s.showDetails }))}>
            <Text style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 }}>
              {String(this.state.error?.message || '')}
            </Text>
          </TouchableOpacity>
          {this.state.showDetails ? (
            <Text selectable style={{ fontSize: 10, color: '#888', marginBottom: 16, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
              {this.state.stack}
            </Text>
          ) : null}
          <TouchableOpacity
            style={{ backgroundColor: '#FF9933', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null, stack: '', showDetails: false })}
          >
            <Text style={{ color: '#FFF', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
const BOOT_WATCHDOG_MS = 12000;

function MainTabs({ onLogout }) {
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Counter') {
            iconName = focused ? appConfig.navigation.counter.icon : appConfig.navigation.counter.iconOutline;
          } else if (route.name === 'Stats') {
            iconName = focused ? appConfig.navigation.stats.icon : appConfig.navigation.stats.iconOutline;
          } else if (route.name === 'Profile') {
            iconName = focused ? appConfig.navigation.profile.icon : appConfig.navigation.profile.iconOutline;
          }
          return <Ionicons name={iconName} size={focused ? 24 : 22} color={color} />;
        },
        tabBarActiveTintColor: appConfig.colors.primary,
        tabBarInactiveTintColor: '#A0A0A0',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          minHeight: 80,
          height: 84,
          paddingTop: 6,
          paddingBottom: 18,
          ...Platform.select({
            web: { boxShadow: '0px -4px 14px rgba(0, 0, 0, 0.08)' },
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 14,
              elevation: 14,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarAllowFontScaling: false,
      })}
    >
      <Tab.Screen name="Counter" options={{ tabBarLabel: t('nav.count') }}>
        {(props) => { const Screen = getCounterScreen(); return <Screen {...props} onLogout={onLogout} />; }}
      </Tab.Screen>
      <Tab.Screen name="Stats" options={{ tabBarLabel: t('nav.stats') }}>
        {(props) => { const Screen = getStatsScreen(); return <Screen {...props} onLogout={onLogout} />; }}
      </Tab.Screen>
      <Tab.Screen name="Profile" options={{ tabBarLabel: t('nav.profile') }}>
        {(props) => { const Screen = getProfileScreen(); return <Screen {...props} onLogout={onLogout} />; }}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(null); // { updateUrl, minSupportedVersion } when this build is too old

  useEffect(() => {
    if (Platform.OS !== 'android' || !user) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const watchdog = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, BOOT_WATCHDOG_MS);

    const boot = async () => {
      try {
        // Force-update gate: if the backend's minimum supported build is higher than
        // this build, block with an update screen. Fail OPEN (ignore errors) so a
        // backend hiccup can never lock users out.
        try {
          const cfg = await getAppConfig();
          const minBuild = Number(cfg?.minSupportedVersion) || 0;
          if (APP_BUILD > 0 && minBuild > APP_BUILD) {
            if (isMounted) {
              setForceUpdate({ updateUrl: cfg?.updateUrl || '', minSupportedVersion: minBuild });
              setLoading(false);
            }
            return;
          }
        } catch (_) { /* fail open */ }

        // Clear stale session on version upgrade so users get a fresh login
        const lastVersion = await AsyncStorage.getItem('appVersion');
        if (lastVersion && lastVersion !== APP_VERSION) {
          await AsyncStorage.multiRemove(['localUser', 'authToken', 'adminToken']);
        }
        await AsyncStorage.setItem('appVersion', APP_VERSION);

        await restoreTokens();
        const [storedUser, adminToken] = await Promise.all([
          AsyncStorage.getItem('localUser'),
          AsyncStorage.getItem('adminToken'),
        ]);

        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            if (typeof initUserMobile === 'function') {
              await initUserMobile(parsedUser?.mobile);
            }
            if (isMounted) {
              setUser(parsedUser);
              setIsAdminAuthenticated(false);
            }
            return;
          } catch (parseError) {
            console.warn('🟠 Failed to restore localUser, clearing corrupted session:', parseError?.message || parseError);
            await AsyncStorage.removeItem('localUser');
          }
        }

        if (isMounted) {
          setUser(null);
          setIsAdminAuthenticated(Boolean(adminToken));
        }
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    boot();
    return () => {
      isMounted = false;
      clearTimeout(watchdog);
    };
  }, []);

  const doLogout = async () => {
    await AsyncStorage.multiRemove(['localUser', 'authToken']);
    setUser(null);
  };

  const handleAdminLoggedIn = () => {
    setUser(null);
    setIsAdminAuthenticated(true);
  };

  const handleAdminLogout = async () => {
    await AsyncStorage.removeItem('adminToken');
    setIsAdminAuthenticated(false);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) doLogout();
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const handleLoggedIn = async (profile) => {
    try {
      console.log('🔵 Session: save localUser');
      await AsyncStorage.setItem('localUser', JSON.stringify(profile));

      console.log('🔵 Session: init mobile cache');
      if (typeof initUserMobile === 'function') {
        try {
          await initUserMobile(profile?.mobile);
        } catch (initError) {
          console.warn('🟠 initUserMobile failed:', initError?.message || initError);
        }
      } else {
        console.warn('🟠 initUserMobile is not a function');
      }

      console.log('🔵 Session: set user');
      setUser(profile);
    } catch (error) {
      console.error('🔴 handleLoggedIn failed:', error);
      // Fail-open to avoid blocking navigation after successful backend auth.
      setUser(profile);
    }
  };

  if (forceUpdate) {
    return (
      <View style={styles.appWrapper}>
        <View style={[styles.appContainer, Platform.OS === 'web' && styles.appContainerWeb]}>
          <View style={styles.updateContainer}>
            <Text style={styles.updateEmoji}>🙏</Text>
            <Text style={styles.updateTitle}>Update Required</Text>
            <Text style={styles.updateText}>
              A newer version of Shri Ram Nam Bank is available. Please update to continue —
              your counts are safe.
            </Text>
            {!!forceUpdate.updateUrl && (
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => Linking.openURL(forceUpdate.updateUrl).catch(() => {})}
              >
                <Text style={styles.updateButtonText}>Download Latest Version</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.updateMeta}>
              Installed: build {APP_BUILD} · Required: build {forceUpdate.minSupportedVersion}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.appWrapper}>
        <View style={[styles.appContainer, Platform.OS === 'web' && styles.appContainerWeb]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={appConfig.colors.primary} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <LanguageProvider>
      <View style={styles.appWrapper}>
        <View style={[styles.appContainer, Platform.OS === 'web' && styles.appContainerWeb]}>
          <View style={styles.globalLangToggle}>
            {(() => { const Toggle = getLanguageToggle(); return <Toggle />; })()}
          </View>
          <ErrorBoundary>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false, ...(Platform.OS === 'web' ? { cardShadowEnabled: false } : {}) }}>
                {!user && !isAdminAuthenticated ? (
                  <>
                    <Stack.Screen name="Login">
                      {(props) => { const Screen = getLoginScreen(); return <Screen {...props} onLoggedIn={handleLoggedIn} />; }}
                    </Stack.Screen>
                    <Stack.Screen name="AdminLogin">
                      {(props) => { const Screen = getAdminLoginScreen(); return <Screen {...props} onLoggedIn={handleAdminLoggedIn} />; }}
                    </Stack.Screen>
                  </>
                ) : isAdminAuthenticated ? (
                  <Stack.Screen name="AdminDashboard">
                    {(props) => { const Screen = getAdminDashboardScreen(); return <Screen {...props} onLogout={handleAdminLogout} />; }}
                  </Stack.Screen>
                ) : (
                  <Stack.Screen name="MainTabs">
                    {(props) => <MainTabs {...props} onLogout={handleLogout} />}
                  </Stack.Screen>
                )}
              </Stack.Navigator>
            </NavigationContainer>
          </ErrorBoundary>
        </View>
      </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  appWrapper: {
    flex: 1,
    backgroundColor: '#EBE5DC',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  appContainerWeb: {
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateContainer: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  updateEmoji: { fontSize: 56, marginBottom: 16 },
  updateTitle: { fontSize: 22, fontWeight: '800', color: '#FF9933', marginBottom: 12 },
  updateText: { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  updateButton: {
    backgroundColor: '#FF9933',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    marginBottom: 16,
  },
  updateButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  updateMeta: { fontSize: 12, color: '#999' },
  globalLangToggle: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 100,
    elevation: 20,
  },
});



