import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode } from '../helpers/db.helper.js';

describe('E2E: Fee Management Module (/api/v1/fee-templates, /api/v1/fee-vouchers)', () => {
  let context;
  let createdTemplateId;
  let createdVoucherId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('Fee Templates CRUD', () => {
    it('POST /api/v1/fee-templates - should create a new fee template', async () => {
      const tName = `Tuition Plan ${uniqueCode('')}`;
      const res = await api
        .post('/api/v1/fee-templates')
        .set(context.instituteAdmin.headers)
        .send({
          name: tName,
          fee_basis: 'monthly',
          due_day: 10,
          late_fine_type: 'fixed',
          late_fine_amount: 200,
          late_fine_after_days: 5,
          components: [
            { name: 'Tuition Fee', amount: 5000, is_mandatory: true },
            { name: 'Computer Lab Fee', amount: 1000, is_mandatory: false },
          ],
          applicable_to: {
            class_ids: [context.testClass.id],
          },
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdTemplateId = res.body.data.id;
    });

    it('GET /api/v1/fee-templates - should fetch all fee templates', async () => {
      const res = await api
        .get('/api/v1/fee-templates')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/fee-templates/:id - should get fee template by ID', async () => {
      if (!createdTemplateId) return;
      const res = await api
        .get(`/api/v1/fee-templates/${createdTemplateId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PUT /api/v1/fee-templates/:id - should update fee template', async () => {
      if (!createdTemplateId) return;
      const res = await api
        .put(`/api/v1/fee-templates/${createdTemplateId}`)
        .set(context.instituteAdmin.headers)
        .send({
          description: 'Updated template description',
          late_fine_amount: 250,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('POST /api/v1/fee-templates/:id/assign - should assign template to class', async () => {
      if (!createdTemplateId) return;
      const res = await api
        .post(`/api/v1/fee-templates/${createdTemplateId}/assign`)
        .set(context.instituteAdmin.headers)
        .send({
          class_ids: [context.testClass.id],
          all_classes: false,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Fee Vouchers & Payments', () => {
    it('POST /api/v1/fee-vouchers/generate-single - should generate voucher for student', async () => {
      const res = await api
        .post('/api/v1/fee-vouchers/generate-single')
        .set(context.instituteAdmin.headers)
        .send({
          student_id: context.student.user.id,
          month: 3,
          year: 2026,
          due_date: '2026-03-15',
          fee_components: [
            { name: 'Tuition Fee', amount: 5000 },
          ],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      if (res.body.data?.id) createdVoucherId = res.body.data.id;
    });

    it('GET /api/v1/fee-vouchers/stats - should return voucher statistics', async () => {
      const res = await api
        .get('/api/v1/fee-vouchers/stats')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/fee-vouchers/defaulters - should return fee defaulters list', async () => {
      const res = await api
        .get('/api/v1/fee-vouchers/defaulters')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/fee-vouchers - should fetch fee vouchers list', async () => {
      const res = await api
        .get(`/api/v1/fee-vouchers?student_id=${context.student.user.id}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      if (!createdVoucherId && Array.isArray(res.body.data?.rows) && res.body.data.rows.length > 0) {
        createdVoucherId = res.body.data.rows[0].id;
      }
    });

    it('POST /api/v1/fee-vouchers/:voucherId/payment - should record payment against voucher', async () => {
      if (!createdVoucherId) return;
      const res = await api
        .post(`/api/v1/fee-vouchers/${createdVoucherId}/payment`)
        .set(context.instituteAdmin.headers)
        .send({
          amount: 5000,
          payment_method: 'CASH',
          payment_date: '2026-03-10',
          remarks: 'Paid in full at counter',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/fee-vouchers/:voucherId/payment-history - should return payment history', async () => {
      if (!createdVoucherId) return;
      const res = await api
        .get(`/api/v1/fee-vouchers/${createdVoucherId}/payment-history`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
