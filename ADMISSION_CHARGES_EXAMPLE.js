/**
 * Example: Generating Admission Fee Vouchers
 * The Clouds Academy - Fee Management System
 */

// ============================================
// ✅ ADMISSION CHARGES - COMPLETE SETUP
// ============================================

/**
 * WHAT'S NEW:
 * 1. ✅ Added 'admission' to fee_type ENUM (monthly, annual, lab, admission)
 * 2. ✅ Updated getFeeAmount() to handle admission_charges
 * 3. ✅ Updated prepareFeeBreakdown() to include admission_charges
 * 4. ✅ Notifications already send to BOTH Student AND Parents
 * 5. ✅ Migration run successfully (20260418_add_admission_fee_type)
 */

// ============================================
// API EXAMPLES
// ============================================

/**
 * 1. Generate Single Admission Voucher for a Student
 */
async function generateAdmissionVoucher() {
  const response = await fetch('http://localhost:5000/api/fee-vouchers/generate-single', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      studentId: 'student-uuid-123',
      month: 4,  // April (admission month)
      year: 2026,
      dueDate: '2026-04-30',
      feeType: 'admission'  // ✨ NEW: Specify admission fee type
    })
  });

  const voucher = await response.json();
  console.log('✅ Admission Voucher Created:', voucher.data.voucher_number);
  console.log('📧 Student & Parents Notified:', voucher.data.id);
  return voucher;
}

/**
 * 2. Generate Admission Vouchers for Entire Class
 */
async function generateAdmissionVouchersForClass() {
  const response = await fetch('http://localhost:5000/api/fee-vouchers/generate-class', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      classId: 'class-uuid-456',
      month: 4,
      year: 2026,
      dueDate: '2026-04-30',
      feeTypes: ['admission']  // Generate only admission fees
    })
  });

  const result = await response.json();
  console.log(`✅ Generated ${result.data.generated} admission vouchers for class`);
  console.log(`📧 ${result.data.generated} student-parent notifications sent`);
  return result;
}

/**
 * 3. Generate Multiple Fee Types at Once
 * (Monthly + Lab + Admission in one go)
 */
async function generateMultipleFeeTypes() {
  const response = await fetch('http://localhost:5000/api/fee-vouchers/generate-institute', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      month: 4,
      year: 2026,
      dueDate: '2026-04-30',
      feeTypes: ['monthly', 'lab', 'admission']  // ✨ Now includes admission!
    })
  });

  const result = await response.json();
  console.log('✅ Generated vouchers for all fee types');
  return result;
}

// ============================================
// NOTIFICATION FLOW (Already Implemented)
// ============================================

/**
 * When generateSingleVoucher is called with feeType: 'admission':
 * 
 * 1️⃣ Voucher Created
 * 2️⃣ Student Receives Notification:
 *    - Title: "💵 ADMISSION Fee Voucher Generated"
 *    - Body: "Voucher #TCA/2026/001 for admission fee has been generated. Amount: PKR 15,000"
 *    
 * 3️⃣ All Linked Parents Receive Notification:
 *    - Title: "💵 ADMISSION Fee Voucher Generated"
 *    - Body: "Ahmed Ali's Voucher #TCA/2026/001 for admission fee has been generated. Amount: PKR 15,000"
 */

// ============================================
// STUDENT DETAILS STRUCTURE
// ============================================

/**
 * Update student details to include admission_charges:
 * 
 * User.details.studentDetails = {
 *   monthly_fee: 5000,
 *   annual_charges: 50000,
 *   lab_charges: 2000,
 *   admission_charges: 15000,  // ✨ NEW FIELD
 *   class_id: 'class-uuid',
 *   section_id: 'section-uuid',
 *   discount_type: 'percentage',
 *   concession_percentage: 10,
 *   concession_reason: 'Merit'
 * }
 */

// ============================================
// PARENT NOTIFICATION MATCHING
// ============================================

/**
 * Parents are automatically notified based on:
 * 
 * Parent.details.parentDetails = {
 *   student_ids: ['student-uuid-123', 'student-uuid-456'],  // ✨ Used to match students
 *   // ... other parent details
 * }
 * 
 * When admission voucher is generated for student-uuid-123,
 * all parents with 'student-uuid-123' in their student_ids list
 * automatically receive a notification.
 */

// ============================================
// FEE BREAKDOWN EXAMPLE
// ============================================

