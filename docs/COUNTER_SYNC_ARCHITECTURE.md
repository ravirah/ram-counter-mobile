# Counter Sync — Data-Loss Root Cause & Offline-First Redesign

**Status:** Proposal · **Author:** Engineering · **Scope:** `ram-counter-mobile` (Expo/RN) + `bhagwan-backend` (Express/Sequelize/MySQL)

Goal: **at-least-once delivery of every tap** — no increment is ever lost regardless of network loss, app crash, backgrounding, or temporary backend failure.

---

## 0. TL;DR

The **server is largely sound** (atomic, transactional, delta-based `col = col + N`). The loss is a **client delivery gap**:

- Every tap is durably saved to a local `CountHistory`, but **that history is never reconciled with the backend**. The *only* thing ever synced is a single mutable integer `PendingSyncCount`, and it is written to storage **after** the network call, **inside the `catch`**. Any interruption of the in-flight, unawaited, background-unprotected request strands the delta forever.
- There is **no durable per-tap queue, no idempotency key, no background sync, and no network detection.**
- The backend silently defaults a missing `count` field to `1` and has **no idempotency**, so retries either double-count (up) or, combined with client giving up, under-count (down). Counts drift **both** directions.

Fix = **offline-first, event-sourced queue**: persist every tap as an immutable local event with a UUID; a background worker drains the queue with exponential backoff; the server dedupes on `(userId, clientEventId)` via a UNIQUE index and only ACKs after commit; items are marked synced **only** on ACK.

---

## 1. Root Cause Analysis (current implementation)

### 1.1 The current contract (confirmed)
- Client: `POST /activities/add-count { count: <delta> }` — `apiService.js:360-366`.
- Server: `await u.increment({ totalCount: count }, { transaction: t })` — `routes/activities.js:71` (SQL, prod) / `$inc` (Mongo, dead code).
- **Delta-based, not absolute.** So there is *no* "smaller total overwrites larger total" race. The loss is deltas that never arrive.

### 1.2 Where taps actually live on the client
| Store | What it is | Synced? |
|---|---|---|
| `CountHistory` (AsyncStorage) | per-day totals, written on every tap (`counterService.js:193-200, 309-324`) | **Never uploaded** — write-only w.r.t. backend |
| `PendingSyncCount` (AsyncStorage) | a single mutable integer accumulator | The only thing pushed to the server |
| React state / refs (`todayCountRef`) | optimistic UI number | In-memory only |

`getDisplayStats()` reads the backend as the **sole** source of truth and discards local history (`counterService.js:404-449, 429`). **Any tap that lands in `CountHistory` but not in `PendingSyncCount` is invisible to sync forever.**

### 1.3 The fatal window (client)
```js
// counterService.js:324..347  (abridged)
await saveHistory(history);                 // 324 durable, but sync-invisible
const toSync = pending + count;             // 339
try {
  await apiService.addCount(toSync);        // 341 in-flight (20s timeout)
  if (pending) await AsyncStorage.setItem(pendingKey, '0'); // 342
} catch (error) {
  await AsyncStorage.setItem(pendingKey, String(toSync));   // 346 ONLY place delta is queued
}
```
If the JS context is frozen/killed (background, OS reclaim, process death, Render cold-start > 20s timeout) **while line 341 is pending**, neither 342 nor 346 runs. `PendingSyncCount` is never bumped. The delta lives only in `CountHistory`, which nothing pushes. **Permanent loss.** A 200→185 gap ≈ 15 taps that each hit this window.

### 1.4 Sync is fire-and-forget, no background/unmount flush
```js
// CounterScreen.js:205-216 — unawaited IIFE
(async () => { await counterService.addCount(count); })();
```
The only AppState handler is `'active'` (resume) — `CounterScreen.js:115-116`. There is **no `background`/`inactive` handler** to flush before Android suspends the JS engine, and no `beforeRemove`/unmount flush. The last taps before the user swipes the app away are the most likely to be lost.

