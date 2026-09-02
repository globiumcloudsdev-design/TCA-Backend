import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';

describe('E2E: Analytics & Reporting Module (/api/v1/reports)', () => {
  let context;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('Report Discovery & Options', () => {
    it('GET /templates - should return available report templates', async () => {
      const res = await api
        .get('/api/v1/reports/templates')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /options - should return dropdown filter options', async () => {
      const res = await api
        .get('/api/v1/reports/options')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /permissions - should return user report permissions', async () => {
      const res = await api
        .get('/api/v1/reports/permissions')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Generated Reports', () => {
    it('GET /student - should generate student report', async () => {
      const res = await api
        .get('/api/v1/reports/student')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /attendance - should generate attendance report', async () => {
      const res = await api
        .get(`/api/v1/reports/attendance?month=3&year=2026&class_id=${context.testClass.id}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /fee - should generate fee collection report', async () => {
      const res = await api
        .get('/api/v1/reports/fee?year=2026')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /exam - should generate exam performance report', async () => {
      const res = await api
        .get('/api/v1/reports/exam')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /payroll - should generate payroll report', async () => {
      const res = await api
        .get('/api/v1/reports/payroll?month=3&year=2026')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /analytics - should generate full analytics summary report', async () => {
      const res = await api
        .get('/api/v1/reports/analytics')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /profit-loss - should generate profit & loss report', async () => {
      const res = await api
        .get('/api/v1/reports/profit-loss?year=2026')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
