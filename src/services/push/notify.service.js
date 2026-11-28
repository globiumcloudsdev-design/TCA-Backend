/**
 * Central notification service: inbox rows (existing Notification model) + FCM push.
 *
 *   notify(recipients, payload, options)        fire-and-forget, never throws, never blocks the caller
 *   saveInbox(recipients, payload, options)     awaitable inbox insert (used by the admin composer)
 *   pushForRows(rows, options)                  push for Notification rows that already exist
 *   deliver(recipients, payload, options, deps) awaitable end-to-end delivery (tests / jobs)
 *
 * payload: { institute_id, branch_id?, title, body, type, entity_id?, route?, data? }
 *   type = data.type used by the apps (notice, test_record, exam_result, fee_voucher, fee_due, payment,
 *   attendance, homework, leave, payslip, admin_payment_request, admin_leave_request).
 *   The DB enum Notification.type can't hold those, so it gets a legacy value (see LEGACY_TYPE).
 * options: { dedupePerDay?: boolean (skip users that already got this type+entity_id today, PKT),
 *            app?: 'hpss'|'tca' (only push to that app's tokens), push?: boolean (default true),
 *            emitRealtime?: boolean (default true) }
 */
import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import logger from '../../config/logger.js';
import { sendPush as defaultSendPush } from './fcm.service.js';
import { pktDayStart, todayPkt } from '../../utils/helpers/date.helper.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** data.type -> Notification.type enum (fee | attendance | exam | general | alert | system | payroll | event) */
export const LEGACY_TYPE = {
  notice: 'general',
  test_record: 'exam',
  exam_result: 'exam',
  fee_voucher: 'fee',
  fee_due: 'fee',
  payment: 'fee',
  attendance: 'attendance',
  homework: 'general',
  leave: 'general',
  payslip: 'payroll',
  admin_payment_request: 'fee',
  admin_leave_request: 'general',
};

export const DEFAULT_ROUTE = {
  notice: 'notices',
  test_record: 'test-record',
  exam_result: 'results',
  fee_voucher: 'fees',
  fee_due: 'fees',
  payment: 'fees',
  attendance: 'attendance',
  homework: 'homework',
  leave: 'leave',
  payslip: 'payroll',
  admin_payment_request: 'payment-requests',
  admin_leave_request: 'leave-requests',
};

/** unique, valid user ids from ids or { id } / { user_id } objects */
export const normalizeRecipients = (recipients = []) => {
  const out = new Set();
  for (const r of Array.isArray(recipients) ? recipients : [recipients]) {
    const id = typeof r === 'string' ? r : (r?.id || r?.user_id);
    if (id && UUID_RE.test(String(id))) out.add(String(id));
  }
  return [...out];
};

/** The `data` object stored on the inbox row and sent as FCM data */
export const buildData = ({ type, entity_id = null, route, data = {} }) => ({
  ...data,
  type,
  entity_id: entity_id ?? null,
  route: route || DEFAULT_ROUTE[type] || 'notifications',
});

const defaultDeps = () => ({
  Notification: models.Notification,
  DeviceToken: models.DeviceToken,
  sendPush: defaultSendPush,
  emit: async (userId, event, payload) => {
    const { emitToUser } = await import('../../sockets/index.js');
    emitToUser(userId, event, payload);
  },
});

const validatePayload = (payload) => {
  if (!payload || !payload.institute_id || !payload.title || !payload.type) return 'institute_id, title and type are required';
  return null;
};

/** Remove users that already got this type+entity_id today (PKT) */
const filterDuplicatesToday = async (Notification, ids, payload) => {
  const rows = await Notification.findAll({
    where: {
      user_id: { [Op.in]: ids },
      institute_id: payload.institute_id,
      created_at: { [Op.gte]: pktDayStart(todayPkt()) },
      'data.type': payload.type,
      'data.entity_id': payload.entity_id ?? null,
    },
    attributes: ['user_id'],
  });
  const done = new Set(rows.map((r) => r.user_id));
  return ids.filter((id) => !done.has(id));
};

/**
 * Save one inbox row per recipient (+ realtime socket event). Returns the created rows.
 * Throws on DB errors: callers that must not throw use notify()/deliver().
 */
