# Maestro flows — Android on-device tests for the counter sync

[Maestro](https://maestro.mobile.dev) drives the **native APK** (tap, type, background, kill,
relaunch, airplane-mode) — the Android-specific behaviors a browser/Playwright can't reproduce.
The pure sync *logic* is already covered by the web + integration suites; these flows cover the
native runtime.

## How verification works (important)
Maestro asserts the **UI** (app responds, count increments, screens render). The **"no count
lost / no double"** guarantee is verified by the **server**, not the UI — so after a flow runs,
confirm the user's total on the server via either:
- the **Admin panel** → Users → that user's total count, or
- `GET https://bhagwan-backend-u0n9.onrender.com/api/admin/drift-report?key=YOUR_KEY`
  → `healthy:true` and `criticalBelowLedger:0`.

The flow does the actions; the server is the oracle.

## Prerequisites
1. **Install Maestro:** `curl -Ls https://get.maestro.mobile.dev | bash` (or see their docs; Windows: use WSL).
2. **A device or emulator** connected (`adb devices` shows it). Prefer a **real device** — emulators
   often can't toggle airplane mode (flow 4).
3. **Build 17 installed** on it: build the APK with `eas build -p android --profile preview`, download it,
   `adb install <file>.apk`.
4. **An approved test account.** These flows use mobile `9998887776` / name `Maestro Test`. Log in once
   manually and **approve it in the admin panel** (new accounts start `pending`). Reset its count to 0
   before runs that assert exact numbers.

## Run
```bash
# one flow
maestro test .maestro/flow-01-online-counting.yaml

# override the test account
maestro test -e MOBILE=9998887776 -e NAME="Maestro Test" .maestro/flow-01-online-counting.yaml

# all flows in order
maestro test .maestro/
```
Screenshots land in the Maestro output dir; use them for a visual record.

## Coverage
| Flow | Android-specific thing it exercises | Verify on server |
|---|---|---|
| `flow-01-online-counting` | keypad counting → `/sync-events` | total +5 |
| `flow-02-background-flush` | AppState `background`/`inactive` flush | total includes taps after backgrounding |
| `flow-03-kill-and-relaunch` | durable queue survives a process kill + auto-relogin | all taps on server after relaunch |
| `flow-04-offline-queue` | offline queue → drain when back online | total +4, exactly once |
| `flow-05-screens-smoke` | every tab renders on device | n/a (UI only) |

## Known limitations (do these by hand)
- **Kill *during* an in-flight request** (the tightest window): Maestro can't time a kill mid-request.
  Manual: tap once, then *immediately* swipe the app away; reopen → the tap must appear on the server.
- **Airplane mode (flow 4):** needs a real device + recent Maestro. If `toggleAirplaneMode` isn't
  supported, drive it with adb instead:
  ```bash
  adb shell cmd connectivity airplane-mode enable    # go offline
  adb shell cmd connectivity airplane-mode disable   # back online
  ```
- **Upgrade-backlog recovery** (build 16 → 17 with local offline counts): must be manual — install 16,
  chant offline, install 17 over it, log in, confirm the old count is recovered on the server. Maestro
  can't manage the cross-version install.

## Selectors — testIDs (added)
The flows select by stable `testID`s baked into the app (RN maps `testID` → accessibility id,
which Maestro matches with `id:`). No brittle text matching for the interactive elements:

| testID | Element |
|---|---|
| `login-mobile-input` | mobile number field (LoginScreen) |
| `login-name-input` | name field (LoginScreen) |
| `login-submit-button` | Login/Continue button (LoginScreen) |
| `key-R` / `key-A` / `key-M` | the R/A/M keypad keys (CounterScreen) |
| `counter-input` | the mantra text input (CounterScreen) |
| `today-count` | today's count number (CounterScreen) |
| `tab-count` / `tab-stats` / `tab-profile` | bottom tab buttons (App.js) |

Stats/Profile screen *content* is still asserted by visible text (that's content, not controls).
If you add more flows, prefer `id:` over `text:` for anything you tap.
