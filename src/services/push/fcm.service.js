/**
 * FCM sender: batches of 500, per-message data, invalid-token detection.
 * Never throws: failures are returned/logged. When push is disabled it returns { enabled:false }.
 */
import { getMessaging } from '../../config/firebase.js';
import logger from '../../config/logger.js';

export const FCM_BATCH_SIZE = 500;

/** FCM error codes that mean the token is dead and must be deleted */
export const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** FCM data values must all be strings */
export const stringifyData = (data = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return out;
};

const clip = (s, n) => (String(s ?? '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s ?? ''));

/**
 * @param {Array<{token:string, title:string, body:string, data?:object}>} items one message per device token
 * @returns {Promise<{enabled:boolean, sent:number, failed:number, invalidTokens:string[]}>}
 */
export const sendPush = async (items = []) => {
  const result = { enabled: false, sent: 0, failed: 0, invalidTokens: [] };
  if (!items.length) {
    result.enabled = Boolean(await getMessaging());
    return result;
  }
  const messaging = await getMessaging();
  if (!messaging) return result;
  result.enabled = true;

  for (let i = 0; i < items.length; i += FCM_BATCH_SIZE) {
    const chunk = items.slice(i, i + FCM_BATCH_SIZE);
    const messages = chunk.map((m) => ({
      token: m.token,
      notification: { title: clip(m.title, 120), body: clip(m.body, 500) },
      data: stringifyData(m.data),
      android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    }));
    try {
      const res = await messaging.sendEach(messages);
      res.responses.forEach((r, idx) => {
        if (r.success) {
          result.sent += 1;
        } else {
          result.failed += 1;
          if (INVALID_TOKEN_CODES.has(r.error?.code)) result.invalidTokens.push(chunk[idx].token);
        }
      });
    } catch (err) {
      result.failed += chunk.length;
      logger.error(`FCM batch failed: ${err.message}`);
    }
  }
  return result;
};

export default { sendPush, stringifyData, INVALID_TOKEN_CODES, FCM_BATCH_SIZE };