export const saveInbox = async (recipients, payload, options = {}, deps = defaultDeps()) => {
  const problem = validatePayload(payload);
  if (problem) throw new Error(problem);
  let ids = normalizeRecipients(recipients);
  if (!ids.length) return [];
  if (options.dedupePerDay) ids = await filterDuplicatesToday(deps.Notification, ids, payload);
  if (!ids.length) return [];

  const data = buildData(payload);
  const rows = await deps.Notification.bulkCreate(
    ids.map((user_id) => ({
      institute_id: payload.institute_id,
      branch_id: payload.branch_id || null,
      user_id,
      title: payload.title,
      body: payload.body || '',
      type: LEGACY_TYPE[payload.type] || 'general',
      channel: 'in_app',
      data,
    })),
    { returning: true }
  );

  if (options.emitRealtime !== false) {
    for (const row of rows) {
      try {
        await deps.emit(row.user_id, 'notification', { id: row.id, title: row.title, body: row.body, type: row.type, data: row.data, timestamp: row.created_at });
      } catch { /* realtime is best effort */ }
    }
  }
  return rows;
};

/**
 * Push for rows that already exist in the inbox (also used by saveInbox+push flow).
 * Never throws. Returns { enabled, tokens, sent, failed, removed }.
 */
export const pushForRows = async (rows, options = {}, deps = defaultDeps()) => {
  const summary = { enabled: false, tokens: 0, sent: 0, failed: 0, removed: 0 };
  try {
    if (!rows?.length || options.push === false) return summary;
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const where = { user_id: { [Op.in]: userIds } };
    if (options.app) where.app = options.app;

    let tokens = [];
    try {
      tokens = await deps.DeviceToken.findAll({ where, attributes: ['token', 'user_id'] });
    } catch (err) {
      // device_tokens missing (migration not run) -> push silently skipped
      logger.warn(`push skipped: cannot read device_tokens (${err.message})`);
      return summary;
    }
    summary.tokens = tokens.length;

    const rowByUser = new Map();
    rows.forEach((r) => { if (!rowByUser.has(r.user_id)) rowByUser.set(r.user_id, r); });
    const items = tokens.map((t) => {
      const row = rowByUser.get(t.user_id);
      return { token: t.token, title: row.title, body: row.body, data: { ...(row.data || {}), notification_id: row.id } };
    });

    const res = await deps.sendPush(items);
    summary.enabled = res.enabled;
    summary.sent = res.sent;
    summary.failed = res.failed;
    if (res.invalidTokens?.length) {
      try {
        summary.removed = await deps.DeviceToken.destroy({ where: { token: { [Op.in]: res.invalidTokens } } });
      } catch (err) {
        logger.warn(`could not remove invalid device tokens: ${err.message}`);
      }
    }
    if (res.enabled && (res.failed || summary.removed)) logger.info(`push: sent=${res.sent} failed=${res.failed} removedTokens=${summary.removed}`);
  } catch (err) {
    logger.error(`pushForRows failed: ${err.message}`);
  }
  return summary;
};

/** Awaitable end-to-end delivery. NEVER throws (errors are logged and reported in the result). */
export const deliver = async (recipients, payload, options = {}, deps = defaultDeps()) => {
  const result = { recipients: 0, inbox: 0, push: { enabled: false, tokens: 0, sent: 0, failed: 0, removed: 0 }, error: null };
  try {
    const ids = normalizeRecipients(recipients);
    result.recipients = ids.length;
    let rows = [];
    try {
      rows = await saveInbox(ids, payload, options, deps);
    } catch (err) {
      result.error = err.message;
      logger.error(`notify: inbox save failed (${payload?.type}): ${err.message}`);
      return result;
    }
    result.inbox = rows.length;
    result.push = await pushForRows(rows, options, deps);
  } catch (err) {
    result.error = err.message;
    logger.error(`notify failed (${payload?.type}): ${err.message}`);
  }
  return result;
};

/**
 * Fire-and-forget. Returns immediately ({ queued:true }); the work runs on the next tick and any
 * error is only logged. Safe to call from any request handler / service / job.
 */
export const notify = (recipients, payload, options = {}) => {
  try {
    const problem = validatePayload(payload);
    if (problem) {
      logger.warn(`notify ignored: ${problem}`);
      return { queued: false };
    }
    setImmediate(() => {
      deliver(recipients, payload, options).catch((err) => logger.error(`notify crashed: ${err.message}`));
    });
    return { queued: true };
  } catch (err) {
    logger.error(`notify scheduling failed: ${err.message}`);
    return { queued: false };
  }
};

/** Run any async work (audience resolution + delivery) in the background, never throwing into the caller */
export const runInBackground = (label, fn) => {
  try {
    setImmediate(() => {
      Promise.resolve()
        .then(fn)
        .catch((err) => logger.error(`background notification "${label}" failed: ${err.message}`));
    });
  } catch (err) {
    logger.error(`background notification "${label}" could not be scheduled: ${err.message}`);
  }
};

export default { notify, deliver, saveInbox, pushForRows, runInBackground, buildData, normalizeRecipients, LEGACY_TYPE, DEFAULT_ROUTE };
