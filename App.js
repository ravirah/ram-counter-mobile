import React, { useEffect, useState } from 'react';
import { StyleSheet, LogBox, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Disable non-critical development warnings for performance
if (!__DEV__) {
  LogBox.ignoreAllLogs();
} else {
  // Ignore specific non-critical warnings in development
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
  ]);
}

// Screens
import LoginScreen from './src/screens/auth/LoginScreen';
import CounterScreen from './src/screens/app/CounterScreen';
import StatsScreen from './src/screens/app/StatsScreen';

// Navigation Setup
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Counter') {
            iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
          } else if (route.name === 'Stats') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#D4A373',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#f5f5f5',
          borderTopColor: '#e0e0e0',
          paddingBottom: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#FF9933',
        },
        headerTintColor: '#000',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen
        name="Counter"
        component={CounterScreen}
        options={{
          title: 'राम Counter',
          tabBarLabel: 'Count',
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: 'Statistics',
          tabBarLabel: 'Stats',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('localUser');
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load local user', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleLoggedIn = async (profile) => {
    try {
      await AsyncStorage.setItem('localUser', JSON.stringify(profile));
      setUser(profile);
    } catch (error) {
      console.error('Failed to save local user', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9933" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLoggedIn={handleLoggedIn} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
