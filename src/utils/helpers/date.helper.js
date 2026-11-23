/**
 * The Clouds Academy - Date Helper
 */

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });

export const isExpired = (date) => new Date(date) < new Date();

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

export const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
};

export default { formatDate, isExpired, addDays, addMonths, getMonthRange };

// ─── Pakistan time (Asia/Karachi, UTC+5, no DST) — B32 ───────────────────────
const PKT_TZ = 'Asia/Karachi';

/** 'yyyy-MM-dd' for the given instant in Pakistan time */
export const toPktDateString = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: PKT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(date));

/** Today's date in Pakistan as 'yyyy-MM-dd' */
export const todayPkt = () => toPktDateString(new Date());

/** 'HH:mm:ss' (24h) in Pakistan time */
export const toPktTimeString = (date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: PKT_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(new Date(date));

/** { year, month (1-12), day } of the given instant in Pakistan time */
export const pktParts = (date = new Date()) => {
  const [year, month, day] = toPktDateString(date).split('-').map(Number);
  return { year, month, day };
};

/** Start of a Pakistan-local day ('yyyy-MM-dd') as a UTC Date instant */
export const pktDayStart = (ymd) => new Date(`${ymd}T00:00:00+05:00`);
/** End of a Pakistan-local day ('yyyy-MM-dd') as a UTC Date instant */
export const pktDayEnd = (ymd) => new Date(`${ymd}T23:59:59.999+05:00`);
