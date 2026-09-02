import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode, uniqueEmail } from '../helpers/db.helper.js';

describe('E2E: Expenses & Vendors Module (/api/v1/expenses, /api/v1/vendors)', () => {
  let context;
  let createdVendorId;
  let createdExpenseId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('Vendors CRUD', () => {
    it('POST /api/v1/vendors - should create a new vendor', async () => {
      const vName = `Office Supplies Co ${uniqueCode('')}`;
      const res = await api
        .post('/api/v1/vendors')
        .set(context.instituteAdmin.headers)
        .send({
          name: vName,
          type: 'Stationery',
          phone: '+1234567855',
          password: 'Password123!',
          email: uniqueEmail('vendor'),
          address: 'Main Market, Islamabad',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdVendorId = res.body.data.id;
    });

    it('GET /api/v1/vendors - should fetch list of vendors', async () => {
      const res = await api
        .get('/api/v1/vendors')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/vendors/:id - should get vendor by ID', async () => {
      if (!createdVendorId) return;
      const res = await api
        .get(`/api/v1/vendors/${createdVendorId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PUT /api/v1/vendors/:id - should update vendor details', async () => {
      if (!createdVendorId) return;
      const res = await api
        .put(`/api/v1/vendors/${createdVendorId}`)
        .set(context.instituteAdmin.headers)
        .send({
          company_name: 'Alpha Stationery & Printing Ltd',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Expenses CRUD & Stats', () => {
    it('POST /api/v1/expenses - should log a new expense', async () => {
      const res = await api
        .post('/api/v1/expenses')
        .set(context.instituteAdmin.headers)
        .send({
          title: 'Printing Exam Papers',
          amount: 15000,
          category: 'Printing',
          vendor_id: createdVendorId || undefined,
          vendor_name: !createdVendorId ? 'Alpha Print' : undefined,
          date: '2026-03-01',
          description: 'Midterm exam sheets printing',
          status: 'paid',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdExpenseId = res.body.data.id;
    });

    it('GET /api/v1/expenses - should list expenses with pagination', async () => {
      const res = await api
        .get('/api/v1/expenses?page=1&limit=10')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/expenses/stats - should fetch expense stats summary', async () => {
      const res = await api
        .get('/api/v1/expenses/stats')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/expenses/categories - should return list of categories', async () => {
      const res = await api
        .get('/api/v1/expenses/categories')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/expenses/:id - should get expense by ID', async () => {
      if (!createdExpenseId) return;
      const res = await api
        .get(`/api/v1/expenses/${createdExpenseId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PUT /api/v1/expenses/:id - should update expense', async () => {
      if (!createdExpenseId) return;
      const res = await api
        .put(`/api/v1/expenses/${createdExpenseId}`)
        .set(context.instituteAdmin.headers)
        .send({
          description: 'Updated printing sheets description',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('DELETE /api/v1/expenses/:id - should delete expense', async () => {
      if (!createdExpenseId) return;
      const res = await api
        .delete(`/api/v1/expenses/${createdExpenseId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
