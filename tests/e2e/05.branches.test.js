import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode, uniqueEmail } from '../helpers/db.helper.js';

describe('E2E: Branch Management Module (/api/v1/branches)', () => {
  let context;
  let createdBranchId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/branches', () => {
    it('should create a new branch successfully', async () => {
      const code = uniqueCode('BR');
      const res = await api
        .post('/api/v1/branches')
        .set(context.instituteAdmin.headers)
        .send({
          name: `North Campus ${code}`,
          code,
          phone: '+1234567890',
          email: uniqueEmail('north_branch'),
          address: 'Block 4, Sector G',
          city: 'Islamabad',
          is_main: false,
          is_active: true,
          settings: {
            has_library: true,
            has_lab: true,
          },
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdBranchId = res.body.data.id;
    });

    it('should fail with 422/400 if branch name is missing', async () => {
      const res = await api
        .post('/api/v1/branches')
        .set(context.instituteAdmin.headers)
        .send({
          code: 'INVALID_NO_NAME',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/branches', () => {
    it('should return list of branches with pagination', async () => {
      const res = await api
        .get('/api/v1/branches?page=1&limit=10')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/branches/options', () => {
    it('should return branch options for dropdowns', async () => {
      const res = await api
        .get('/api/v1/branches/options')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/branches/stats', () => {
    it('should return branch statistics', async () => {
      const res = await api
        .get('/api/v1/branches/stats')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/branches/:id', () => {
    it('should return branch by ID', async () => {
      const targetId = createdBranchId || context.branch.id;
      const res = await api
        .get(`/api/v1/branches/${targetId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', targetId);
    });
  });

  describe('PUT /api/v1/branches/:id', () => {
    it('should update branch details', async () => {
      const targetId = createdBranchId || context.branch.id;
      const res = await api
        .put(`/api/v1/branches/${targetId}`)
        .set(context.instituteAdmin.headers)
        .send({
          name: 'Updated Branch Name',
          city: 'Rawalpindi',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PATCH /api/v1/branches/:id/toggle-status', () => {
    it('should toggle branch active status', async () => {
      const targetId = createdBranchId || context.branch.id;
      const res = await api
        .patch(`/api/v1/branches/${targetId}/toggle-status`)
        .set(context.instituteAdmin.headers)
        .send({
          is_active: false,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/branches/:id', () => {
    it('should delete branch', async () => {
      if (!createdBranchId) return;
      const res = await api
        .delete(`/api/v1/branches/${createdBranchId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
