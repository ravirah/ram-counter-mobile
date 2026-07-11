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
// LEGACY single-integer accumulator of unsynced deltas (pre-Phase-2). Still read once and
// migrated into the durable event queue below, then left at 0 — never written to again.
const getPendingSyncKey = (mobile) => storageKey(mobile, 'PendingSyncCount');

// Phase 2 — durable, idempotent sync queue. Each tap becomes an event { id, delta } with a
// unique client id; the backend dedupes on that id (/activities/sync-events), so a retry after
// a kill/timeout can never double-count and a mid-request kill can never lose the tap.
const getSyncQueueKey = (mobile) => storageKey(mobile, 'SyncQueueV2');
// Flag: the one-time backlog reconciliation (recover pre-Phase-2 "history-only" counts) is done.
const getReconciledKey = (mobile) => storageKey(mobile, 'reconciledV2');
// One stable id per install (unscoped) so each device reconciles ITS OWN backlog exactly once.
const INSTALL_ID_KEY = `${appConfig.appId}_installId`;

// Unique idempotency key without a native dependency. A per-process monotonic counter plus the
// timestamp and randomness makes practical collisions impossible; addCount is serialized anyway.
let _eventSeq = 0;
const genEventId = () => {
  _eventSeq = (_eventSeq + 1) % 1000000;
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${r()}${r()}-${r()}-${Date.now().toString(16)}-${_eventSeq}`;
};

let _cachedInstallId = null;
const getInstallId = async () => {
  if (_cachedInstallId) return _cachedInstallId;
  try {
    let id = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (!id) { id = genEventId(); await AsyncStorage.setItem(INSTALL_ID_KEY, id); }
    _cachedInstallId = id;
    return id;
  } catch (_) { return 'install-unknown'; }
};

const loadSyncQueue = async (mobile) => {
  try {
    const raw = await AsyncStorage.getItem(getSyncQueueKey(mobile));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((e) => e && e.id && Number.isFinite(e.delta) && e.delta > 0)
      : [];
  } catch (_) { return []; }
};
const saveSyncQueue = async (mobile, queue) => {
  try { await AsyncStorage.setItem(getSyncQueueKey(mobile), JSON.stringify(queue)); } catch (_) {}
};

// Serializes count writes. Rapid taps / voice fire many addCount() calls; without
// this, each would read-modify-write the same history concurrently and clobber the
// others (a classic lost-update race that made totals come out lower than reality).
let _addCountChain = Promise.resolve();

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
    
    const subject = `Shri Ram Nam Bank Daily Report - ${userInfo.name} - ${date}`;
    const body = `
📊 DAILY REPORT FOR श्री राम नाम बैंक
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
This is an automated daily report from Shri Ram Nam Bank.
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

// Add राम count (syncs with backend if available).
// Public entry point: queues onto the serialization chain so concurrent calls run
// one at a time and never lose each other's increments.
export const addCount = (count = 1) => {
  const run = _addCountChain.then(() => _addCountInternal(count));
  // Keep the chain alive even if one call rejects, so later counts still run.
  _addCountChain = run.catch(() => {});
  return run;
};

const _addCountInternal = async (count = 1) => {
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

    // Durably enqueue this tap as an idempotent event (unique id) BEFORE any network call, so it
    // can never be lost by a mid-request kill and can never be double-counted on retry (the
    // backend dedupes on the id). Works offline: the event simply stays queued and drains later.
    const queue = await loadSyncQueue(mobile);
    queue.push({ id: genEventId(), delta: count });
    await saveSyncQueue(mobile, queue);

    // Best-effort immediate drain (also migrates any legacy pending + runs the one-time backlog
    // reconciliation). Any failure leaves the queue intact for the next focus / resume / flush.
    try { await _drainSyncQueue(mobile); } catch (_) {}

    return {
      todayCount: todayEntry.count,
      ...stats,
    };
  } catch (error) {
    console.error('Add count error:', error);
    throw error;
  }
};

