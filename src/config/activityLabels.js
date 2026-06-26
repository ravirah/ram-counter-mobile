// Canonical activity-type → { label, icon, color } map. Single source of truth for
// activity wording on the client so the SAME event reads identically everywhere.
// Labels are kept in sync with the backend copy at bhagwan-backend/utils/activityLabels.js.
const ACTIVITY_INFO = {
  REGISTER: { label: 'User Registered', icon: '🆕', color: '#2196F3' },
  LOGIN: { label: 'Login Successful', icon: '🔑', color: '#FF9800' },
  LOGOUT: { label: 'Logout', icon: '🚪', color: '#9E9E9E' },
  PROFILE_UPDATE: { label: 'Profile Updated', icon: '✏️', color: '#9C27B0' },
  APPROVAL: { label: 'User Approved', icon: '✅', color: '#4CAF50' },
  REJECTION: { label: 'User Rejected / Deactivated', icon: '🚫', color: '#F44336' },
  STATUS_CHANGE: { label: 'Status Changed', icon: '🔄', color: '#00BCD4' },
  DAILY_RESET: { label: 'Daily Count Reset', icon: '🔁', color: '#607D8B' },
  ADMIN_LOGIN: { label: 'Admin Login', icon: '🛡️', color: '#F44336' },
  COUNT_INCREMENT: { label: 'Chant Recorded', icon: '🙏', color: '#4CAF50' },
  // Admin audit actions (auditlogs)
  DELETE_USER: { label: 'User Deleted', icon: '🗑️', color: '#F44336' },
  RESTORE_USER: { label: 'User Restored', icon: '♻️', color: '#4CAF50' },
  DEACTIVATE_USER: { label: 'User Deactivated', icon: '🚫', color: '#F44336' },
  EDIT_USER: { label: 'User Edited', icon: '✏️', color: '#9C27B0' },
  SET_COUNT: { label: 'Count Updated', icon: '🛟', color: '#3F51B5' },
  RECONCILE_COUNTS: { label: 'Counts Reconciled', icon: '⚖️', color: '#3F51B5' },
  CHANGE_PASSWORD: { label: 'Admin Password Changed', icon: '🔑', color: '#3F51B5' },
};

export const activityInfo = (type) =>
  ACTIVITY_INFO[type] || { label: type || 'Activity', icon: '📌', color: '#666' };

export default ACTIVITY_INFO;
