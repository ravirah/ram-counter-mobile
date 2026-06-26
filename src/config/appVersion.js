import appJson from '../../app.json';

// Single source of truth for the build version, read from app.json at bundle time.
// Lets users/admins confirm which build is actually installed (the old hardcoded
// "1.0.0" made that impossible to verify).
export const APP_VERSION = `${appJson?.expo?.version || '0.0.0'}${
  appJson?.expo?.android?.versionCode ? ` (build ${appJson.expo.android.versionCode})` : ''
}`;
