# Fee Payment System - Implementation Guide

## System Overview

The fee payment system handles:
1. **Payment Recording** - Track each payment/collection against vouchers
2. **Partial Payment Handling** - Support installment payments across months
3. **Collection Analytics** - Generate collection reports and identify defaulters
4. **Audit Trail** - Track who collected what, when, and how

---

## Architecture

### Models & Tables

#### FeeVoucher Model Updates
```sql
ALTER TABLE fee_vouchers ADD COLUMN previous_balance DECIMAL(10,2) DEFAULT 0;
-- Stores remaining balance that rolls forward to next month's voucher
```

#### FeePayment Table (Already Exists)
```sql
CREATE TABLE fee_payments (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL,
  branch_id UUID,
  voucher_id UUID NOT NULL REFERENCES fee_vouchers(id),
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'cheque', 'bank_transfer', 'jazzcash', 'easypaisa', 'stripe', 'other'),
  transaction_id VARCHAR(100),
  payment_date DATE NOT NULL,
  receipt_number VARCHAR(50) UNIQUE,
  collected_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_fee_payments_voucher ON fee_payments(voucher_id);
CREATE INDEX idx_fee_payments_school ON fee_payments(school_id);
CREATE INDEX idx_fee_payments_payment_date ON fee_payments(payment_date);
```

### Service Layer Flow

```
Recording Payment
├──> Validate payment amount
├──> Create FeePayment record
├──> Calculate remaining balance
├──> Update voucher status (paid/partial)
├──> Rollforward balance to next month
└──> Send notification

Getting Payment History
├──> Fetch all payments for voucher
├──> Calculate total paid/remaining
└──> Return detailed breakdown

Payment Summary
├──> Fetch all vouchers by type
├──> Aggregate payment records
├──> Categorize by status
└──> Identify 30+ day defaulters
```

---

## Database Setup

### 1. Run Migrations (If Needed)

```bash
cd Backend
npm run db:migrate
```

### 2. Verify Table Structure

```sql
-- Check FeeVoucher columns
DESCRIBE fee_vouchers;

-- Check FeePayment table exists
DESCRIBE fee_payments;

-- Verify indexes
SHOW INDEX FROM fee_payments;
```

---

## Configuration

### Environment Variables

```env
# .env or config.cjs
FEE_PAYMENT_RECEIPT_PREFIX=RCP
FEE_PAYMENT_AUTO_ROLLFORWARD=true
FEE_PAYMENT_NOTIFICATION_ENABLED=true
FEE_PAYMENT_DEFAULT_DAYS_OVERDUE=30
```

### SMS/Email Templates

Create notification templates in `src/templates/`:

```
fee-payment-success.html
fee-payment-partial.html
fee-payment-overdue.html
fee-collection-summary.html
```

---

## API Testing

### 1. Setup Test Data

```bash
# Generate test vouchers
curl -X POST http://localhost:5000/api/fee-vouchers/generate-single \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student-uuid",
    "month": 1,
    "year": 2025,
    "dueDate": "2025-01-31"
  }'
```

### 2. Test Payment Recording

```bash
# Get voucher ID from above response
VOUCHER_ID="uuid-from-response"

# Record full payment
curl -X POST http://localhost:5000/api/fee-vouchers/$VOUCHER_ID/payment \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "paymentMethod": "cash",
    "paidDate": "2025-01-15"
  }'
```

### 3. Test Partial Payment

```bash
# Record partial payment (students paying in installments)
VOUCHER_ID="uuid-for-partial"

# First installment
curl -X POST http://localhost:5000/api/fee-vouchers/$VOUCHER_ID/payment \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "paymentMethod": "cash",
    "paidDate": "2025-01-15"
  }'

# Verify status is "partial"
curl -X GET http://localhost:5000/api/fee-vouchers/$VOUCHER_ID/payment-history \
  -H "Authorization: Bearer STAFF_TOKEN"

# Second installment
curl -X POST http://localhost:5000/api/fee-vouchers/$VOUCHER_ID/payment \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "paymentMethod": "bank_transfer",
    "reference": "HBL-20250120-123456",
    "paidDate": "2025-01-20"
  }'

# Verify status changed to "paid"
curl -X GET http://localhost:5000/api/fee-vouchers/$VOUCHER_ID/payment-history \
  -H "Authorization: Bearer STAFF_TOKEN"
```

