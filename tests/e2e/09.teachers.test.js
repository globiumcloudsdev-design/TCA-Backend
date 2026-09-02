import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueEmail } from '../helpers/db.helper.js';

describe('E2E: Teacher Management Module (/api/v1/teachers)', () => {
  let context;
  let createdTeacherId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/teachers', () => {
    it('should create a new teacher successfully', async () => {
      const res = await api
        .post('/api/v1/teachers')
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Professor',
          last_name: 'Albus',
          email: uniqueEmail('teacher_new'),
          password: 'Password@123',
          phone: '+1234567800',
          qualification: 'Ph.D Physics',
          designation: 'Department Head',
          joining_date: '2025-08-01',
          salary: 80000,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdTeacherId = res.body.data.id;
    });

    it('should fail if first_name is missing', async () => {
      const res = await api
        .post('/api/v1/teachers')
        .set(context.instituteAdmin.headers)
        .send({
          last_name: 'Incomplete',
          email: uniqueEmail('teacher_fail'),
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/teachers', () => {
    it('should fetch paginated list of teachers', async () => {
      const res = await api
        .get('/api/v1/teachers?page=1&limit=10')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/teachers/roles', () => {
    it('should return teacher role options for dropdown', async () => {
      const res = await api
        .get('/api/v1/teachers/roles')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/teachers/search', () => {
    it('should search teachers by query', async () => {
      const res = await api
        .get('/api/v1/teachers/search?q=Albus')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/teachers/:id', () => {
    it('should return teacher by ID', async () => {
      const targetId = createdTeacherId || context.teacher.user.id;
      const res = await api
        .get(`/api/v1/teachers/${targetId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', targetId);
    });
  });

  describe('PUT /api/v1/teachers/:id', () => {
    it('should update teacher details', async () => {
      const targetId = createdTeacherId || context.teacher.user.id;
      const res = await api
        .put(`/api/v1/teachers/${targetId}`)
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Professor Updated',
          phone: '+1234567811',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/teachers/:id/regenerate-qr', () => {
    it('should regenerate teacher QR code', async () => {
      const targetId = createdTeacherId || context.teacher.user.id;
      const res = await api
        .post(`/api/v1/teachers/${targetId}/regenerate-qr`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PATCH /api/v1/teachers/:id/toggle-status', () => {
    it('should toggle teacher active status', async () => {
      const targetId = createdTeacherId || context.teacher.user.id;
      const res = await api
        .patch(`/api/v1/teachers/${targetId}/toggle-status`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/teachers/:id', () => {
    it('should delete teacher', async () => {
      if (!createdTeacherId) return;
      const res = await api
        .delete(`/api/v1/teachers/${createdTeacherId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
