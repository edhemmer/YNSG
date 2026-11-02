export const googleMessages: Record<string, string> = {
  CALENDAR_CREATION_PERMISSION_REQUIRED: "Calendar creation needs one additional Google permission. Use Reconnect Google, then approve calendar creation. You can also select an existing business calendar.",
  BUSINESS_CALENDAR_ALREADY_SELECTED: "A business calendar is already selected. Calendar changes need review before switching.",
  SERVER_DATABASE_AUTH_REQUIRED: "Google connection storage needs a configuration repair. Your existing connection is retained.",
  SERVER_DATABASE_PERMISSION_REQUIRED: "The CRM server cannot access Google connection storage. Its database permissions need repair.",
  CONNECTION_STORAGE_FAILED: "The CRM could not save or read its Google connection. Refresh status; if this continues, connection storage needs repair.",
  ENCRYPTION_KEY_REQUIRED: "Google connection security configuration needs a repair.",
  GOOGLE_REFRESH_UNAVAILABLE: 'Google could not refresh access right now. The connection is retained; try again later.',
  GOOGLE_CLIENT_CONFIGURATION_REQUIRED: 'Google sign-in configuration needs a repair.',
  OWNER_ACCESS_REQUIRED:
    "Owner or administrator access is required.",
  GOOGLE_SETUP_REQUIRED:
    "Google setup needs attention before connecting.",
  RECONNECT_REQUIRED:
    "Google access expired or was revoked. Press Reconnect Google to restore Calendar and Gmail access.",
  MISSING_GOOGLE_SCOPES:
    "Google did not grant every required permission. Reconnect and review the requested access.",
  STALE_CONNECTION: "The connection changed. Refresh before trying again.",
  DELIVERY_REVIEW_REQUIRED:
    "The previous test may have sent. Check your Gmail Sent folder before any further test.",
  CALENDAR_MIGRATION_REQUIRED:
    "Existing appointments use the current calendar. Calendar migration needs review before changing it.",
  PERMISSION_OR_API_REQUIRED:
    "Check the enabled Google APIs and granted permissions.",
  GOOGLE_ACCOUNT_MISMATCH: "Choose the same Google account used for this business. Your saved connection was retained.",
  CALENDAR_RECONNECT_REVIEW_REQUIRED: "Google could not confirm access to your saved business calendar. Reconnect with its owner account or review Google setup. Your existing calendar and connection were retained.",
  DISCONNECT_BEFORE_RECONNECT:
    "Disconnect the current Google account before connecting another.",
};
