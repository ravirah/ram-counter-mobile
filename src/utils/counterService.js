import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import * as apiService from './apiService';
import appConfig from '../config/appConfig';

// Storage keys are scoped per-user by mobile number (the unique identifier).
// Falls back to the old unscoped keys if no mobile is found (first-launch edge case).
const ADMIN_EMAIL_KEY = 'adminEmail';
const USER_INFO_KEY = 'userInfo';
const BACKEND_ENABLED_KEY = 'backendEnabled';

// In-memory cache for the logged-in user's mobile — avoids repeated AsyncStorage reads.
// Set once at login via initUserMobile(), read synchronously everywhere else.
let _cachedMobile = null;

export const initUserMobile = async (mobile) => {
  if (mobile) {
    _cachedMobile = mobile;
    return;
  }
  // Fallback: read from storage (app cold-start before login screen sets it)
  try {
    const raw = await AsyncStorage.getItem('localUser');
    if (raw) {
      const u = JSON.parse(raw);
      if (u.mobile) _cachedMobile = u.mobile;
    }
  } catch (_) { /* ignore */ }
};

const getUserMobile = () => _cachedMobile;

const storageKey = (mobile, suffix) =>
  mobile
    ? `${appConfig.appId}_${mobile}_${suffix}`
    : `${appConfig.appId}${suffix}`;

const getHistoryKey = (mobile) => storageKey(mobile, 'CountHistory');
const getTodayCountKey = (mobile) => storageKey(mobile, 'TodayCount');
const getLastResetKey = (mobile) => storageKey(mobile, 'LastResetDate');

// Email configuration
const ADMIN_EMAIL = appConfig.adminEmail || 'admin@ramcounter.com';

// Function to get user info
const getUserInfo = async () => {
  try {
    const userStr = await AsyncStorage.getItem('localUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      return {
        name: user.name || 'User',
        email: user.email || user.mobile || 'N/A',
        mobile: user.mobile || 'N/A',
      };
    }
    return { name: 'User', email: 'N/A', mobile: 'N/A' };
  } catch (error) {
    return { name: 'User', email: 'N/A', mobile: 'N/A' };
  }
};

// Function to send daily report email
const sendDailyReportEmail = async (date, count, totalCount, streak, history) => {
  try {
    const userInfo = await getUserInfo();
    
    const subject = `राम Bank Daily Report - ${userInfo.name} - ${date}`;
    const body = `
📊 DAILY REPORT FOR राम BANK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 USER INFORMATION:
   Name: ${userInfo.name}
   Email: ${userInfo.email}
   Mobile: ${userInfo.mobile}

📅 DATE: ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 DAILY SUMMARY:
   राम/Ram Count (Yesterday): ${count}
   
🏆 OVERALL STATISTICS:
   Total Count (All Time): ${totalCount}
   Current Streak: ${streak} days
   Days Active: ${history.filter(h => h.count > 0).length}
   
📊 LAST 7 DAYS ACTIVITY:
${history.slice(-7).map(h => `   ${h.date}: ${h.count} राम`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated daily report from राम Bank.
    `.trim();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 DAILY REPORT EMAIL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${ADMIN_EMAIL}`);
    console.log(`Subject: ${subject}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(body);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Store report in AsyncStorage for admin dashboard access
    const reportKey = `report_${date}`;
    await AsyncStorage.setItem(reportKey, JSON.stringify({
      date,
      user: userInfo,
      dailyCount: count,
      totalCount,
      streak,
      last7Days: history.slice(-7),
      timestamp: new Date().toISOString(),
    }));

    // To integrate with actual email service, uncomment and configure:
    /*
    // Example with EmailJS:
    const emailData = {
      service_id: 'your_service_id',
      template_id: 'your_template_id',
      user_id: 'your_user_id',
      template_params: {
        to_email: ADMIN_EMAIL,
        user_name: userInfo.name,
        user_email: userInfo.email,
        user_mobile: userInfo.mobile,
        date: date,
        daily_count: count,
        total_count: totalCount,
        streak: streak,
        days_active: history.filter(h => h.count > 0).length,
        last_7_days: history.slice(-7).map(h => `${h.date}: ${h.count}`).join(', '),
      }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      console.log('✅ Daily report email sent successfully');
    }
    */

  } catch (error) {
    console.error('❌ Error sending daily report email:', error);
  }
};

