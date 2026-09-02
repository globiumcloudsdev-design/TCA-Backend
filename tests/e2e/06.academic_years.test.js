import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode } from '../helpers/db.helper.js';

describe('E2E: Academic Year Module (/api/v1/academic-years)', () => {
  let context;
  let createdYearId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/academic-years', () => {
    it('should create an academic year successfully', async () => {
      const yearName = `AY_${uniqueCode('').slice(-6)}`;
      const res = await api
        .post('/api/v1/academic-years')
        .set(context.instituteAdmin.headers)
        .send({
          name: yearName,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          is_current: false,
          is_active: true,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdYearId = res.body.data.id;
    });

    it('should fail if end_date is before start_date', async () => {
      const res = await api
        .post('/api/v1/academic-years')
        .set(context.instituteAdmin.headers)
        .send({
          name: 'InvalidAY',
          start_date: '2026-12-31',
          end_date: '2026-01-01',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/academic-years', () => {
    it('should return list of academic years', async () => {
      const res = await api
        .get('/api/v1/academic-years')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/academic-years/options', () => {
    it('should return academic year options for dropdowns', async () => {
      const res = await api
        .get('/api/v1/academic-years/options')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/academic-years/current', () => {
    it('should return the current active academic year', async () => {
      const res = await api
        .get('/api/v1/academic-years/current')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/academic-years/:id', () => {
    it('should return academic year details by ID', async () => {
      const targetId = createdYearId || context.academicYear.id;
      const res = await api
        .get(`/api/v1/academic-years/${targetId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', targetId);
    });
  });

  describe('PUT /api/v1/academic-years/:id', () => {
    it('should update academic year', async () => {
      const targetId = createdYearId || context.academicYear.id;
      const res = await api
        .put(`/api/v1/academic-years/${targetId}`)
        .set(context.instituteAdmin.headers)
        .send({
          description: 'Updated academic year description',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PATCH /api/v1/academic-years/:id/set-current', () => {
    it('should set the academic year as current', async () => {
      const targetId = createdYearId || context.academicYear.id;
      const res = await api
        .patch(`/api/v1/academic-years/${targetId}/set-current`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/academic-years/:id', () => {
    it('should delete academic year', async () => {
      // Create a temporary non-current academic year to delete
      const createRes = await api
        .post('/api/v1/academic-years')
        .set(context.instituteAdmin.headers)
        .send({
          name: `AY_${uniqueCode('').slice(0, 10)}`,
          start_date: '2028-01-01',
          end_date: '2028-12-31',
          is_current: false,
        });
      const deleteId = createRes.body?.data?.id || createdYearId;

      const res = await api
        .delete(`/api/v1/academic-years/${deleteId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
