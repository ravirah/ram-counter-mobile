# Admin Dashboard AppId Filter Fix

## Issue
The admin dashboard was not updated to support the new `appId` multi-app architecture. While the backend had partial support for filtering users by `appId`, the statistics and activities endpoints didn't support it, and the admin UI had no way to select different apps.

## Changes Made

### 1. Backend - Admin Routes (`backend/routes/admin.js`)

#### Stats Endpoint (`/admin/stats`)
- **Added** `appId` query parameter support
- **Updated** MongoDB queries to filter by `appId`:
  - Users count filtered by appId
  - Active today count filtered by appId
  - Daily summary filtered by appId
- **Updated** SQL queries with same appId filtering logic

#### Activities Endpoint (`/admin/activities`)
- **Added** `appId` query parameter support  
- **Updated** MongoDB and SQL queries to filter activities by appId

### 2. Frontend - API Service (`src/utils/apiService.js`)

#### `getAdminStats(appId)`
- **Added** optional `appId` parameter
- Passes `appId` as query param to `/admin/stats` endpoint

#### `getAllActivities(limit, page, type, userId, appId)`
- **Added** optional `appId` parameter
- Passes `appId` as query param to `/admin/activities` endpoint

### 3. Frontend - Admin Dashboard (`src/screens/admin/AdminDashboardScreen.js`)

#### Added App Filter UI
- **Added** horizontal scrollable app selector below the tab bar
- Shows "All Apps", "राम Bank", "कृष्ण Bank" buttons
- Active app is highlighted with accent color

#### Updated Data Loading
- `loadDashboardData()` now passes `appFilter` to all three API calls:
  - `getAdminStats(appFilter)`
  - `getAllUsers(20, 1, '', appFilter)`
  - `getAllActivities(50, 1, '', '', appFilter)`
- Dashboard automatically reloads when `selectedApp` changes

#### Added Styles
- `appSelector` - Container for the filter UI
- `appSelectorLabel` - "Filter by App:" label
- `appButtons` - Horizontal scroll container
- `appButton` / `appButtonActive` - Individual app filter buttons
- `appButtonText` / `appButtonTextActive` - Button text styles

## How It Works

1. Admin opens the dashboard
2. Default view shows "All Apps" (combined data from all apps)
3. Admin can tap any app button to filter:
   - Statistics update to show only that app's data
   - Users list filters to that app
   - Activities list filters to that app
4. Backend queries add `WHERE appId = 'xxx'` (or MongoDB equivalent) to all queries

## Benefits

- ✅ Admin can now see per-app statistics
- ✅ Admin can filter users by app
- ✅ Admin can filter activities by app
- ✅ Maintains backward compatibility (appId is optional)
- ✅ Clean, intuitive UI with horizontal app selector

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Admin can login
- [ ] "All Apps" shows combined data
- [ ] Clicking "राम Bank" filters data correctly
- [ ] Clicking "कृष्ण Bank" filters data correctly (when app exists)
- [ ] Stats update when switching apps
- [ ] Users list updates when switching apps
- [ ] Activities list updates when switching apps

## Future Enhancements

- Add app list dynamically from backend (instead of hardcoded)
- Show app-specific colors in the filter UI
- Add app icons/logos to the filter buttons
