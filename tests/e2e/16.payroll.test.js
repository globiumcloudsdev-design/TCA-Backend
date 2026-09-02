import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';

describe('E2E: Payroll Module (/api/v1/payroll)', () => {
  let context;
  let createdPayslipId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/payroll/generate', () => {
    it('should process and generate monthly payroll for staff/teachers', async () => {
      const res = await api
        .post('/api/v1/payroll/generate')
        .set(context.instituteAdmin.headers)
        .send({
          month: 3,
          year: 2026,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/payroll', () => {
    it('should return list of generated payslips', async () => {
      const res = await api
        .get('/api/v1/payroll?month=3&year=2026')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      if (Array.isArray(res.body.data?.rows) && res.body.data.rows.length > 0) {
        createdPayslipId = res.body.data.rows[0].id;
      }
    });
  });

  describe('GET /api/v1/payroll/years', () => {
    it('should return available payroll years', async () => {
      const res = await api
        .get('/api/v1/payroll/years')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/payroll/:id', () => {
    it('should return payslip details by ID', async () => {
      if (!createdPayslipId) return;
      const res = await api
        .get(`/api/v1/payroll/${createdPayslipId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PATCH /api/v1/payroll/:id', () => {
    it('should update payslip status / details', async () => {
      if (!createdPayslipId) return;
      const res = await api
        .patch(`/api/v1/payroll/${createdPayslipId}`)
        .set(context.instituteAdmin.headers)
        .send({
          payment_status: 'PAID',
          payment_method: 'BANK_TRANSFER',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