// Flush any counts that previously failed to reach the backend. Safe to call on
// screen focus / app resume — runs on the same serialized chain as addCount so it
// can't race with an in-flight increment and double-send.
export const flushPendingSync = () => {
  const run = _addCountChain.then(() => _flushPendingInternal());
  _addCountChain = run.catch(() => {});
  return run;
};

const _flushPendingInternal = async () => {
  try {
    await _drainSyncQueue(getUserMobile());
  } catch (_) {
    // Leave the queue in place; it will be retried on the next focus / resume / flush.
  }
};

// Drains the durable sync queue through the idempotent /sync-events endpoint, migrating the
// legacy pending integer and running the one-time backlog reconciliation along the way. Safe to
// call repeatedly; runs on the same serialized chain as addCount so it can't race a live tap.
const _drainSyncQueue = async (mobile) => {
  if (!(await isBackendEnabled())) return;
  mobile = mobile || getUserMobile();

  // Migrate the legacy single-integer PendingSyncCount into the queue (once), so any counts
  // queued by the pre-Phase-2 build flow through the idempotent path. Per-install deterministic
  // id => applied at most once even across retries.
  try {
    const legacyKey = getPendingSyncKey(mobile);
    const legacy = Number(await AsyncStorage.getItem(legacyKey)) || 0;
    if (legacy > 0) {
      const installId = await getInstallId();
      const migId = `legacy-pending-${appConfig.appId}-${mobile}-${installId}`;
      const q = await loadSyncQueue(mobile);
      if (!q.some((e) => e.id === migId)) q.push({ id: migId, delta: legacy });
      await saveSyncQueue(mobile, q);
      await AsyncStorage.setItem(legacyKey, '0');
    }
  } catch (_) { /* non-fatal; retried next drain */ }

  // Send all queued events; clear only those the server acknowledges (ack-before-clear).
  const queue = await loadSyncQueue(mobile);
  if (queue.length) {
    const events = queue.map((e) => ({ clientEventId: e.id, delta: e.delta }));
    try {
      const res = await apiService.syncEvents(events);
      if (res && res.success) {
        const acked = new Set(
          res.accepted && res.accepted.length ? res.accepted : events.map((e) => e.clientEventId)
        );
        await saveSyncQueue(mobile, queue.filter((e) => !acked.has(e.id)));
      }
    } catch (err) {
      // Backend without /sync-events (e.g. MongoDB returns 501): fall back to the legacy additive
      // endpoint so those deployments keep working. SQL/production never hits this branch.
      if (err && err.response && err.response.status === 501) {
        const total = queue.reduce((s, e) => s + e.delta, 0);
        if (total > 0) await apiService.addCount(total);
        await saveSyncQueue(mobile, []);
      } else {
        throw err; // keep the queue; retry on next drain
      }
    }
  }

  // One-time backlog reconciliation for pre-Phase-2 "history-only" counts.
  await _reconcileBacklogOnce(mobile);
};

// ONE-TIME per install: recover counts that exist in local history but were never synced under
// the old build (chanted offline before the pending-queue existed). Submits only the shortfall
// that is NOT already on the server and NOT already queued, via the idempotent endpoint with a
// per-install deterministic id (applies at most once, ever). Clamped at 0 so it never lowers.
const _reconcileBacklogOnce = async (mobile) => {
  try {
    const doneKey = getReconciledKey(mobile);
    if (await AsyncStorage.getItem(doneKey)) return;

    // Need the server's current total. If offline / unreachable, bail WITHOUT setting the flag.
    let profile = null;
    try { profile = await apiService.getUserProfile(); } catch (_) {}
    if (!profile || !profile.user) return;
    const serverTotal = Number(profile.user.totalCount || 0);

    const history = await loadHistory();
    const localTotal = history.reduce((s, h) => s + (h.count || 0), 0);
    const queue = await loadSyncQueue(mobile);
    const queued = queue.reduce((s, e) => s + (e.delta || 0), 0);

    // Counts in local history that are neither on the server nor already waiting in the queue.
    const backlog = Math.max(0, localTotal - serverTotal - queued);
    if (backlog > 0) {
      const installId = await getInstallId();
      const id = `reconcile-v2-${appConfig.appId}-${mobile}-${installId}`;
      const res = await apiService.syncEvents([{ clientEventId: id, delta: backlog }]);
      if (!res || !res.success) return; // couldn't apply — retry next drain, don't set the flag
    }
    await AsyncStorage.setItem(doneKey, '1');
  } catch (_) { /* retry on the next drain */ }
};

