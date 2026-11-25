/**
 * Geofence helpers for teacher self check-in / check-out (mobile only).
 *
 * Pure functions (no DB, no I/O) so the decision is unit-testable.
 * Distance = haversine (great-circle). GPS accuracy is NOT added to the radius.
 */

export const DEFAULT_RADIUS_M = 50;
export const MIN_RADIUS_M = 10;
export const MAX_RADIUS_M = 500;

const EARTH_RADIUS_M = 6371008.8; // mean Earth radius

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two lat/lng points */
export const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

const asNumber = (v) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
  return Number(v);
};

const asBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

/**
 * Parse + validate the device reading sent by the app.
 * @returns {{ok:true, value:{latitude, longitude, accuracy_m, is_mocked}} | {ok:false, message}}
 */
export const parseDeviceLocation = (body = {}) => {
  const latitude = asNumber(body.latitude);
  const longitude = asNumber(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, message: 'Location is required. Turn on GPS and try again (latitude and longitude).' };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ok: false, message: 'The location sent by your device is not valid.' };
  }
  // (0,0) is the classic "no fix" value of broken GPS stacks
  if (latitude === 0 && longitude === 0) {
    return { ok: false, message: 'Your device did not get a GPS fix yet. Wait a moment and try again.' };
  }
  let accuracy_m = null;
  if (body.accuracy_m !== undefined && body.accuracy_m !== null && body.accuracy_m !== '') {
    accuracy_m = asNumber(body.accuracy_m);
    if (!Number.isFinite(accuracy_m) || accuracy_m < 0) {
      return { ok: false, message: 'The GPS accuracy sent by your device is not valid.' };
    }
  }
  if (body.is_mocked === undefined || body.is_mocked === null) {
    return { ok: false, message: 'Please update the app: it must send the mock-location flag (is_mocked).' };
  }
  return { ok: true, value: { latitude, longitude, accuracy_m, is_mocked: asBool(body.is_mocked) } };
};

/** Read coordinates from branch.location (accepts latitude/longitude, lat/lng, lat/lon) */
export const readCampusLocation = (location) => {
  const loc = location && typeof location === 'object' ? location : {};
  const lat = asNumber(loc.latitude ?? loc.lat);
  const lng = asNumber(loc.longitude ?? loc.lng ?? loc.lon);
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  let radius = asNumber(loc.attendance_radius_m);
  if (!Number.isFinite(radius) || radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) radius = DEFAULT_RADIUS_M;
  return { has_location: valid, latitude: valid ? lat : null, longitude: valid ? lng : null, radius_m: Math.round(radius) };
};

/**
 * The geofence decision.
 *
 * @param {object} args
 * @param {object} args.body      raw request body ({latitude, longitude, accuracy_m, is_mocked})
 * @param {object|null} args.campus { name, location }  (location = branch.location JSON) or null when the teacher has no campus
 * @param {'check-in'|'check-out'} [args.action]
 * @returns {{ok:true, distance_m, radius_m, reading}
 *          | {ok:false, status, code, message, distance_m?, radius_m?, reading?}}
 *
 * Order: invalid input (400) -> no campus coordinates (409) -> mock location (403) -> outside radius (403).
 */
export const evaluateGeofence = ({ body, campus, action = 'check-in' }) => {
  const parsed = parseDeviceLocation(body);
  if (!parsed.ok) return { ok: false, status: 400, code: 'INVALID_LOCATION', message: parsed.message };
  const reading = parsed.value;

  if (!campus) {
    return { ok: false, status: 409, code: 'NO_CAMPUS', message: "Your campus location isn't set yet. Please ask the admin to set it.", reading };
  }
  const site = readCampusLocation(campus.location);
  if (!site.has_location) {
    return { ok: false, status: 409, code: 'NO_CAMPUS_LOCATION', message: "Your campus location isn't set yet. Please ask the admin to set it.", reading, radius_m: site.radius_m };
  }

  if (reading.is_mocked === true) {
    return { ok: false, status: 403, code: 'MOCK_LOCATION', message: 'Fake GPS detected. Turn off mock location apps.', reading, radius_m: site.radius_m };
  }

  const distance = haversineMeters(reading.latitude, reading.longitude, site.latitude, site.longitude);
  const distance_m = Math.round(distance * 10) / 10;
  if (distance > site.radius_m) {
    const label = action === 'check-out' ? 'Check-out' : 'Check-in';
    return {
      ok: false,
      status: 403,
      code: 'OUTSIDE_RADIUS',
      message: `You are ${Math.round(distance)} m from ${campus.name || 'your campus'}. ${label} is only allowed within ${site.radius_m} m.`,
      distance_m,
      radius_m: site.radius_m,
      reading,
    };
  }
  return { ok: true, distance_m, radius_m: site.radius_m, reading };
};

export default { haversineMeters, parseDeviceLocation, readCampusLocation, evaluateGeofence, DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M };
