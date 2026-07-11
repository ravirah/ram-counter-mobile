#!/usr/bin/env node
/**
 * Bump the app version in BOTH places that must stay in sync:
 *   - app.json                  → expo.version (versionName) + expo.android.versionCode
 *   - android/app/build.gradle  → versionName + versionCode
 *
 * WHY: app.json's versionCode is what the JS reads for APP_BUILD / the X-App-Version header
 * (force-update gating), while build.gradle is what the actual APK is stamped with. Because
 * android/ is gitignored, the two silently drift if bumped by hand (that's how build 17 ended
 * up 16 in the APK). This keeps them identical, so a build is never a store-rejected duplicate
 * and the force-update gate always sees the right number.
 *
 * Usage:
 *   node scripts/bump-version.js            # versionCode +1, keep versionName
 *   node scripts/bump-version.js 1.3.0      # set versionName 1.3.0, versionCode +1
 *   node scripts/bump-version.js 1.3.0 25   # set versionName 1.3.0, versionCode 25 (explicit)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appJsonPath = path.join(root, 'app.json');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');

const appRaw = fs.readFileSync(appJsonPath, 'utf8');
const app = JSON.parse(appRaw);

const curCode = Number(app.expo.android.versionCode) || 0;
const curName = String(app.expo.version || '0.0.0');

const argName = process.argv[2];
const argCode = process.argv[3];
const newName = argName || curName;
const newCode = argCode !== undefined ? Number(argCode) : curCode + 1;

if (!Number.isInteger(newCode) || newCode <= 0) {
  console.error(`✗ invalid versionCode: ${argCode}`);
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(newName)) {
  console.error(`✗ invalid versionName: ${newName} (expected e.g. 1.3.0)`);
  process.exit(1);
}

// 1) app.json — targeted raw-text replaces to preserve exact formatting.
const outApp = appRaw
  .replace(/("version"\s*:\s*")[^"]*(")/, `$1${newName}$2`)
  .replace(/("versionCode"\s*:\s*)\d+/, `$1${newCode}`);
fs.writeFileSync(appJsonPath, outApp);
console.log(`app.json          → version ${newName}, versionCode ${newCode}`);

// 2) android/app/build.gradle (android/ is gitignored/regenerable; update it if present).
if (fs.existsSync(gradlePath)) {
  const g = fs.readFileSync(gradlePath, 'utf8')
    .replace(/versionCode\s+\d+/, `versionCode ${newCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${newName}"`);
  fs.writeFileSync(gradlePath, g);
  console.log(`build.gradle      → versionName ${newName}, versionCode ${newCode}`);
} else {
  console.log('build.gradle      → not found (android/ absent — it will be generated from app.json)');
}

console.log(`\n✔ Version synced to ${newName} (build ${newCode}). Commit app.json, then build from this machine.`);
