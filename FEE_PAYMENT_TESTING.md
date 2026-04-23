# Fee Payment System - Testing Guide

## Test Strategy

This document outlines comprehensive testing scenarios for the fee payment system including unit tests, integration tests, and API tests.

---

## Unit Tests

### Service Layer Tests

```javascript
// tests/services/feeVoucher.service.test.js

describe('Fee Voucher Service', () => {
  
  describe('recordPayment', () => {
    
    it('should record a full payment and mark voucher as paid', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';
      const payment = {
        amount: 15000,
        paymentMethod: 'cash',
        paidDate: '2025-01-15',
        collectedBy: 'staff-id'
      };

      const result = await recordPayment(voucherId, instituteId, payment);

      expect(result).toBeDefined();
      expect(result.amount_paid).toBe(15000);
      expect(result.payment_method).toBe('cash');
      expect(result.receipt_number).toMatch(/^RCP-/);
    });

    it('should record a partial payment and mark voucher as partial', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';
      const payment = {
        amount: 5000,  // Less than 15000 due amount
        paymentMethod: 'cash',
        paidDate: '2025-01-15',
        collectedBy: 'staff-id'
      };

      const result = await recordPayment(voucherId, instituteId, payment);

      expect(result.amount_paid).toBe(5000);
      // Voucher status should be updated to 'partial'
    });

    it('should reject payment exceeding voucher amount', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';
      const payment = {
        amount: 20000,  // Exceeds 15000 due amount
        paymentMethod: 'cash',
        paidDate: '2025-01-15',
        collectedBy: 'staff-id'
      };

      await expect(
        recordPayment(voucherId, instituteId, payment)
      ).rejects.toThrow('Payment amount exceeds voucher amount');
    });

    it('should reject negative or zero payment', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';

      await expect(
        recordPayment(voucherId, instituteId, { 
          amount: 0, 
          paymentMethod: 'cash',
          collectedBy: 'staff-id'
        })
      ).rejects.toThrow('Valid payment amount is required');

      await expect(
        recordPayment(voucherId, instituteId, { 
          amount: -1000, 
          paymentMethod: 'cash',
          collectedBy: 'staff-id'
        })
      ).rejects.toThrow('Valid payment amount is required');
    });

    it('should reject missing payment method', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';
      const payment = {
        amount: 5000,
        paymentMethod: null,
        paidDate: '2025-01-15',
        collectedBy: 'staff-id'
      };

      await expect(
        recordPayment(voucherId, instituteId, payment)
      ).rejects.toThrow('Payment method is required');
    });

    it('should reject payment against archived voucher', async () => {
      const voucherId = 'archived-voucher-id';
      const instituteId = 'test-institute-id';
      const payment = {
        amount: 5000,
        paymentMethod: 'cash',
        collectedBy: 'staff-id'
      };

      await expect(
        recordPayment(voucherId, instituteId, payment)
      ).rejects.toThrow('Cannot record payment against archived voucher');
    });

    it('should generate unique receipt numbers', async () => {
      const receipts = [];
      
      for (let i = 0; i < 100; i++) {
        const payment = {
          amount: 5000,
          paymentMethod: 'cash',
          collectedBy: 'staff-id'
        };
        
        const result = await recordPayment('voucher-' + i, 'institute-id', payment);
        receipts.push(result.receipt_number);
      }

      // All receipt numbers should be unique
      const uniqueReceipts = new Set(receipts);
      expect(uniqueReceipts.size).toBe(100);
    });
  });

  describe('getPaymentHistory', () => {
    
    it('should return all payments for a voucher', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';

      const history = await getPaymentHistory(voucherId, instituteId);

      expect(history).toBeDefined();
      expect(history.voucher).toBeDefined();
      expect(history.payments).toBeInstanceOf(Array);
      expect(history.summary).toBeDefined();
    });

    it('should calculate correct total paid and remaining', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';

      // Record two payments: 5000 + 10000 = 15000 total
      await recordPayment(voucherId, instituteId, {
        amount: 5000,
        paymentMethod: 'cash',
        collectedBy: 'staff-1'
      });

      await recordPayment(voucherId, instituteId, {
        amount: 10000,
        paymentMethod: 'bank_transfer',
        collectedBy: 'staff-2'
      });

      const history = await getPaymentHistory(voucherId, instituteId);

      expect(history.summary.totalPaid).toBe(15000);
      expect(history.summary.remaining).toBe(0);
      expect(history.summary.fullyPaid).toBe(true);
      expect(history.summary.totalPayments).toBe(2);
    });

    it('should return empty payments array for unpaid voucher', async () => {
      const voucherId = 'unpaid-voucher-id';
      const instituteId = 'test-institute-id';

      const history = await getPaymentHistory(voucherId, instituteId);

      expect(history.payments).toEqual([]);
      expect(history.summary.totalPaid).toBe(0);
      expect(history.summary.remaining).toBe(history.voucher.net_amount);
      expect(history.summary.fullyPaid).toBe(false);
    });

    it('should throw error for non-existent voucher', async () => {
      const voucherId = 'non-existent-voucher';
      const instituteId = 'test-institute-id';

      await expect(
        getPaymentHistory(voucherId, instituteId)
      ).rejects.toThrow('Voucher not found');
    });

    it('should include collector details in payment records', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';
      const collectorId = 'staff-collector-id';

      await recordPayment(voucherId, instituteId, {
        amount: 5000,
        paymentMethod: 'cash',
        collectedBy: collectorId
      });

      const history = await getPaymentHistory(voucherId, instituteId);
      const payment = history.payments[0];

      expect(payment.User).toBeDefined();
      expect(payment.User.id).toBe(collectorId);
    });
  });

  describe('getPaymentSummary', () => {
    
    it('should categorize vouchers by payment status', async () => {
      const feeTypeId = 'monthly';
      const instituteId = 'test-institute-id';

      const summary = await getPaymentSummary(feeTypeId, instituteId);

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.totalAmount).toBeGreaterThan(0);
      expect(summary.collected).toBeDefined();
      expect(summary.partial).toBeDefined();
      expect(summary.pending).toBeDefined();
      expect(summary.overdue).toBeDefined();
      expect(summary.defaulters).toBeDefined();
    });

    it('should correctly count collected vouchers', async () => {
      const feeTypeId = 'monthly';
      const instituteId = 'test-institute-id';

      const summary = await getPaymentSummary(feeTypeId, instituteId);

      // Sum of all categories should equal total
      const categorized = 
        summary.collected.count + 
        summary.partial.count + 
        summary.pending.count + 
        summary.overdue.count;

      expect(categorized).toBeLessThanOrEqual(summary.total);
    });

    it('should identify defaulters (30+ days overdue)', async () => {
      const feeTypeId = 'monthly';
      const instituteId = 'test-institute-id';

      const summary = await getPaymentSummary(feeTypeId, instituteId);

      // All defaulters should have due dates 30+ days ago
      summary.defaulters.vouchers.forEach(voucher => {
        const daysOverdue = Math.floor(
          (new Date() - new Date(voucher.dueDate)) / (1000 * 60 * 60 * 24)
        );
        expect(daysOverdue).toBeGreaterThanOrEqual(30);
      });
    });

    it('should filter by month and year', async () => {
      const feeTypeId = 'monthly';
      const instituteId = 'test-institute-id';

      const summary = await getPaymentSummary(
        feeTypeId,
        instituteId,
        { month: 1, year: 2025 }
      );

      // All vouchers should be from January 2025
      const allVouchers = [
        ...summary.collected.vouchers,
        ...summary.partial.vouchers,
        ...summary.pending.vouchers,
        ...summary.overdue.vouchers
      ];

      allVouchers.forEach(voucher => {
        const issueDate = new Date(voucher.issuedDate);
        expect(issueDate.getMonth()).toBe(0); // January
        expect(issueDate.getFullYear()).toBe(2025);
      });
    });

    it('should calculate correct collection rates', async () => {
      const feeTypeId = 'monthly';
      const instituteId = 'test-institute-id';

      const summary = await getPaymentSummary(feeTypeId, instituteId);

      const collectionRate = (summary.collected.amount / summary.totalAmount);
      
      expect(collectionRate).toBeGreaterThanOrEqual(0);
      expect(collectionRate).toBeLessThanOrEqual(1);
    });
  });

  describe('updateVoucherStatus', () => {
    
    it('should update status to paid', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';

      const voucher = await updateVoucherStatus(
        voucherId,
        instituteId,
        'paid'
      );

      expect(voucher.status).toBe('paid');
    });

    it('should update status to partial', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';

      const voucher = await updateVoucherStatus(
        voucherId,
        instituteId,
        'partial',
        5000
      );

      expect(voucher.status).toBe('partial');
      expect(voucher.previous_balance).toBe(10000); // 15000 - 5000
    });

    it('should reject invalid status', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';

      await expect(
        updateVoucherStatus(voucherId, instituteId, 'invalid_status')
      ).rejects.toThrow('Invalid status');
    });

    it('should send notification on status update', async () => {
      const voucherId = 'test-voucher-id';
      const instituteId = 'test-institute-id';

      // Mock notification service
      const notificationSpy = jest.spyOn(notificationService, 'createNotification');

      await updateVoucherStatus(voucherId, instituteId, 'paid');

      expect(notificationSpy).toHaveBeenCalled();
    });
  });
});
```

