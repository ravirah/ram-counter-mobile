import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

const HISTORY_KEY = 'ramCountHistory';
const TODAY_COUNT_KEY = 'todayCount';
const LAST_RESET_KEY = 'lastResetDate';

// Internal: load full history from storage
const loadHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
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

// Internal: save history back to storage
const saveHistory = async (history) => {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Save history error:', error);
  }
};

// Internal: compute streaks and totals from history
const computeStatsFromHistory = (history) => {
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

// Add राम count (local-only)
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
    await AsyncStorage.setItem(TODAY_COUNT_KEY, String(todayEntry.count));
    await AsyncStorage.setItem(LAST_RESET_KEY, today);

    const stats = computeStatsFromHistory(history);

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
    const lastResetDate = await AsyncStorage.getItem(LAST_RESET_KEY);
    const history = await loadHistory();

    if (!lastResetDate || lastResetDate !== today) {
      await AsyncStorage.setItem(LAST_RESET_KEY, today);
      await AsyncStorage.setItem(TODAY_COUNT_KEY, '0');

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
    const stored = await AsyncStorage.getItem(TODAY_COUNT_KEY);
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
    await AsyncStorage.setItem(TODAY_COUNT_KEY, String(newCount));
    await AsyncStorage.setItem(LAST_RESET_KEY, today);

    return newCount;
  } catch (error) {
    console.error('Update local count error:', error);
    throw error;
  }
};

// Validate राम input - checks if input is exactly "राम"
export const validateRamInput = (input) => {
  const ramText = 'राम';
  if (!input) return false;
  return input.trim() === ramText;
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
