/**
 * Single source of truth for attendance percentage (B27).
 *
 * StudentAttendance.status: present | absent | late | leave | holiday
 *  - present, late, half_day  -> attended (half_day counts 0.5)
 *  - absent                   -> missed
 *  - leave, holiday           -> excluded from the denominator (not a school day
 *                                the student could have attended / excused)
 */
export const emptyCounts = () => ({ present: 0, absent: 0, late: 0, half_day: 0, leave: 0, holiday: 0 });

export const countAttendance = (records = []) => {
  const c = emptyCounts();
  for (const r of records) {
    const s = r.status;
    if (s in c) c[s] += 1;
  }
  return c;
};

export const attendancePercentage = (c = {}) => {
  const present = Number(c.present) || 0;
  const late = Number(c.late) || 0;
  const half = Number(c.half_day) || 0;
  const absent = Number(c.absent) || 0;
  const countable = present + late + half + absent;
  if (!countable) return 0;
  return Math.round(((present + late + half * 0.5) / countable) * 100);
};

export default { emptyCounts, countAttendance, attendancePercentage };