### 4. Test Collection Summary

```bash
# Get monthly fee collection stats
curl -X GET "http://localhost:5000/api/fee-vouchers/payment-summary/monthly?month=1&year=2025" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected categories:
# - collected: fully paid
# - partial: installment paid
# - pending: not yet due
# - overdue: past due but < 30 days
# - defaulters: 30+ days overdue (needs action)
```

---

## Error Scenarios & Handling

### Scenario 1: Overpayment Attempt

```bash
# Voucher has 15000 PKR due
# Try to pay 20000 PKR

curl -X POST http://localhost:5000/api/fee-vouchers/$VOUCHER_ID/payment \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 20000,
    "paymentMethod": "cash"
  }'

# Response: 400 Bad Request
# "Payment amount exceeds voucher amount. Voucher amount: 15000"
```

### Scenario 2: Invalid Payment Method

```bash
# Payment method not in allowed enum

curl -X POST http://localhost:5000/api/fee-vouchers/$VOUCHER_ID/payment \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "paymentMethod": "bitcoin"  # Invalid!
  }'

# Response: 400 Bad Request or 422 Validation Error
```

### Scenario 3: Archived Voucher

```bash
# Try to record payment against deleted voucher

curl -X POST http://localhost:5000/api/fee-vouchers/$ARCHIVED_VOUCHER_ID/payment \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "paymentMethod": "cash"
  }'

# Response: 400 Bad Request
# "Cannot record payment against archived voucher"
```

---

## Frontend Integration

### 1. Payment Recording Component

```jsx
// components/PaymentRecorder.jsx
import { useState } from 'react';
import { recordPayment } from '@/services/fee.service';

export default function PaymentRecorder({ voucherId, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || amount <= 0) {
      setError('Please enter valid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await recordPayment(voucherId, {
        amount: parseFloat(amount),
        paymentMethod: method,
        paidDate: new Date().toISOString().split('T')[0]
      });

      setAmount('');
      onSuccess(result);
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (PKR)"
        step="0.01"
      />
      <select value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="cash">Cash</option>
        <option value="cheque">Cheque</option>
        <option value="bank_transfer">Bank Transfer</option>
        <option value="jazzcash">JazzCash</option>
        <option value="easypaisa">EasyPaisa</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Recording...' : 'Record Payment'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

### 2. Payment History Display

```jsx
// components/PaymentHistory.jsx
import { useEffect, useState } from 'react';
import { getPaymentHistory } from '@/services/fee.service';

