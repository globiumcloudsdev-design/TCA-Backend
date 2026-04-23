/**
 * Generate a unique voucher number for each institute per month.
 * Format: [INSTITUTE_CODE]-[YYYYMM]-[SEQ]
 * Example: TCA-202604-0012
 *
 * @param {string} instituteCode - Short code for the institute (e.g., 'TCA')
 * @param {Date|string} date - Date object or ISO string (voucher month/year)
 * @param {function} getNextSequence - Async function to get next sequence for this month/institute
 * @returns {Promise<string>} Voucher number
 */

export default async function generateVoucherNumber(instituteCode, date, getNextSequence) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  // Get next sequence number for this institute and month
  const seq = await getNextSequence(instituteCode, year, month);
  const seqStr = String(seq).padStart(4, '0');
  return `${instituteCode}-${year}${month}-${seqStr}`;
}
