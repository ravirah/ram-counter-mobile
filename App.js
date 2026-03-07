import React, { useEffect, useState } from 'react';
import { StyleSheet, LogBox, View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import LanguageToggle from './src/components/LanguageToggle';

import LoginScreen from './src/screens/auth/LoginScreen';
import CounterScreen from './src/screens/app/CounterScreen';
import StatsScreen from './src/screens/app/StatsScreen';
import ProfileScreen from './src/screens/app/ProfileScreen';
import AdminLoginScreen from './src/screens/admin/AdminLoginScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import appConfig from './src/config/appConfig';
import { restoreTokens } from './src/utils/apiService';
import { initUserMobile } from './src/utils/counterService';

if (!__DEV__) {
  LogBox.ignoreAllLogs();
} else {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
  ]);
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
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
          height: 80,
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
      })}
    >
      <Tab.Screen name="Counter" component={CounterScreen} options={{ tabBarLabel: t('nav.count') }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: t('nav.stats') }} />
      <Tab.Screen name="Profile" options={{ tabBarLabel: t('nav.profile') }}>
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const watchdog = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, BOOT_WATCHDOG_MS);

    const boot = async () => {
      try {
        await restoreTokens();
        // Requirement: always ask login when app opens
        await AsyncStorage.multiRemove(['localUser', 'authToken', 'adminToken']);
        if (isMounted) setUser(null);
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

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['localUser', 'authToken', 'adminToken']);
    setUser(null);
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
            <LanguageToggle />
          </View>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {!user ? (
                <>
                  <Stack.Screen name="Login">
                    {(props) => <LoginScreen {...props} onLoggedIn={handleLoggedIn} />}
                  </Stack.Screen>
                  <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
                  <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                </>
              ) : (
                <Stack.Screen name="MainTabs">
                  {(props) => <MainTabs {...props} onLogout={handleLogout} />}
                </Stack.Screen>
              )}
            </Stack.Navigator>
          </NavigationContainer>
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
  globalLangToggle: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 100,
    elevation: 20,
  },
});