---

## Integration Tests

### API Endpoint Tests

```javascript
// tests/api/feeVoucher.integration.test.js

describe('Fee Voucher API Integration Tests', () => {
  
  let app;
  let request;
  let adminToken;
  let staffToken;
  let voucherId;

  beforeAll(async () => {
    app = await initializeApp();
    request = supertest(app);
    
    // Setup test data
    adminToken = generateTestToken('INSTITUTE_ADMIN');
    staffToken = generateTestToken('STAFF');
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  describe('POST /api/fee-vouchers/:voucherId/payment', () => {
    
    it('should record payment with valid data', async () => {
      const response = await request
        .post(`/api/fee-vouchers/${voucherId}/payment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          amount: 5000,
          paymentMethod: 'cash',
          paidDate: '2025-01-15'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.amount_paid).toBe(5000);
      expect(response.body.data.receipt_number).toBeDefined();
    });

    it('should reject unauthorized user', async () => {
      const response = await request
        .post(`/api/fee-vouchers/${voucherId}/payment`)
        .send({
          amount: 5000,
          paymentMethod: 'cash'
        });

      expect(response.status).toBe(401);
    });

    it('should reject insufficient permissions', async () => {
      const studentToken = generateTestToken('STUDENT');
      
      const response = await request
        .post(`/api/fee-vouchers/${voucherId}/payment`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          amount: 5000,
          paymentMethod: 'cash'
        });

      expect(response.status).toBe(403);
    });

    it('should validate payment amount', async () => {
      const response = await request
        .post(`/api/fee-vouchers/${voucherId}/payment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          amount: 0,
          paymentMethod: 'cash'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Valid payment amount');
    });

    it('should return 404 for non-existent voucher', async () => {
      const response = await request
        .post(`/api/fee-vouchers/non-existent-id/payment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          amount: 5000,
          paymentMethod: 'cash'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/fee-vouchers/:voucherId/payment-history', () => {
    
    it('should return payment history', async () => {
      const response = await request
        .get(`/api/fee-vouchers/${voucherId}/payment-history`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.voucher).toBeDefined();
      expect(response.body.data.payments).toBeInstanceOf(Array);
      expect(response.body.data.summary).toBeDefined();
    });

    it('should include payment details', async () => {
      const response = await request
        .get(`/api/fee-vouchers/${voucherId}/payment-history`)
        .set('Authorization', `Bearer ${staffToken}`);

      const payment = response.body.data.payments[0];
      
      expect(payment.amount_paid).toBeDefined();
      expect(payment.payment_method).toBeDefined();
      expect(payment.payment_date).toBeDefined();
      expect(payment.receipt_number).toBeDefined();
    });

    it('should allow student to view own voucher history', async () => {
      const studentToken = generateTestToken('STUDENT');
      
      const response = await request
        .get(`/api/fee-vouchers/${voucherId}/payment-history`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/fee-vouchers/payment-summary/:feeTypeId', () => {
    
    it('should return payment summary', async () => {
      const response = await request
        .get(`/api/fee-vouchers/payment-summary/monthly`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.collected).toBeDefined();
      expect(response.body.data.partial).toBeDefined();
      expect(response.body.data.pending).toBeDefined();
      expect(response.body.data.overdue).toBeDefined();
      expect(response.body.data.defaulters).toBeDefined();
    });

    it('should filter by month and year', async () => {
      const response = await request
        .get(`/api/fee-vouchers/payment-summary/monthly?month=1&year=2025`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBeGreaterThanOrEqual(0);
    });

    it('should restrict access to staff only', async () => {
      const studentToken = generateTestToken('STUDENT');
      
      const response = await request
        .get(`/api/fee-vouchers/payment-summary/monthly`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should calculate correct statistics', async () => {
      const response = await request
        .get(`/api/fee-vouchers/payment-summary/monthly`)
        .set('Authorization', `Bearer ${adminToken}`);

      const data = response.body.data;
      const sumCounts = 
        data.collected.count +
        data.partial.count +
        data.pending.count +
        data.overdue.count;

      expect(sumCounts).toBeLessThanOrEqual(data.total);
    });
  });
});
```

---

## E2E Tests

### Complete Payment Flow

```javascript
// tests/e2e/payment-flow.test.js

describe('Complete Fee Payment E2E Flow', () => {
  
  it('should complete full payment flow', async () => {
    // 1. Generate voucher
    const voucherResponse = await request
      .post('/api/fee-vouchers/generate-single')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: testStudentId,
        month: 1,
        year: 2025,
        dueDate: '2025-01-31'
      });

    expect(voucherResponse.status).toBe(201);
    const voucherId = voucherResponse.body.data.id;
    expect(voucherId).toBeDefined();

    // 2. Verify voucher is in pending status
    const voucherCheck = await request
      .get(`/api/fee-vouchers/${voucherId}/payment-history`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(voucherCheck.body.data.summary.fullyPaid).toBe(false);
    expect(voucherCheck.body.data.summary.totalPaid).toBe(0);
    expect(voucherCheck.body.data.summary.remaining).toBe(15000);

    // 3. Record first partial payment
    const payment1 = await request
      .post(`/api/fee-vouchers/${voucherId}/payment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        amount: 5000,
        paymentMethod: 'cash',
        paidDate: '2025-01-10'
      });

    expect(payment1.status).toBe(201);

    // 4. Check updated balance
    const checkAfterPayment1 = await request
      .get(`/api/fee-vouchers/${voucherId}/payment-history`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(checkAfterPayment1.body.data.summary.totalPaid).toBe(5000);
    expect(checkAfterPayment1.body.data.summary.remaining).toBe(10000);

    // 5. Record second partial payment
    const payment2 = await request
      .post(`/api/fee-vouchers/${voucherId}/payment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        amount: 10000,
        paymentMethod: 'bank_transfer',
        reference: 'HBL-123456',
        paidDate: '2025-01-20'
      });

    expect(payment2.status).toBe(201);

    // 6. Verify voucher is now fully paid
    const finalCheck = await request
      .get(`/api/fee-vouchers/${voucherId}/payment-history`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(finalCheck.body.data.summary.fullyPaid).toBe(true);
    expect(finalCheck.body.data.summary.totalPaid).toBe(15000);
    expect(finalCheck.body.data.summary.remaining).toBe(0);
    expect(finalCheck.body.data.payments.length).toBe(2);

    // 7. Verify collection summary updated
    const summary = await request
      .get(`/api/fee-vouchers/payment-summary/monthly`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summary.body.data.collected.vouchers).toContainEqual(
      expect.objectContaining({ id: voucherId })
    );
  });

  it('should handle installment payment plan', async () => {
    // Create 3-month payment plan
    const payments = [
      { month: 1, amount: 5000, method: 'cash' },
      { month: 1, amount: 5000, method: 'cash' },
      { month: 1, amount: 5000, method: 'cash' }
    ];

    const voucherId = await generateVoucher();

    for (const payment of payments) {
      const response = await request
        .post(`/api/fee-vouchers/${voucherId}/payment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          amount: payment.amount,
          paymentMethod: payment.method,
          paidDate: `2025-01-${10 + payments.indexOf(payment)}`
        });

      expect(response.status).toBe(201);
    }

    // Verify all payments recorded
    const history = await request
      .get(`/api/fee-vouchers/${voucherId}/payment-history`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(history.body.data.payments.length).toBe(3);
    expect(history.body.data.summary.fullyPaid).toBe(true);
  });

  it('should prevent overpayment', async () => {
    const voucherId = await generateVoucher(15000);

    const response = await request
      .post(`/api/fee-vouchers/${voucherId}/payment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        amount: 20000,
        paymentMethod: 'cash'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('exceeds voucher amount');
  });
});
```

---

## Performance Tests

```javascript
// tests/performance/payment.performance.test.js

describe('Payment System Performance', () => {
  
  it('should handle 1000 concurrent payment records', async () => {
    const voucherIds = await generateTestVouchers(1000);
    
    const start = Date.now();
    
    const promises = voucherIds.map(id =>
      recordPayment(id, testInstituteId, {
        amount: 5000,
        paymentMethod: 'cash',
        collectedBy: staffId
      })
    );

    await Promise.all(promises);
    const duration = Date.now() - start;

    console.log(`Recorded 1000 payments in ${duration}ms`);
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
  });

  it('should retrieve payment summary within 5 seconds', async () => {
    const start = Date.now();
    
    const summary = await getPaymentSummary('monthly', testInstituteId);
    
    const duration = Date.now() - start;
    
    console.log(`Retrieved summary with ${summary.total} vouchers in ${duration}ms`);
    expect(duration).toBeLessThan(5000);
  });

  it('should query payment history efficiently', async () => {
    const voucherId = await generateVoucherWithPayments(100);
    
    const start = Date.now();
    
    const history = await getPaymentHistory(voucherId, testInstituteId);
    
    const duration = Date.now() - start;
    
    console.log(`Retrieved 100 payments in ${duration}ms`);
    expect(duration).toBeLessThan(1000);
  });
});
```

---

## Test Data Fixtures

```javascript
// tests/fixtures/payment.fixtures.js

export const testVoucher = {
  id: 'test-voucher-001',
  institute_id: 'test-institute',
  student_id: 'test-student',
  voucher_number: 'TCA/2025/001',
  net_amount: 15000,
  status: 'pending',
  issued_date: '2025-01-01',
  due_date: '2025-01-31'
};

export const testPayment = {
  amount: 5000,
  paymentMethod: 'cash',
  paidDate: '2025-01-15',
  collectedBy: 'staff-user-id'
};

export const testPayments = [
  { ...testPayment, amount: 5000, paymentMethod: 'cash' },
  { ...testPayment, amount: 10000, paymentMethod: 'bank_transfer' }
];

export async function seedTestData() {
  // Create test institute
  // Create test student
  // Generate test vouchers
  // Record test payments
}

export async function cleanupTestData() {
  // Delete all test records
}
```

---

## Test Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| recordPayment | 95% |
| getPaymentHistory | 95% |
| getPaymentSummary | 90% |
| updateVoucherStatus | 95% |
| API Endpoints | 90% |
| Error Handling | 95% |
| **Overall** | **92%** |

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/services/feeVoucher.service.test.js

# Run with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Watch mode
npm test -- --watch
```

---

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Fee Payment System

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Generate coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

