import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LinearGradient from '../../components/GradientWrapper';
import SafeKeyboardView from '../../components/SafeKeyboardView';
import appConfig from '../../config/appConfig';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as apiService from '../../utils/apiService';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminLoginScreen({ navigation, onLoggedIn }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBackToLogin = () => {
    navigation.replace('Login');
  };

  const handleAdminLogin = async () => {
    if (!username || !password) {
      Alert.alert(t('admin.errorTitle'), t('admin.enterCredentials'));
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.loginAdmin(username, password);
      if (result.success) {
        if (typeof onLoggedIn === 'function') {
          onLoggedIn();
        } else {
          navigation.replace('AdminDashboard');
        }
      } else {
        Alert.alert(t('admin.loginFailed'), t('admin.invalidServerResponse'));
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || t('admin.invalidCredentials');
      Alert.alert(t('admin.loginFailed'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[appConfig.colors.primary, appConfig.colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeKeyboardView style={styles.keyboardAvoid}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name={appConfig.navigation.admin.icon} size={64} color={colors.white} />
            <Text style={styles.title}>{t('admin.loginTitle')}</Text>
            <Text style={styles.subtitle}>{t('admin.loginSubtitle')}</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={t('admin.usernameLabel')}
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder={t('admin.passwordLabel')}
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleAdminLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={appConfig.colors.primary} />
              ) : (
                <Text style={styles.buttonText}>{t('admin.loginButton')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToLogin}
          >
            <Text style={styles.backButtonText}>{t('admin.backButton')}</Text>
          </TouchableOpacity>
        </View>
      </SafeKeyboardView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    ...shadowStyles.small,
  },
  button: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadowStyles.medium,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