// Internal: load full history from storage (scoped by mobile)
const loadHistory = async () => {
  try {
    const mobile = getUserMobile();
    const key = getHistoryKey(mobile);
    const raw = await AsyncStorage.getItem(key);

    // Migrate: if per-user key is empty but old unscoped key has data, copy it over
    if (!raw && mobile) {
      const legacyRaw = await AsyncStorage.getItem(appConfig.appId + 'CountHistory');
      if (legacyRaw) {
        await AsyncStorage.setItem(key, legacyRaw);
        return JSON.parse(legacyRaw)
          .filter((item) => item && item.date && typeof item.count === 'number')
          .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
      }
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.date && typeof item.count === 'number')
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  } catch (error) {
    console.error('Load history error:', error);
    return [];
  }
};

// Internal: save history back to storage (scoped by mobile)
const saveHistory = async (history) => {
  try {
    const mobile = getUserMobile();
    await AsyncStorage.setItem(getHistoryKey(mobile), JSON.stringify(history));
  } catch (error) {
    console.error('Save history error:', error);
  }
};

// Compute streaks and totals from history — exported for use in screens that have backend data
export const computeStatsFromHistory = (history) => {
  if (!history || history.length === 0) {
    return {
      totalCount: 0,
      daysActive: 0,
      totalDays: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
  }

  const totalCount = history.reduce((sum, d) => sum + (d.count || 0), 0);
  const daysActive = history.filter((d) => (d.count || 0) > 0).length;
  const totalDays = history.length;

  let currentStreak = 0;
  let bestStreak = 0;

  // Compute streaks by walking backwards from most recent day
  const byDate = history.slice().sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  let tempStreak = 0;
  let prevDate = null;

  for (let i = 0; i < byDate.length; i++) {
    const item = byDate[i];
    const count = item.count || 0;
    const date = moment(item.date, 'YYYY-MM-DD');

    if (count > 0) {
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diff = date.diff(prevDate, 'days');
        if (diff === 1) {
          tempStreak += 1;
        } else if (diff > 1) {
          tempStreak = 1;
        }
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }

    prevDate = date;
  }

  // Current streak: walk backwards from latest date until a break
  const todayStr = moment().format('YYYY-MM-DD');
  const todayEntry = byDate.find((d) => d.date === todayStr);
  let idx = byDate.length - 1;
  let running = 0;
  let expectingDate = todayEntry ? moment(todayStr, 'YYYY-MM-DD') : null;

  while (idx >= 0) {
    const item = byDate[idx];
    const itemDate = moment(item.date, 'YYYY-MM-DD');
    const count = item.count || 0;

    if (expectingDate && !itemDate.isSame(expectingDate, 'day')) {
      // If there is a gap in dates, stop the current streak
      break;
    }

    if (count > 0) {
      running += 1;
      expectingDate = itemDate.clone().subtract(1, 'day');
      idx -= 1;
    } else {
      break;
    }
  }

  currentStreak = running;

  return {
    totalCount,
    daysActive,
    totalDays,
    currentStreak,
    bestStreak,
  };
};

// Check if backend is enabled
export const isBackendEnabled = async () => {
  try {
    // If we have an auth token, backend login succeeded — sync is enabled
    const token = await AsyncStorage.getItem('authToken');
    if (token) return true;
    return false;
  } catch (error) {
    return false;
  }
};

// Add राम count (syncs with backend if available)
export const addCount = async (count = 1) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const history = await loadHistory();

    const last = history[history.length - 1];
    let todayEntry;
    if (last && last.date === today) {
      todayEntry = { ...last, count: (last.count || 0) + count };
      history[history.length - 1] = todayEntry;
    } else {
      todayEntry = { date: today, count };
      history.push(todayEntry);
    }

    await saveHistory(history);

    // Keep todayCount/lastResetDate in sync for existing callers
    const mobile = getUserMobile();
    await AsyncStorage.setItem(getTodayCountKey(mobile), String(todayEntry.count));
    await AsyncStorage.setItem(getLastResetKey(mobile), today);

    const stats = computeStatsFromHistory(history);

    // Try to sync with backend
    const backendEnabled = await isBackendEnabled();
    console.log('🔵 Backend enabled:', backendEnabled);
    if (backendEnabled) {
      try {
        console.log('🔵 Syncing count to backend:', count);
        const result = await apiService.addCount(count);
        console.log('🔵 Backend sync successful:', result);
      } catch (error) {
        console.error('🔴 Backend sync failed:', error.message);
        console.log('Continuing with local storage only');
      }
    } else {
      console.log('🔴 Backend disabled, using local storage only');
    }

    return {
      todayCount: todayEntry.count,
      ...stats,
    };
  } catch (error) {
    console.error('Add count error:', error);
    throw error;
  }
};

