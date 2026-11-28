/**
 * Firebase Admin (FCM) configuration.
 *
 * Credentials come from env only (never committed):
 *   FIREBASE_SERVICE_ACCOUNT_JSON    full service-account JSON as a string
 *   FIREBASE_SERVICE_ACCOUNT_BASE64  the same JSON, base64-encoded
 *
 * If neither is set (or firebase-admin is missing/invalid) push is DISABLED: getMessaging()
 * resolves to null after logging ONE warning. Nothing here ever throws.
 */
import logger from './logger.js';

let state = { initialized: false, messaging: null, warned: false };

const warnOnce = (message) => {
  if (state.warned) return;
  state.warned = true;
  logger.warn(message);
};

/** Parse the service account from env. Returns the object or null (never throws). */
export const loadServiceAccount = (env = process.env) => {
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const b64 = env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!json && !b64) return null;
  try {
    const text = json && json.trim() ? json : Buffer.from(b64, 'base64').toString('utf8');
    const account = JSON.parse(text);
    if (account.private_key && typeof account.private_key === 'string') {
      account.private_key = account.private_key.replace(/\\n/g, '\n');
    }
    if (!account.project_id || !account.client_email || !account.private_key) {
      warnOnce('Push notifications disabled: the Firebase service account is missing project_id / client_email / private_key.');
      return null;
    }
    return account;
  } catch (err) {
    warnOnce(`Push notifications disabled: FIREBASE_SERVICE_ACCOUNT_* is not valid JSON (${err.message}).`);
    return null;
  }
};

/** Cheap check (no network, no import): is a service account configured in env? */
export const isPushConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);

/** firebase-admin Messaging instance, or null when push is disabled. Initialised once, lazily. */
export const getMessaging = async () => {
  if (state.messaging) return state.messaging;
  if (state.initialized) return null;
  state.initialized = true;

  const account = loadServiceAccount();
  if (!account) {
    warnOnce('Push notifications are disabled: FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_BASE64 not set. In-app notifications still work.');
    return null;
  }
  try {
    const mod = await import('firebase-admin');
    const admin = mod.default || mod;
    const app = admin.apps?.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(account) });
    state.messaging = admin.messaging(app);
    logger.info('🔔 Push notifications enabled (Firebase Cloud Messaging)');
    return state.messaging;
  } catch (err) {
    warnOnce(`Push notifications disabled: could not initialise firebase-admin (${err.message}).`);
    return null;
  }
};

/** Tests only: inject a fake Messaging (or null to force "disabled"), or reset with no argument. */
export const __setMessagingForTests = (messaging) => {
  state = messaging === undefined
    ? { initialized: false, messaging: null, warned: false }
    : { initialized: true, messaging, warned: false };
};

export default { getMessaging, isPushConfigured, loadServiceAccount };
