import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';

describe('E2E: Role-Based Dashboards (/api/v1/dashboard)', () => {
  let context;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('GET /api/v1/dashboard/public', () => {
    it('should return public dashboard info without token', async () => {
      const res = await api.get('/api/v1/dashboard/public');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/dashboard/master', () => {
    it('should return master admin platform stats for Master Admin', async () => {
      const res = await api
        .get('/api/v1/dashboard/master')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should forbid regular institute admin from accessing master dashboard', async () => {
      const res = await api
        .get('/api/v1/dashboard/master')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/dashboard/institute', () => {
    it('should return institute overview stats for Institute Admin', async () => {
      const res = await api
        .get('/api/v1/dashboard/institute')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should return institute overview stats for Branch Admin', async () => {
      const res = await api
        .get('/api/v1/dashboard/institute')
        .set(context.branchAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/dashboard/teacher', () => {
    it('should return teacher classes and metrics for Teacher', async () => {
      const res = await api
        .get('/api/v1/dashboard/teacher')
        .set(context.teacher.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/dashboard/student', () => {
    it('should return student academic profile and metrics for Student', async () => {
      const res = await api
        .get('/api/v1/dashboard/student')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/dashboard/parent', () => {
    it('should return children overview and fees for Parent', async () => {
      const res = await api
        .get('/api/v1/dashboard/parent')
        .set(context.parent.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