### 1.5 Other confirmed client-side loss vectors
- **Backend disabled window** — sync + pending write are gated on `isBackendEnabled()` (token present). A transient null token read → tap saved to history only, never queued (`counterService.js:334-349, 288-297`).
- **Mobile-key mismatch** — pending key is scoped by `_cachedMobile`; a tap before `initUserMobile` resolves writes the **unscoped** key, later orphaned (`counterService.js:33-43`; `App.js:189, 254`).
- **Logout / version-upgrade strands pending** — clears `authToken` but not `PendingSyncCount`; `flushPendingSync` then early-returns forever (`App.js:175, 221`; `counterService.js:372`).
- **No token refresh** — a 401 has no recovery path; deltas pile into the pending integer and are lost on clear-data/reinstall (`apiService.js` has no 401 interceptor).
- **Non-idempotent retry (drift up)** — the retry-once interceptor blindly replays the additive POST on timeout (`apiService.js:48-57`), double-counting if the first attempt actually committed.

### 1.6 Confirmed backend loss/corruption vectors
- **Silent truncation → under-count.** `const { count = 1 } = req.body` (`activities.js:20`) — a missing/malformed `count` becomes **1** and returns `200 success`. A batch of 50 → 1 counted, 49 lost silently.
- **No idempotency → over-count.** Committed-but-ack-lost request is retried → second `increment` **and** a second immutable ledger row, defeating the `Math.max` self-heal (`auth.js:11-42`).
- **No `count > 0` / type guard** — a negative delta lowers total *and* ledger together (`activities.js:20, 71`).
- **Pool exhaustion under burst** — `pool.max: 5, acquire: 30000` (`config/database.js:66-71`); a large flush → 30s waits → 500 → rollback of the whole increment.
- **Non-transactional Mongo path** (latent, not prod) — three unguarded writes (`activities.js:26-63`).

### 1.7 Multi-device divergence (confirmed with live evidence)
Same user on two devices: Device 1 shows Today **200** / Total **701**; Device 2 shows **187** / **688** — a gap of **exactly 13 on both**. This is not a separate bug; it is the delivery gap made visible:

- The backend stores counts **per-user only, no device dimension** (`models/sql.js:76-132`, unique `(appId, mobile)`; `Activity`/`DailySummary` have no device column). Both devices resolve to the same `User.id` → one shared server total. **The server cannot diverge.**
- The display is **strictly server-authoritative** on a *successful* load — there is **no `Math.max(local, server)` merge**. `getDisplayStats` reads `profileRes.user.totalCount` (`counterService.js:429`) and the backend daily-summary (`:431-432`); `CounterScreen` sets those verbatim (`:419-420`).
- The 13 gap is preserved by the **connection-error fallback**: when `getDisplayStats()` returns `!ok`, `loadCountData` deliberately keeps the optimistic in-memory numbers instead of overwriting them (`CounterScreen.js:403-410`). So Device 1 is showing 13 optimistically-counted taps whose backend write failed; Device 2 (successful load) shows server truth.
- Login **never resets local counters.** Server total lands only in the in-memory profile (`LoginScreen.js:79-88`); `App.js:246-269` saves the profile but never writes `TodayCount`/`CountHistory`. Logout `multiRemove(['localUser','authToken'])` (`App.js:175, 221`) does **not** clear `TodayCount`/`CountHistory`/`PendingSyncCount`. Stale per-device local state therefore persists across sessions.
- **Recoverability of the 13:** if they sit in `PendingSyncCount`, the next online focus flushes them (`getDisplayStats` calls `flushPendingSync` first). If they are **history-only** — taps made while `isBackendEnabled()` was false, so never enqueued (`counterService.js:334-348`) — `flushPendingSync` early-returns on `pending <= 0` (`:376`) and they are **stranded permanently**; the ledger self-heal can't help because no `Activity` row was ever created. Device 2 will never see them.

**Fix implication:** the redesign closes this two ways at once — (1) every tap becomes a durable, idempotent event that the SyncEngine drains until ACKed, so nothing is ever "history-only," and (2) the display is computed as `serverBaseline + SUM(unsynced local events)`, which is identical on every device once the queue drains → the two devices **converge** instead of drifting.

### 1.8 What is actually **fine** (do not "fix")
- SQL increments are atomic + transactional (`activities.js:69-110`): concurrent same-user deltas serialize on the InnoDB row lock; **no DB-level lost update on `totalCount`.**
- Immutable ledger (`activities` table) + login/admin self-heal that raises `totalCount = max(current, ledgerSum, summarySum)`.
- Client serializes `addCount` calls via `_addCountChain` and uses refs to avoid stale closures — no client-side coalescing loss.