/**
 * Admission vouchers now include admission_charges in fee_breakdown:
 * 
 * voucher.fee_breakdown = {
 *   fee_type: 'admission',
 *   monthly_fee: 5000,
 *   annual_charges: 50000,
 *   lab_charges: 2000,
 *   admission_charges: 15000,  // ✨ Included in breakdown
 *   concession_type: 'none',
 *   discount_type: 'percentage',
 *   concession_percentage: 10,
 *   concession_reason: 'Merit',
 *   student_name: 'Ahmed Ali',
 *   registration_no: 'REG-001',
 *   class_id: 'class-uuid',
 *   section_id: 'section-uuid'
 * }
 */

// ============================================
// API RESPONSE EXAMPLE
// ============================================

/**
 * POST /api/fee-vouchers/generate-single
 * 
 * Request:
 * {
 *   "studentId": "student-uuid",
 *   "month": 4,
 *   "year": 2026,
 *   "dueDate": "2026-04-30",
 *   "feeType": "admission"  // ✨ NEW
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Voucher generated successfully",
 *   "data": {
 *     "id": "voucher-uuid",
 *     "voucher_number": "TCA/2026/ADM/001",  // Can include ADM prefix
 *     "student_id": "student-uuid",
 *     "fee_type": "admission",  // ✨ NEW VALUE
 *     "amount": 15000,
 *     "discount": 1500,
 *     "net_amount": 13500,
 *     "status": "pending",
 *     "issued_date": "2026-04-01",
 *     "due_date": "2026-04-30",
 *     "fee_breakdown": { ... },
 *     "notes": "..."
 *   }
 * }
 */

// ============================================
// PAYMENT WORKFLOW (Already Supported)
// ============================================

/**
 * Record payment against admission voucher:
 * 
 * POST /api/fee-vouchers/{voucherId}/payment
 * {
 *   "amount": 13500,
 *   "paymentMethod": "cash",
 *   "paidDate": "2026-04-15"
 * }
 * 
 * Results in:
 * - Voucher status → "paid"
 * - Payment notification sent to student & parents
 * - Receipt number generated
 */

// ============================================
// DATABASE QUERIES
// ============================================

/**
 * Get all admission vouchers for institute:
 * 
 * GET /api/fee-vouchers?fee_type=admission&year=2026
 * 
 * Filters supported:
 * - ?fee_type=admission (get only admission vouchers)
 * - ?status=pending (get pending admission vouchers)
 * - ?month=4&year=2026 (get by month/year)
 * - ?student_id=xyz (get student's admission voucher if exists)
 */

/**
 * Collection summary for admission fees:
 * 
 * GET /api/fee-vouchers/payment-summary/admission
 * 
 * Returns:
 * {
 *   total: 250,
 *   totalAmount: 3750000,
 *   collected: { count: 180, amount: 2700000, vouchers: [...] },
 *   partial: { count: 35, amount: 420000, vouchers: [...] },
 *   pending: { count: 28, amount: 420000, vouchers: [...] },
 *   overdue: { count: 5, amount: 75000, vouchers: [...] },
 *   defaulters: { count: 2, amount: 30000, vouchers: [...] }
 * }
 */

// ============================================
// SUMMARY OF CHANGES
// ============================================

console.log(`
╔════════════════════════════════════════════╗
║  ✅ ADMISSION CHARGES - FULLY IMPLEMENTED  ║
╠════════════════════════════════════════════╣
║                                            ║
║  1. ✅ Database Migration Done             ║
║     - Added 'admission' to fee_type enum   ║
║                                            ║
║  2. ✅ Model Updated                       ║
║     - FeeVoucher supports 4 fee types      ║
║                                            ║
║  3. ✅ Service Updated                     ║
║     - getFeeAmount() handles admission     ║
║     - prepareFeeBreakdown() updated        ║
║                                            ║
║  4. ✅ Notifications Implemented           ║
║     - Student gets notification            ║
║     - All parents get notification         ║
║     - Use parent-student linking (IDs)     ║
║                                            ║
║  5. ✅ API Endpoints Ready                 ║
║     - Generate single admission voucher    ║
║     - Generate for class/institute         ║
║     - Record payments                      ║
║     - Get collection summary               ║
║                                            ║
║  📧 NOTIFICATION RECIPIENTS:               ║
║     - Student + All Linked Parents         ║
║                                            ║
║  FEE TYPES SUPPORTED:                      ║
║     - monthly                              ║
║     - annual                               ║
║     - lab                                  ║
║     - admission ✨ NEW                     ║
║                                            ║
╚════════════════════════════════════════════╝
`);