// Counts that were added locally but have not yet been confirmed by the backend.
// Used to reconcile the displayed total: backendTotal + pending = true total, which
// reflects backend corrections (e.g. admin reset) immediately while still accounting
// for taps that haven't synced yet.
export const getPendingSyncCount = async () => {
  try {
    const mobile = getUserMobile();
    const queue = await loadSyncQueue(mobile);
    const queued = queue.reduce((s, e) => s + (e.delta || 0), 0);
    const legacy = Number(await AsyncStorage.getItem(getPendingSyncKey(mobile))) || 0;
    return queued + (legacy > 0 ? legacy : 0);
  } catch (_) {
    return 0;
  }
};

// SINGLE SOURCE OF TRUTH for everything displayed on the user screens. Mirrors the
// BACKEND exactly — no local-history fallback, no max(local) override (a locally-computed
// number is exactly what makes screens disagree with the backend). All of CounterScreen,
// StatsScreen and ProfileScreen render from this, so they can never show different values.
// If the backend is unreachable it returns { ok:false, connectionError:true } and the
// screen shows an offline state — it never substitutes a divergent local total.
export const getDisplayStats = async () => {
  // Push any unsynced taps first so the backend is current before we read it.
  try { await flushPendingSync(); } catch (_) {}

  let profileRes = null;
  let summaryRes = null;
  try { profileRes = await apiService.getUserProfile(); } catch (_) {}
  try { summaryRes = await apiService.getDailySummary(30); } catch (_) {}

  if (!profileRes || !profileRes.user) {
    return { ok: false, connectionError: true };
  }

  const summaries = Array.isArray(summaryRes?.summaries) ? summaryRes.summaries : [];
  const history = summaries
    .map((s) => ({
      date: s.date,
      count: s.dailyCount || 0,
      firstCountAt: s.firstCountAt || null,
      lastCountAt: s.lastCountAt || null,
      activeDurationSeconds: s.activeDurationSeconds ?? null,
    }))
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  const computed = computeStatsFromHistory(history);
  const total = Number(profileRes.user.totalCount || 0);
  const todayKey = moment().format('YYYY-MM-DD');
  const todayRow = history.find((h) => h.date === todayKey) || null;
  const today = Number(todayRow?.count || 0);
  const daysActive = Math.max(history.filter((h) => (h.count || 0) > 0).length, 1);
  const best = history.reduce((m, h) => Math.max(m, h.count || 0), 0);

  return {
    ok: true,
    connectionError: false,
    total,
    today,
    best,
    daysActive,
    average: total / daysActive,
    currentStreak: computed.currentStreak,
    bestStreak: computed.bestStreak,
    history,
    todayTiming: todayRow,
  };
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
  const validWords = new Set([
    mantraDevanagari,
    'रम',
    mantraEnglish,
    'raam',
  ]);

  if (!input) return 0;
  // Strip punctuation and split into words
  const cleaned = input.replace(/[.,!?;:'"()]/g, '').trim();
  if (!cleaned) return 0;
  const words = cleaned.split(/\s+/);
  const isValidWord = (w) => validWords.has(String(w || '').toLowerCase()) || validWords.has(w);

  // Strict mode: if all words match, return total (typed input)
  const allValid = words.every(isValidWord);
  if (allValid) return words.length;

  // Lenient mode: count matching words only (voice input may have filler words)
  const matchCount = words.filter(isValidWord).length;
  return matchCount;
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





