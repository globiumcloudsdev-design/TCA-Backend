# Fee Payment API Documentation

## Overview
This document describes the fee payment endpoints for recording, tracking, and analyzing fee collections in The Clouds Academy system.

---

## 1. Record Payment

**Endpoint:** `POST /api/fee-vouchers/:voucherId/payment`

**Authorization:** `INSTITUTE_ADMIN`, `BRANCH_ADMIN`, `STAFF`

**Description:** Record a payment or collection against a fee voucher. Automatically updates voucher status based on payment amount.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `voucherId` | UUID | Yes | ID of the fee voucher |

### Request Body

```json
{
  "amount": 5000,
  "paymentMethod": "cash",
  "reference": "TXN123456",
  "paidDate": "2025-01-15"
}
```

| Field | Type | Required | Options | Description |
|-------|------|----------|---------|-------------|
| `amount` | Decimal | Yes | > 0 | Payment amount in PKR |
| `paymentMethod` | String | Yes | cash, cheque, bank_transfer, jazzcash, easypaisa, stripe, other | Payment method |
| `reference` | String | No | - | Transaction ID or reference number |
| `paidDate` | Date | No | YYYY-MM-DD | Payment date (defaults to today) |

### Response

```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "id": "uuid",
    "school_id": "uuid",
    "voucher_id": "uuid",
    "amount_paid": 5000,
    "payment_method": "cash",
    "transaction_id": "TXN123456",
    "payment_date": "2025-01-15",
    "receipt_number": "RCP-1735689600000",
    "collected_by": "uuid",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### Status Transitions

- **Full Payment:** Voucher status changes to `paid`
- **Partial Payment:** Voucher status changes to `partial`
- **Overpayment:** Rejected with 400 error

### Error Cases

| Error | Status | Description |
|-------|--------|-------------|
| Voucher not found | 404 | Voucher ID doesn't exist or belongs to different institute |
| Archived voucher | 400 | Cannot record payment against archived voucher |
| Invalid amount | 400 | Amount <= 0 or exceeds voucher amount |
| Missing payment method | 400 | Payment method not provided |

### Example Requests

```bash
# Record cash payment
curl -X POST http://localhost:5000/api/fee-vouchers/abc123/payment \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "paymentMethod": "cash",
    "paidDate": "2025-01-15"
  }'

# Record bank transfer with reference
curl -X POST http://localhost:5000/api/fee-vouchers/abc123/payment \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "paymentMethod": "bank_transfer",
    "reference": "HBL-TRANSFER-9876543",
    "paidDate": "2025-01-15"
  }'
```

---

## 2. Get Payment History

**Endpoint:** `GET /api/fee-vouchers/:voucherId/payment-history`

**Authorization:** All authenticated users

**Description:** Retrieve complete payment history for a specific voucher including payment records and summary.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `voucherId` | UUID | Yes | ID of the fee voucher |

### Response

```json
{
  "success": true,
  "message": "Payment history retrieved",
  "data": {
    "voucher": {
      "id": "uuid",
      "voucher_number": "TCA/2025/001",
      "net_amount": 15000,
      "status": "partial"
    },
    "payments": [
      {
        "id": "uuid",
        "amount_paid": 5000,
        "payment_method": "cash",
        "transaction_id": null,
        "payment_date": "2025-01-10",
        "receipt_number": "RCP-1735689600000",
        "notes": null,
        "createdAt": "2025-01-10T14:30:00Z",
        "User": {
          "id": "uuid",
          "first_name": "Ali",
          "last_name": "Ahmed"
        }
      },
      {
        "id": "uuid",
        "amount_paid": 10000,
        "payment_method": "bank_transfer",
        "transaction_id": "HBL-TRANSFER-9876",
        "payment_date": "2025-01-15",
        "receipt_number": "RCP-1735776000000",
        "notes": null,
        "createdAt": "2025-01-15T10:00:00Z",
        "User": {
          "id": "uuid",
          "first_name": "Fatima",
          "last_name": "Khan"
        }
      }
    ],
    "summary": {
      "totalPaid": 15000,
      "remaining": 0,
      "totalPayments": 2,
      "fullyPaid": true
    }
  }
}
```

### Summary Object

| Field | Type | Description |
|-------|------|-------------|
| `totalPaid` | Decimal | Total amount paid so far |
| `remaining` | Decimal | Remaining balance (0 if fully paid) |
| `totalPayments` | Integer | Number of payment records |
| `fullyPaid` | Boolean | Whether voucher is fully paid |

### Example Request

```bash
curl -X GET http://localhost:5000/api/fee-vouchers/abc123/payment-history \
  -H "Authorization: Bearer TOKEN"