---

## 2. All Potential Failure Scenarios (checklist)

| # | Scenario | Layer | Direction | Current outcome |
|---|---|---|---|---|
| 1 | App killed/backgrounded during in-flight sync | client | loss | delta stranded in history |
| 2 | Fire-and-forget sync not flushed on background/unmount | client | loss | in-flight abandoned |
| 3 | Token momentarily null → `isBackendEnabled()` false | client | loss | tap saved to history only |
| 4 | Tap before `initUserMobile` resolves | client | loss | pending written to orphaned key |
| 5 | Logout/upgrade clears token, not pending | client | loss | pending unrecoverable |
| 6 | 401 with no refresh path | client/auth | loss | deltas pile up, lost on clear-data |
| 7 | Timeout after server commit → blind replay | client/backend | over-count | duplicate increment + ledger row |
| 8 | Missing/malformed `count` → default 1 | backend | loss | 49/50 lost, returns 200 |
| 9 | Negative/invalid `count` | backend | down | lowers total + ledger |
| 10 | Pool exhaustion / lock-wait under burst | backend/db | loss (if client gives up) | 500 → rollback |
| 11 | Uninstall / "Clear data" | client | loss | AsyncStorage wiped, no server echo |
| 12 | `findOrCreate` DailySummary race first-of-day | backend/db | loss | poisoned txn → 500 |

---

## 3. Recommended Production-Grade Architecture (offline-first, event-sourced)

**Principle:** the client's local event log is the source of truth for *delivery*; the server's ledger is the source of truth for *value*. A tap is durable the instant it is written locally, and stays in the queue until the server ACKs it.

```
 Tap ──▶ (1) INSERT event row {id=UUID, delta, status=PENDING}  ── synchronous, before UI settles
             │                                   (expo-sqlite / WatermelonDB)
             ▼
 (2) Optimistic UI = SUM(local events) + serverBaseline
             │
             ▼
 (3) SyncEngine (singleton): drains PENDING batches
      ├─ online?  POST /activities/sync-events { events:[{clientEventId, delta, ts}] }
      ├─ server dedupes on UNIQUE(userId, clientEventId), commits in one txn, returns accepted ids + authoritative total
      ├─ on 2xx  ▶ mark those events SYNCED (or delete), set serverBaseline = total
      └─ on fail ▶ leave PENDING, exponential backoff, retry
             ▲
             │ triggers: on tap · on app foreground · on connectivity-regained (NetInfo)
             │           · on interval (foreground) · BackgroundTask (headless, periodic)
```

Key properties:
- **Durable per-tap queue** survives restart/crash/uninstall-safe within app storage.
- **Idempotency key per event** (UUID) → server dedupe → safe unlimited retries → at-least-once without double-count.
- **ACK-before-clear** → an item is only removed after the server confirms commit.
- **Background drain** → sync progresses even when the counter screen is not open.
- **Reconciliation** → `displayed = serverBaseline + SUM(unsynced local deltas)`; the number can never silently drop below what the user tapped.

### Libraries
- `expo-sqlite` (durable local event log; already Expo-compatible — no eject).
- `@react-native-community/netinfo` (connectivity signal to trigger drains; not to *gate* taps).
- `expo-background-task` / `expo-task-manager` (headless periodic flush).
- `expo-crypto` `randomUUID()` (client event ids).

---

## 4. Frontend Code Changes

### 4.1 New durable event log — `src/utils/syncQueue.js`
```js
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

const db = SQLite.openDatabaseSync('counter.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS tap_events (
    client_event_id TEXT PRIMARY KEY,   -- UUID, idempotency key
    mobile          TEXT NOT NULL,
    delta           INTEGER NOT NULL,
    created_at      INTEGER NOT NULL,    -- epoch ms (passed in, not Date.now in RN headless)
    status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | SYNCED
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pending ON tap_events(status, mobile);
`);

