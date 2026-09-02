import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';

describe('E2E: Institute Profile & Settings (/api/v1/institutes, /api/v1/settings)', () => {
  let context;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('GET /api/v1/institutes/profile', () => {
    it('should return institute profile for current institute user', async () => {
      const res = await api
        .get('/api/v1/institutes/profile')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', context.institute.id);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await api.get('/api/v1/institutes/profile');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/settings', () => {
    it('should return institute settings', async () => {
      const res = await api
        .get('/api/v1/settings')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PUT /api/v1/settings/general', () => {
    it('should update general institute settings', async () => {
      const res = await api
        .put('/api/v1/settings/general')
        .set(context.instituteAdmin.headers)
        .send({
          institute_name: 'Updated General Name',
          institute_city: 'Lahore',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PUT /api/v1/settings/academic', () => {
    it('should update academic settings', async () => {
      const res = await api
        .put('/api/v1/settings/academic')
        .set(context.instituteAdmin.headers)
        .send({
          grading_system: 'gpa',
          pass_percentage: 40,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PUT /api/v1/settings/finance', () => {
    it('should update finance settings', async () => {
      const res = await api
        .put('/api/v1/settings/finance')
        .set(context.instituteAdmin.headers)
        .send({
          currency: 'PKR',
          tax_rate: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PUT /api/v1/settings/security', () => {
    it('should update security settings', async () => {
      const res = await api
        .put('/api/v1/settings/security')
        .set(context.instituteAdmin.headers)
        .send({
          two_factor_enabled: false,
          session_timeout: 60,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/settings/bulk', () => {
    it('should perform bulk settings update', async () => {
      const res = await api
        .post('/api/v1/settings/bulk')
        .set(context.instituteAdmin.headers)
        .send({
          general: { institute_city: 'Islamabad' },
          academic: { pass_percentage: 33 },
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
