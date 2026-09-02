import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';

describe('E2E: Role Portals (/api/v1/portal)', () => {
  let context;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('Student Portal (/api/v1/portal/student)', () => {
    it('GET /dashboard - should return student dashboard data', async () => {
      const res = await api
        .get('/api/v1/portal/student/dashboard')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /profile - should return student profile', async () => {
      const res = await api
        .get('/api/v1/portal/student/profile')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /classes - should return student classes', async () => {
      const res = await api
        .get('/api/v1/portal/student/classes')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /attendance - should return student attendance records', async () => {
      const res = await api
        .get('/api/v1/portal/student/attendance')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /results - should return student exam results', async () => {
      const res = await api
        .get('/api/v1/portal/student/results')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Teacher Portal (/api/v1/portal/teacher)', () => {
    it('GET /dashboard - should return teacher portal dashboard', async () => {
      const res = await api
        .get('/api/v1/portal/teacher/dashboard')
        .set(context.teacher.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /profile - should return teacher profile', async () => {
      const res = await api
        .get('/api/v1/portal/teacher/profile')
        .set(context.teacher.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /classes - should list classes assigned to teacher', async () => {
      const res = await api
        .get('/api/v1/portal/teacher/classes')
        .set(context.teacher.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /students - should list students taught by teacher', async () => {
      const res = await api
        .get('/api/v1/portal/teacher/students')
        .set(context.teacher.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Parent Portal (/api/v1/portal/parent)', () => {
    it('GET /dashboard - should return parent portal dashboard', async () => {
      const res = await api
        .get('/api/v1/portal/parent/dashboard')
        .set(context.parent.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /profile - should return parent profile', async () => {
      const res = await api
        .get('/api/v1/portal/parent/profile')
        .set(context.parent.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /children - should return linked children', async () => {
      const res = await api
        .get('/api/v1/portal/parent/children')
        .set(context.parent.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