// Get today's count (local-only)
export const getTodayCount = async () => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const history = await loadHistory();
    const todayEntry = history.find((d) => d.date === today);
    return {
      date: today,
      count: todayEntry ? todayEntry.count || 0 : 0,
    };
  } catch (error) {
    console.error('Get today count error:', error);
    return { date: moment().format('YYYY-MM-DD'), count: 0 };
  }
};

// Get count history for the last `days` days (local-only)
export const getCountHistory = async (days = 30) => {
  try {
    const history = await loadHistory();
    if (!days || days <= 0) return history;

    const fromDate = moment().subtract(days - 1, 'days').startOf('day');
    return history.filter((item) =>
      moment(item.date, 'YYYY-MM-DD').isSameOrAfter(fromDate, 'day')
    );
  } catch (error) {
    console.error('Get history error:', error);
    return [];
  }
};

// Get aggregate stats (local-only)
export const getStats = async () => {
  try {
    const history = await loadHistory();
    return computeStatsFromHistory(history);
  } catch (error) {
    console.error('Get stats error:', error);
    return {
      totalCount: 0,
      daysActive: 0,
      totalDays: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
  }
};

// Check if count has been reset today (local-only)
export const checkDailyReset = async () => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const mobile = getUserMobile();
    const lastResetDate = await AsyncStorage.getItem(getLastResetKey(mobile));
    const history = await loadHistory();

    if (!lastResetDate || lastResetDate !== today) {
      // Before resetting, send yesterday's report if there was activity
      if (lastResetDate) {
        const yesterdayEntry = history.find((h) => h.date === lastResetDate);
        if (yesterdayEntry && yesterdayEntry.count > 0) {
          const stats = computeStatsFromHistory(history);
          await sendDailyReportEmail(lastResetDate, yesterdayEntry.count, stats.totalCount, stats.currentStreak, history);
        }
      }

      await AsyncStorage.setItem(getLastResetKey(mobile), today);
      await AsyncStorage.setItem(getTodayCountKey(mobile), '0');

      // Ensure we have an entry for today in history (with 0 to start)
      if (!history.find((h) => h.date === today)) {
        history.push({ date: today, count: 0 });
        await saveHistory(history);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('Check daily reset error:', error);
    return false;
  }
};

// Get local count (today)
export const getLocalCount = async () => {
  try {
    const mobile = getUserMobile();
    const stored = await AsyncStorage.getItem(getTodayCountKey(mobile));
    const parsed = parseInt(stored || '0', 10);
    if (!Number.isNaN(parsed)) return parsed;

    // Fallback to history if needed
    const todayData = await getTodayCount();
    return todayData.count || 0;
  } catch (error) {
    console.error('Get local count error:', error);
    return 0;
  }
};

// Update local count (and keep history in sync)
export const updateLocalCount = async (newCount) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const history = await loadHistory();
    const idx = history.findIndex((h) => h.date === today);

    if (idx >= 0) {
      history[idx] = { ...history[idx], count: newCount };
    } else {
      history.push({ date: today, count: newCount });
    }

    await saveHistory(history);
    const mobile = getUserMobile();
    await AsyncStorage.setItem(getTodayCountKey(mobile), String(newCount));
    await AsyncStorage.setItem(getLastResetKey(mobile), today);

    return newCount;
  } catch (error) {
    console.error('Update local count error:', error);
    throw error;
  }
};

// Validate mantra input - checks if input matches the configured mantra
// Returns the number of valid mantra words in the input (0 = invalid).
// Accepts space-separated entries, e.g. "Ram Ram" = 2, "राम राम राम" = 3.
export const validateRamInput = (input) => {
  const appConfig = require('../config/appConfig').default;
  const mantraDevanagari = appConfig.mantraWord;
  const mantraEnglish = appConfig.mantraWordEnglish.toLowerCase();
  if (!input) return 0;
  const words = input.trim().split(/\s+/);
  const allValid = words.every(
    w => w.toLowerCase() === mantraEnglish || w === mantraDevanagari
  );
  return allValid ? words.length : 0;
};

// Get current streak + best streak (local-only helper)
export const getCurrentStreak = async () => {
  try {
    const history = await loadHistory();
    const { currentStreak, bestStreak } = computeStatsFromHistory(history);
    return { currentStreak, bestStreak };
  } catch (error) {
    console.error('Get streak error:', error);
    return { currentStreak: 0, bestStreak: 0 };
  }
};

// Sync local count - no-op in offline mode, just ensures history is up to date
export const syncCount = async (localCount) => {
  try {
    await updateLocalCount(localCount);
    const stats = await getStats();
    return { success: true, ...stats };
  } catch (error) {
    console.error('Sync count error:', error);
    throw error;
  }
};
