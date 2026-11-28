/**
 * Push notification endpoints: device tokens, push status, admin audience composer.
 */
import catchAsync from '../../utils/lib/catchAsync.js';
import { AppError } from '../../utils/lib/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/helpers/response.helper.js';
import { getInstituteId } from '../../utils/helpers/request.helper.js';
import models from '../../models/postgres/index.js';
import { getMessaging } from '../../config/firebase.js';
import { parseAudience, resolveAudience, countByRole } from '../../services/push/audience.service.js';
import { saveInbox, pushForRows, runInBackground } from '../../services/push/notify.service.js';

const { DeviceToken } = models;

const PLATFORMS = ['android', 'ios', 'web'];
const APPS = ['hpss', 'tca'];

const isMissingTable = (err) => /device_tokens/i.test(String(err?.message || '')) && /does not exist|no such table/i.test(String(err?.message || '') + String(err?.parent?.message || ''));

// ── Devices ──────────────────────────────────────────────────────────────────
export const registerDevice = catchAsync(async (req, res) => {
  const { token, platform, app, device_info } = req.body || {};
  if (typeof token !== 'string' || token.trim().length < 20 || token.length > 2048) throw new AppError('token is required (the FCM device token)', 400);
  if (!PLATFORMS.includes(platform)) throw new AppError(`platform must be one of: ${PLATFORMS.join(', ')}`, 400);
  if (!APPS.includes(app)) throw new AppError(`app must be one of: ${APPS.join(', ')}`, 400);
  let info = {};
  if (device_info !== undefined && device_info !== null) {
    if (typeof device_info !== 'object' || Array.isArray(device_info)) throw new AppError('device_info must be an object', 400);
    info = JSON.parse(JSON.stringify(device_info).slice(0, 4000)); // size guard
  }

  const clean = token.trim();
  const values = {
    user_id: req.user.id,
    institute_id: getInstituteId(req) || null,
    branch_id: req.user.branch_id || null,
    platform,
    app,
    device_info: info,
    last_seen_at: new Date(),
  };

  let row;
  try {
    row = await DeviceToken.findOne({ where: { token: clean } });
    if (row) {
      await row.update(values); // re-assigns the token if it changed hands
    } else {
      try {
        row = await DeviceToken.create({ token: clean, ...values });
      } catch (err) {
        if (err.name !== 'SequelizeUniqueConstraintError') throw err;
        row = await DeviceToken.findOne({ where: { token: clean } }); // lost a race: update the winner
        await row.update(values);
      }
    }
  } catch (err) {
    if (isMissingTable(err)) throw new AppError('Push registration is not available yet.', 503);
    throw err;
  }

  const messaging = await getMessaging();
  sendSuccess(res, { id: row.id, registered: true, push_enabled: Boolean(messaging) }, 'Device registered');
});

export const unregisterDevice = catchAsync(async (req, res) => {
  // NOTE: ?token= is reserved by the auth middleware (access token for downloads); use ?device_token= for query-style calls
  const token = (req.body && req.body.token) || req.query.device_token;
  if (typeof token !== 'string' || !token.trim()) throw new AppError('token is required', 400);
  let removed = 0;
  try {
    removed = await DeviceToken.destroy({ where: { token: token.trim(), user_id: req.user.id } });
  } catch (err) {
    if (isMissingTable(err)) return sendSuccess(res, { removed: 0 }, 'Device removed');
    throw err;
  }
  sendSuccess(res, { removed }, 'Device removed');
});

export const pushStatus = catchAsync(async (req, res) => {
  sendSuccess(res, { push_enabled: Boolean(await getMessaging()) }, 'Push status');
});

// ── Composer ─────────────────────────────────────────────────────────────────
const scopeOf = (req) => ({ restrictedBranchId: req.isBranchRestricted ? req.allowedBranchId : null });

export const previewAudience = catchAsync(async (req, res) => {
  const instituteId = getInstituteId(req);
  if (!instituteId) throw new AppError('Institute context required', 400);
  const audience = parseAudience(req.body?.audience, scopeOf(req));
  const recipients = await resolveAudience(instituteId, audience);
  sendSuccess(res, { count: recipients.length, by_role: countByRole(recipients) }, 'Audience preview');
});

const cleanExtraData = (data) => {
  if (data === undefined || data === null) return {};
  if (typeof data !== 'object' || Array.isArray(data)) throw new AppError('data must be an object', 400);
  const keys = Object.keys(data);
  if (keys.length > 20) throw new AppError('data can have at most 20 keys', 400);
  const out = {};
  for (const k of keys) {
    const v = data[k];
    if (!['string', 'number', 'boolean'].includes(typeof v)) throw new AppError(`data.${k} must be a string, number or boolean`, 400);
    if (String(v).length > 500) throw new AppError(`data.${k} is too long`, 400);
    if (['type', 'entity_id', 'route', 'notification_id'].includes(k)) continue; // reserved
    out[k] = v;
  }
  return out;
};

/** Composer: POST /notifications/send with an `audience` object */
export const sendToAudience = async (req, res) => {
  const instituteId = getInstituteId(req);
  if (!instituteId) throw new AppError('Institute context required', 400);

  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!title || !body) throw new AppError('title and body are required', 400);
  if (title.length > 120) throw new AppError('title must be 120 characters or less', 400);
  if (body.length > 1000) throw new AppError('body must be 1000 characters or less', 400);
  const extra = cleanExtraData(req.body.data);

  const audience = parseAudience(req.body.audience, scopeOf(req));
  const recipients = await resolveAudience(instituteId, audience);
  if (!recipients.length) throw new AppError('No recipients match this audience.', 400);

  const payload = {
    institute_id: instituteId,
    branch_id: audience.branch_id || req.user.branch_id || null,
    type: 'notice',
    title,
    body,
    entity_id: null,
    data: { ...extra, sent_by: req.user.id },
  };
  const rows = await saveInbox(recipients.map((r) => r.id), payload); // inbox is saved before we answer
  const messaging = await getMessaging();
  runInBackground('composer push', () => pushForRows(rows));
  sendCreated(res, { recipients: recipients.length, inbox_created: rows.length, push: { enabled: Boolean(messaging), queued: Boolean(messaging) } }, 'Notification sent');
};

export const sendNotificationRouter = (legacyHandler) =>
  catchAsync(async (req, res, next) => {
    if (req.body && req.body.audience !== undefined) return sendToAudience(req, res);
    return legacyHandler(req, res, next);
  });

export default { registerDevice, unregisterDevice, pushStatus, previewAudience, sendNotificationRouter };