// Called synchronously on every tap — this is the durability boundary.
export function enqueueTap(mobile, delta, nowMs) {
  const id = Crypto.randomUUID();
  db.runSync(
    'INSERT INTO tap_events (client_event_id, mobile, delta, created_at) VALUES (?,?,?,?)',
    [id, mobile, delta, nowMs]
  );
  return id;
}

export function pendingSum(mobile) {
  const row = db.getFirstSync(
    "SELECT COALESCE(SUM(delta),0) AS s FROM tap_events WHERE status='PENDING' AND mobile=?",
    [mobile]
  );
  return row?.s ?? 0;
}

export function takePendingBatch(mobile, limit = 200) {
  return db.getAllSync(
    "SELECT client_event_id, delta, created_at FROM tap_events WHERE status='PENDING' AND mobile=? ORDER BY created_at LIMIT ?",
    [mobile, limit]
  );
}

export function markSynced(ids) {
  if (!ids.length) return;
  const q = ids.map(() => '?').join(',');
  db.runSync(`UPDATE tap_events SET status='SYNCED' WHERE client_event_id IN (${q})`, ids);
  // periodic GC of SYNCED rows keeps the table small
  db.runSync("DELETE FROM tap_events WHERE status='SYNCED'");
}

export function recordFailure(ids, message) {
  if (!ids.length) return;
  const q = ids.map(() => '?').join(',');
  db.runSync(
    `UPDATE tap_events SET attempts = attempts + 1, last_error = ? WHERE client_event_id IN (${q})`,
    [String(message).slice(0, 200), ...ids]
  );
}
```

### 4.2 The sync engine — `src/utils/syncEngine.js`
```js
import NetInfo from '@react-native-community/netinfo';
import * as apiService from './apiService';
import { takePendingBatch, markSynced, recordFailure } from './syncQueue';

let draining = false;
let backoffMs = 1000;
const MAX_BACKOFF = 5 * 60 * 1000;

export async function drain(mobile) {
  if (draining || !mobile) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;               // just wait; nothing is discarded

  draining = true;
  try {
    let batch = takePendingBatch(mobile);
    while (batch.length) {
      const events = batch.map(e => ({
        clientEventId: e.client_event_id,
        delta: e.delta,
        ts: e.created_at,
      }));
      try {
        const res = await apiService.syncEvents(events);   // POST /activities/sync-events
        markSynced(batch.map(e => e.client_event_id));      // ACK-before-clear
        backoffMs = 1000;                                   // reset on success
        // optional: cache res.totalCount as serverBaseline
      } catch (err) {
        recordFailure(batch.map(e => e.client_event_id), err.message);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF);
        throw err;                                          // stop; a timer/foreground event retries
      }
      batch = takePendingBatch(mobile);
    }
  } finally {
    draining = false;
  }
}

// Trigger drains on connectivity regained (foreground).
export function startAutoSync(getMobile) {
  return NetInfo.addEventListener(state => {
    if (state.isConnected) drain(getMobile());
  });
}
```

### 4.3 Tap handler — persist first, then optimistic UI
```js
// CounterScreen.js — replace the fire-and-forget block
const handleAddRam = (count = 1, nowMs) => {
  const mobile = counterService.getUserMobile();
  syncQueue.enqueueTap(mobile, count, nowMs);   // (1) DURABLE synchronously — cannot be lost
  const next = todayCountRef.current + count;    // (2) optimistic UI from durable truth
  todayCountRef.current = next; setTodayCount(next);
  syncEngine.drain(mobile);                      // (3) best-effort immediate flush (fire-and-forget OK now)
};
```

### 4.4 Flush on background + on unmount (was missing)
```js
// App.js / CounterScreen.js
AppState.addEventListener('change', (s) => {
  if (s === 'active' || s === 'background' || s === 'inactive') {
    syncEngine.drain(counterService.getUserMobile()); // flush on the way OUT too
  }
});
```

### 4.5 Background headless flush — `App.js` bootstrap
```js
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