```

---

## 3. Get Payment Summary

**Endpoint:** `GET /api/fee-vouchers/payment-summary/:feeTypeId`

**Authorization:** `INSTITUTE_ADMIN`, `BRANCH_ADMIN`, `STAFF`

**Description:** Get collection statistics and analysis for a specific fee type (monthly, annual, lab). Categorizes vouchers by collection status and identifies defaulters.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feeTypeId` | String | Yes | Fee type: `monthly`, `annual`, `lab` |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | No | Filter by month (1-12) |
| `year` | Integer | No | Filter by year (YYYY) |

### Response

```json
{
  "success": true,
  "message": "Payment summary retrieved",
  "data": {
    "total": 250,
    "totalAmount": 3750000,
    "collected": {
      "count": 180,
      "amount": 2700000,
      "vouchers": [
        {
          "id": "uuid",
          "voucher_number": "TCA/2025/001",
          "amount": 15000,
          "paid": 15000,
          "remaining": 0,
          "student": "Ahmed Ali",
          "student_id": "uuid",
          "issuedDate": "2025-01-01",
          "dueDate": "2025-01-31"
        }
      ]
    },
    "partial": {
      "count": 35,
      "amount": 420000,
      "vouchers": [...]
    },
    "pending": {
      "count": 28,
      "amount": 420000,
      "vouchers": [...]
    },
    "overdue": {
      "count": 5,
      "amount": 75000,
      "vouchers": [...]
    },
    "defaulters": {
      "count": 2,
      "amount": 30000,
      "vouchers": [
        {
          "id": "uuid",
          "voucher_number": "TCA/2024/245",
          "amount": 15000,
          "paid": 0,
          "remaining": 15000,
          "student": "XYZ Student",
          "student_id": "uuid",
          "issuedDate": "2024-11-01",
          "dueDate": "2024-11-30"
        }
      ]
    }
  }
}
```

### Status Breakdown

| Category | Criteria | Description |
|----------|----------|-------------|
| `collected` | Remaining = 0 | Fully paid vouchers |
| `partial` | 0 < Remaining < Total | Partially paid vouchers |
| `pending` | Not overdue | Not yet due vouchers |
| `overdue` | Due date passed | Overdue but < 30 days |
| `defaulters` | 30+ days overdue | Critical overdue (requires action) |

### Example Requests

```bash
# Get all monthly fee collections
curl -X GET "http://localhost:5000/api/fee-vouchers/payment-summary/monthly" \
  -H "Authorization: Bearer TOKEN"

# Get January 2025 lab fee collections
curl -X GET "http://localhost:5000/api/fee-vouchers/payment-summary/lab?month=1&year=2025" \
  -H "Authorization: Bearer TOKEN"

# Get annual fee collections for 2025
curl -X GET "http://localhost:5000/api/fee-vouchers/payment-summary/annual?year=2025" \
  -H "Authorization: Bearer TOKEN"
```

---

## Collection Metrics & KPIs

Based on payment summary data, you can calculate:

```
Collection Rate = (Collected Count / Total) * 100
Collection %    = (Collected Amount / Total Amount) * 100
Partial Rate    = (Partial Count / Total) * 100
Default Rate    = (Defaulter Count / Total) * 100
Outstanding     = Overdue Amount + Pending Amount
```