export default function PaymentHistory({ voucherId }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [voucherId]);

  const fetchHistory = async () => {
    try {
      const data = await getPaymentHistory(voucherId);
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch payment history', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!history) return <div>No data</div>;

  const { payments, summary } = history;

  return (
    <div className="payment-history">
      <div className="summary">
        <div className="stat">
          <label>Total Paid</label>
          <span>PKR {summary.totalPaid.toFixed(2)}</span>
        </div>
        <div className="stat">
          <label>Remaining</label>
          <span className={summary.remaining > 0 ? 'warning' : 'success'}>
            PKR {summary.remaining.toFixed(2)}
          </span>
        </div>
        <div className="stat">
          <label>Status</label>
          <span>{summary.fullyPaid ? '✅ Paid' : '⏳ Pending'}</span>
        </div>
      </div>

      <table className="payments-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Receipt</th>
            <th>Collector</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.payment_date}</td>
              <td>PKR {payment.amount_paid.toFixed(2)}</td>
              <td>{payment.payment_method}</td>
              <td>{payment.receipt_number}</td>
              <td>{payment.User ? `${payment.User.first_name} ${payment.User.last_name}` : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3. Collection Dashboard

```jsx
// components/CollectionDashboard.jsx
import { useEffect, useState } from 'react';
import { getPaymentSummary } from '@/services/fee.service';

export default function CollectionDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const data = await getPaymentSummary('monthly', { month: 1, year: 2025 });
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch summary', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) return <div>Loading...</div>;

  const collectionRate = ((summary.collected.count / summary.total) * 100).toFixed(2);
  const outstanding = summary.overdue.amount + summary.pending.amount;

  return (
    <div className="collection-dashboard">
      <div className="kpis">
        <div className="kpi-card success">
          <h3>Collection Rate</h3>
          <p className="value">{collectionRate}%</p>
          <p className="detail">{summary.collected.count} of {summary.total} collected</p>
        </div>

        <div className="kpi-card warning">
          <h3>Outstanding</h3>
          <p className="value">PKR {(outstanding / 1000).toFixed(1)}K</p>
          <p className="detail">{summary.overdue.count + summary.pending.count} vouchers</p>
        </div>

        <div className="kpi-card danger">
          <h3>Defaulters</h3>
          <p className="value">{summary.defaulters.count}</p>
          <p className="detail">30+ days overdue</p>
        </div>

        <div className="kpi-card info">
          <h3>Partial</h3>
          <p className="value">{summary.partial.count}</p>
          <p className="detail">PKR {(summary.partial.amount / 1000).toFixed(1)}K</p>
        </div>
      </div>

      <div className="category-breakdown">
        {/* Render categories */}
      </div>
    </div>
  );
}
```

---

## Batch Payment Upload

### CSV Format

```csv
voucher_id,amount,payment_method,reference,payment_date
abc123,5000,cash,,2025-01-15
def456,10000,bank_transfer,HBL-123456,2025-01-15
ghi789,7500,cheque,CHQ-789,2025-01-16
```

### Backend Handler

```javascript
export const uploadPayments = catchAsync(async (req, res) => {
  const file = req.file;
  const instituteId = req.user.school_id;

  const payments = parseCSV(file.buffer);
  const results = [];

  for (const payment of payments) {
    try {
      const result = await recordPayment(
        payment.voucher_id,
        instituteId,
        {
          amount: parseFloat(payment.amount),
          paymentMethod: payment.payment_method,
          reference: payment.reference,
          paidDate: payment.payment_date,
          collectedBy: req.user.id
        }
      );
      results.push({ ...payment, status: 'success' });
    } catch (error) {
      results.push({ ...payment, status: 'failed', error: error.message });
    }
  }

  res.json({ success: true, results });
});
```

---

## Automated Overdue Reminders

### Job Configuration

```javascript
// jobs/overdue-reminder.job.js
import * as feeVoucherService from '../services/feeVoucher.service.js';

export async function runOverdueReminderJob() {
  try {
    const institutes = await Institute.findAll();
    
    for (const institute of institutes) {
      // Get all fee types
      const feeTypes = ['monthly', 'annual', 'lab'];

      for (const feeType of feeTypes) {
        const summary = await feeVoucherService.getPaymentSummary(
          feeType,
          institute.id
        );

        // Send reminders to overdue students
        const overdue = summary.overdue.vouchers;
        const defaulters = summary.defaulters.vouchers;

        for (const voucher of overdue) {
          await sendOverdueReminder(voucher, institute);
        }

        for (const voucher of defaulters) {
          await sendDefaulterWarning(voucher, institute);
        }
      }
    }
  } catch (error) {
    console.error('Overdue reminder job failed:', error);
  }
}

// Schedule in index.js
schedule('0 9 * * *', runOverdueReminderJob); // Daily at 9 AM
```

---

## Reconciliation Process

### Daily Reconciliation

```javascript
export async function dailyReconciliation(instituteId, date) {
  const dateStr = date.toISOString().split('T')[0];
  
  // Get all payments for today
  const payments = await FeePayment.findAll({
    where: {
      school_id: instituteId,
      payment_date: dateStr
    }
  });

  // Calculate totals by method
  const byMethod = {};
  let total = 0;

  for (const payment of payments) {
    if (!byMethod[payment.payment_method]) {
      byMethod[payment.payment_method] = 0;
    }
    byMethod[payment.payment_method] += parseFloat(payment.amount_paid);
    total += parseFloat(payment.amount_paid);
  }

  return {
    date: dateStr,
    totalTransactions: payments.length,
    totalAmount: total,
    byMethod,
    generatedAt: new Date()
  };
}
```

---

## Reporting

### Collection Report Query

```javascript
export async function getCollectionReport(instituteId, startDate, endDate) {
  const payments = await FeePayment.findAll({
    where: {
      school_id: instituteId,
      payment_date: { [Op.between]: [startDate, endDate] }
    },
    include: [{ association: 'Voucher' }],
    raw: false
  });

  // Group by method, date, collector
  // Calculate summary stats
  // Generate PDF/Excel report
}
```

### PDF Report Template

```
THE CLOUDS ACADEMY - COLLECTION REPORT
Period: Jan 1 - Jan 31, 2025

SUMMARY
- Total Vouchers Generated: 250
- Total Amount Due: PKR 3,750,000
- Total Amount Collected: PKR 2,700,000
- Collection Rate: 72%
- Outstanding: PKR 1,050,000
- Defaulters (30+ days): 5 students

BREAKDOWN BY COLLECTION METHOD
- Cash: PKR 1,500,000 (55%)
- Bank Transfer: PKR 900,000 (33%)
- JazzCash: PKR 150,000 (6%)
- Cheque: PKR 150,000 (6%)

TOP COLLECTORS
1. Ali Ahmed: PKR 450,000 (18 transactions)
2. Fatima Khan: PKR 380,000 (16 transactions)
3. Hassan Ali: PKR 320,000 (12 transactions)

DEFAULTERS LIST
[List of students with 30+ days overdue]

Generated: Jan 31, 2025 9:30 PM
By: Admin User
```

---

## Performance Optimization

### Database Indexes

```sql
CREATE INDEX idx_fee_payments_voucher_date 
  ON fee_payments(voucher_id, payment_date);

CREATE INDEX idx_fee_vouchers_student_type 
  ON fee_vouchers(student_id, fee_type, status);

CREATE INDEX idx_fee_vouchers_inst_date 
  ON fee_vouchers(institute_id, issued_date);
```

### Caching Strategy

```javascript
// Cache collection summaries (expires hourly)
const cache = new Map();

export async function getPaymentSummaryCached(feeTypeId, instituteId) {
  const key = `summary-${instituteId}-${feeTypeId}`;
  
  if (cache.has(key)) {
    return cache.get(key);
  }

  const summary = await getPaymentSummary(feeTypeId, instituteId);
  cache.set(key, summary);

  // Expire cache after 1 hour
  setTimeout(() => cache.delete(key), 60 * 60 * 1000);

  return summary;
}
```

---

## Troubleshooting

### Issue: Payments not updating voucher status

**Cause:** Transaction not committed
**Solution:** Ensure transaction is passed through options

### Issue: Incorrect remaining balance calculation

**Cause:** previous_balance field not updated
**Solution:** Run migration to add column, recalculate balances

### Issue: Collection summary showing duplicate entries

**Cause:** Payment records not grouped properly
**Solution:** Verify JOIN conditions, check for orphaned payments

---

## Next Features

1. **Payment Plans** - Multi-month installment schedules
2. **Late Fees** - Automatic surcharge after due date
3. **Waivers** - Admin-approved fee reductions
4. **Refunds** - Handle overpayments and cancellations
5. **Gateway Integration** - Online payment processing
6. **Reconciliation Reports** - Detailed audit logs
7. **Mobile SMS** - Payment reminders and receipts

---

## Support & Maintenance

- **Backup Strategy:** Monthly snapshots of payment records
- **Audit Logs:** All payment modifications logged
- **Security:** Encrypt sensitive payment data
- **Compliance:** PCI DSS ready for future gateway integration