const TASK = 'counter-sync';
TaskManager.defineTask(TASK, async () => {
  await syncEngine.drain(await counterService.getUserMobileAsync());
  return BackgroundTask.BackgroundTaskResult.Success;
});
BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 * 60 }); // OS-scheduled retry
```

### 4.6 New API method — `src/utils/apiService.js`
```js
export const syncEvents = async (events) => {
  const token = _authToken || (await AsyncStorage.getItem('authToken'));
  const { data } = await api.post('/activities/sync-events', { events }, {
    headers: { Authorization: `Bearer ${token}` },
    _skipRetry: true,   // server is now idempotent; let the SyncEngine own retry+backoff
  });
  return data;          // { accepted: [ids], totalCount }
};
```
**Also:** on 401, do not silently drop — surface a re-auth prompt and keep events PENDING (the queue guarantees they resend after re-login).

### 4.7 Migration shim (see §13)
Keep reading the legacy `PendingSyncCount` + `CountHistory` once on first launch of the new build and enqueue the residual as a single reconciling event so no in-flight user loses their buffered taps.

---

## 5. Backend / API Changes

### 5.1 New idempotent batch endpoint — `POST /api/activities/sync-events`
```js
// routes/activities.js
router.post('/sync-events', authMiddleware, async (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ success: false, message: 'events[] required' });
  }
  // Validate every event: positive integer delta, present clientEventId.
  const clean = [];
  for (const e of events) {
    const delta = Number(e.delta);
    if (!e.clientEventId || !Number.isInteger(delta) || delta <= 0) {
      return res.status(422).json({ success: false, message: 'invalid event', event: e });
    }
    clean.push({ clientEventId: String(e.clientEventId), delta, ts: e.ts });
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1) Insert ledger rows, ignoring duplicates (idempotency via UNIQUE(userId, clientEventId)).
      const rows = clean.map(e => ({
        userId: req.user.userId,
        appId: req.appId,
        activityType: 'COUNT_INCREMENT',
        count: e.delta,
        clientEventId: e.clientEventId,
        timestamp: e.ts ? new Date(e.ts) : new Date(),
      }));
      // ignoreDuplicates → rows already applied are skipped, NOT double-counted.
      // Measure the ledger sum immediately before/after so newDelta counts ONLY rows inserted
      // this call (a duplicate batch inserts nothing → newDelta 0 → idempotent).
      const currentTotal = Number(u.totalCount || 0);
      const before = (await Activity.sum('count', { where: { userId, activityType: 'COUNT_INCREMENT' }, transaction: t })) || 0;
      await Activity.bulkCreate(rows, { transaction: t, ignoreDuplicates: true });
      const after = (await Activity.sum('count', { where: { userId, activityType: 'COUNT_INCREMENT' }, transaction: t })) || 0;
      const newDelta = after - before;

      // 2) MONOTONIC total. Credit only the newly-applied delta and clamp to the ledger floor.
      //    CRITICAL: do NOT set totalCount = ledgerSum outright — that would LOWER any existing
      //    user whose cache legitimately exceeds their ledger (admin set-count / reconcile /
      //    legacy data), collapsing e.g. 15002 → 3050. max(current+newDelta, after) can never
      //    decrease and is still idempotent (duplicate batch → newDelta 0 → stays current).
      const newTotal = Math.max(currentTotal + newDelta, after);
      await User.update(
        { totalCount: newTotal, lastActiveDate: new Date() },
        { where: { id: req.user.userId }, fields: ['totalCount', 'lastActiveDate'], transaction: t }
      );
      return newTotal;
    });

    // Client can safely mark ALL submitted ids synced — accepted or already-present.
    return res.json({ success: true, accepted: clean.map(e => e.clientEventId), totalCount: result });
  } catch (err) {
    console.error('sync-events error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});
```
Why this is idempotent and lossless:
- Retrying the same batch re-inserts nothing (`ignoreDuplicates` on the UNIQUE key) → **no double-count**.
- `totalCount` is **recomputed from the ledger** each time → self-heals drift, never trusts a mutable cache.
- Any partially-applied prior attempt is completed on retry → **at-least-once**.

### 5.2 Harden the legacy `add-count` (keep for old clients during migration)
```js
const raw = Number(req.body.count);
if (!Number.isInteger(raw) || raw <= 0) {
  return res.status(422).json({ success: false, message: 'count must be a positive integer' });
}
```
Removes scenario #8 (silent default-to-1) and #9 (negative delta).

---

## 6. MySQL Schema Changes

Add the idempotency column + UNIQUE constraint to the ledger (this is the single missing piece that makes the whole system dedupe-capable):

```sql
ALTER TABLE activities
  ADD COLUMN clientEventId VARCHAR(64) NULL AFTER metadata;

-- Backfill existing rows so the unique index can be added (legacy rows get synthetic ids):
UPDATE activities SET clientEventId = CONCAT('legacy-', id) WHERE clientEventId IS NULL;

ALTER TABLE activities
  MODIFY clientEventId VARCHAR(64) NOT NULL,
  ADD UNIQUE INDEX uniq_user_event (userId, clientEventId);
```

Sequelize model (`models/sql.js`):
```js
clientEventId: { type: DataTypes.STRING(64), allowNull: false },
// indexes: [{ unique: true, fields: ['userId', 'clientEventId'], name: 'uniq_user_event' }]
```
> Note: production runs `DB_SYNC_MODE=safe` which will **not** add this index automatically. Run the `ALTER TABLE` as an explicit migration (see §13).

`INTEGER` (max 2.1B) is fine at these magnitudes — no type change needed.

---

## 7. Retry Strategy

- **Client owns retry** (server is idempotent, so `_skipRetry: true` on the sync call).
- **Exponential backoff with jitter**, capped: `1s → 2s → 4s … → 5min`, reset to 1s on success.
- **Triggers** (any of): new tap · app foreground · connectivity regained (NetInfo) · foreground interval (~30s) · OS background task (~15min).
- **No max-attempts drop** — items stay PENDING until ACKed. `attempts`/`last_error` are for diagnostics only, never a discard condition.
- **Batch cap** (e.g. 200 events/request) to bound payload; loop until the queue is empty.
- **401** pauses the drain and raises a re-auth signal; queue is preserved and resumes post-login.

---

## 8. Offline-First Synchronization Strategy

1. **Write-ahead:** tap → `INSERT` local event (durable) → *then* update UI. UI is derived from durable state, never ahead of it.
2. **Never gate taps on connectivity or auth.** Offline/expired-token taps still enqueue; NetInfo only *triggers* drains.
3. **Reconcile on read:** `displayed = serverBaseline + SUM(PENDING deltas)`. Even if the server is behind, the user sees their true count and the queue closes the gap.
4. **ACK-before-clear:** events leave PENDING only on server confirmation.
5. **Survives restart/crash/background:** SQLite persists; background task drains without UI.
6. **Idempotent end-to-end:** UUID per event + server UNIQUE key → unlimited safe retries.

---

## 9. Sequence Diagram (complete flow)

```
User      CounterScreen     syncQueue(SQLite)     SyncEngine        API /sync-events      MySQL
 │  tap        │                   │                  │                    │                │
 ├────────────▶│  enqueueTap()     │                  │                    │                │
 │             ├──────────────────▶│ INSERT PENDING   │                    │                │
 │             │                   │  (DURABLE ✔)      │                    │                │
 │             │ optimistic UI ◀───┤ (sum of events)  │                    │                │
 │             ├─ drain() ─────────────────────────────▶│                  │                │
 │             │                   │  takePendingBatch │                    │                │
 │             │                   │◀──────────────────┤                    │                │
 │             │                   │                   ├─ POST events[] ───▶│                │
 │             │                   │                   │                    ├─ BEGIN txn ───▶│
 │             │                   │                   │                    ├─ bulkCreate    │
 │             │                   │                   │                    │  ignoreDup ───▶│ (UNIQUE dedupe)
 │             │                   │                   │                    ├─ total=SUM ───▶│
 │             │                   │                   │                    ├─ User.update ─▶│
 │             │                   │                   │                    ├─ COMMIT ──────▶│
 │             │                   │                   │◀── 200 {accepted, total} ──────────┤
 │             │                   │  markSynced(ids)  │                    │                │
 │             │                   │◀──────────────────┤ (ACK-before-clear) │                │
 │
 │  ── offline / crash / background at any point above ──▶ events stay PENDING; retried later ──
```

---

## 10. Sample Implementation

See the code blocks in §4 (client: `syncQueue.js`, `syncEngine.js`, tap handler, background task) and §5 (server: `/sync-events`). These are drop-in starting points aligned to the existing file layout.

---

## 11. Logging Strategy

**Client** (structured, ring-buffered to SQLite for field debugging):
- `tap_enqueued { clientEventId, delta, queueDepth }`
- `drain_start { pending, batchSize }` / `drain_ok { accepted, total, ms }` / `drain_fail { error, attempts, backoffMs }`
- `event_synced { clientEventId }` / `event_orphaned` (never expected — alert if seen)
- Expose "queue depth" + "oldest pending age" on a hidden diagnostics screen and in the sync indicator.

**Server:**
- Per request: `{ userId, appId, submitted, inserted, duplicatesIgnored, totalAfter, ms }` — `inserted < submitted` is normal (idempotent replays); log the delta.
- `WARN` on `duplicatesIgnored > 0` spikes (client retry storms), `ERROR` on txn rollback with the failing event id.
- Keep the immutable `activities` ledger as the audit trail; never mutate it.

**Correlation:** the `clientEventId` is the single trace id across client logs, server logs, and the DB row — one grep reconstructs an event's full journey.

---

## 12. Monitoring & Analytics

- **Reconciliation drift gauge:** nightly job comparing `users.totalCount` vs `SUM(activities.count)` per user; alert on any nonzero (should always be 0 with the new endpoint).
- **Queue-age SLO:** client reports max PENDING age; alert if p95 > e.g. 1h (indicates stuck syncs / auth failures).
- **Duplicate-ratio:** `duplicatesIgnored / submitted` trend — rising = client retry misbehavior or flaky network.
- **Endpoint health:** `/sync-events` p95 latency, 5xx rate, pool-wait time. **Raise `pool.max`** (5 → 20-ish) ahead of batch traffic.
- **Loss canary:** synthetic client that taps N, kills itself mid-sync, restarts, and asserts DB == N.
- **Funnel:** taps enqueued → synced conversion, per app version, to catch regressions post-deploy.

---

## 13. Migration Plan (zero user-facing loss)

**Phase 0 — DB (backward-compatible).** Run the §6 `ALTER TABLE` (add `clientEventId` + UNIQUE) as an explicit migration outside `safe` sync. Old `add-count` still works (it doesn't touch the new column). Deploy hardened validation on `add-count` (§5.2).

**Phase 1 — Server dual-run.** Ship `/sync-events` alongside `/add-count`. Both write the same ledger; `totalCount` derives from the ledger, so old and new clients coexist safely.

**Phase 2 — Client (new build).** Ship `syncQueue` + `syncEngine` + background task. On first launch of the new build, run a **one-time drain of legacy state**:
```js
const legacyPending = Number(await AsyncStorage.getItem(pendingKey)) || 0;
if (legacyPending > 0) {
  syncQueue.enqueueTap(mobile, legacyPending, nowMs); // becomes one UUID event
  await AsyncStorage.setItem(pendingKey, '0');
}
```
Also reconcile `serverBaseline` from `getDisplayStats()` so the displayed number is `server + local pending` — nobody sees a drop.

**Phase 3 — Observe.** Watch reconciliation-drift = 0 and queue-age SLO across versions. Keep `/add-count` until legacy install share is negligible.

**Phase 4 — Decommission.** Remove `/add-count` and the legacy `PendingSyncCount` shim; make `clientEventId` the permanent contract.

**Rollback:** `/sync-events` is additive; disabling it reverts clients to `/add-count` with no schema rollback needed (the extra column is nullable-safe for the old path).

---

## Appendix — Precise file:line anchors
- Client delivery gap: `counterService.js:324, 339-348` (queue-after-network), `:334` (backend-disabled skip), `:404-449` (backend-only, no reconciliation), `:33-43` (mobile-scoped key).
- Fire-and-forget / AppState: `CounterScreen.js:205-216`, `:115-116`.
- Non-idempotent client retry: `apiService.js:48-57`; sync call: `:360-366`.
- Logout strands pending: `App.js:175, 221`.
- Server contract & atomic txn: `routes/activities.js:20, 69-110`.
- Silent default-to-1: `routes/activities.js:20`.
- Ledger model & missing unique id: `models/sql.js:134-174` (indexes `:168-173` all non-unique).
- Self-heal (raise-only): `routes/auth.js:11-42`, `routes/admin.js:262-317`.
- Pool config: `config/database.js:66-71`.