---

## Voucher Status Flow

```
pending
  ↓
  ├─→ (payment received) → partial
  │                         ↓
  │                    (full payment) → paid
  │
  ├→ (due date passed) → overdue
  │
  └─→ (cancelled) → cancelled
```

---

## Common Use Cases

### 1. Recording Daily Collections

```javascript
// Record cash collection at end of day
const payments = [
  { voucherId: 'abc1', amount: 5000, paymentMethod: 'cash' },
  { voucherId: 'abc2', amount: 10000, paymentMethod: 'cash' },
  { voucherId: 'abc3', amount: 7500, paymentMethod: 'jazzcash' }
];

for (const payment of payments) {
  await recordPayment(payment.voucherId, payment.amount, payment.paymentMethod);
}
```

### 2. Checking Student Payment Status

```javascript
// Get payment history for student
const history = await getPaymentHistory(voucherId);
console.log(`Paid: ${history.summary.totalPaid}, Remaining: ${history.summary.remaining}`);
```

### 3. Generating Collection Report

```javascript
// Get monthly collection summary
const summary = await getPaymentSummary('monthly', { month: 1, year: 2025 });
console.log(`Collection Rate: ${(summary.collected.count / summary.total * 100).toFixed(2)}%`);
console.log(`Outstanding: ${summary.overdue.amount + summary.pending.amount}`);
```

### 4. Identifying Fee Defaulters

```javascript
// Get defaulters list
const summary = await getPaymentSummary('monthly');
const defaulters = summary.defaulters.vouchers;
// Send reminders to defaulters
```

---

## Error Handling

### Common Errors

```json
{
  "success": false,
  "message": "Voucher not found",
  "statusCode": 404
}
```

```json
{
  "success": false,
  "message": "Payment amount exceeds voucher amount. Voucher amount: 15000",
  "statusCode": 400
}
```

```json
{
  "success": false,
  "message": "Payment method is required",
  "statusCode": 400
}
```

---

## Best Practices

1. **Always validate payment method** before recording
2. **Use transaction IDs** for non-cash payments for audit trail
3. **Record collector info** for accountability
4. **Check payment history** before accepting payment
5. **Set up automatic reminders** for overdue vouchers
6. **Run daily reconciliation** against payment records
7. **Archive old payment records** quarterly for performance
8. **Use partial payment status** for installment payments

---

## Integration Examples

### Frontend - Recording Payment

```javascript
// React/Next.js example
async function recordFeePayment(voucherId, amount, method) {
  const response = await fetch(`/api/fee-vouchers/${voucherId}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      paymentMethod: method,
      reference: `PAY-${Date.now()}`,
      paidDate: new Date().toISOString().split('T')[0]
    })
  });
  
  if (!response.ok) throw new Error('Payment failed');
  return response.json();
}
```

### Dashboard - Collection Summary Widget

```javascript
async function getCollectionStats() {
  const response = await fetch('/api/fee-vouchers/payment-summary/monthly');
  const data = await response.json();
  
  return {
    collectionRate: (data.collected.count / data.total * 100).toFixed(2),
    outstandingAmount: data.overdue.amount + data.pending.amount,
    defaulters: data.defaulters.count,
    readyForCollection: data.pending.count + data.partial.count
  };
}
```

---

## Performance Considerations

- **Indexing:** Ensure voucher_id, payment_date, and school_id are indexed
- **Pagination:** Use limit/offset for large payment histories
- **Caching:** Cache collection summaries (refresh hourly)
- **Batch Operations:** Process bulk payments with transactions
- **Archive:** Move old payment records to archive table quarterly

---

## Audit & Compliance

All payment records include:
- Collector ID (tracked user)
- Payment date and time
- Receipt number (unique)
- Transaction ID (for non-cash)
- Payment method documentation

Suitable for financial audits and tax reporting.
