import { api } from '../helpers/app.helper.js';
import { setupTestContext, generateTestToken, authHeader } from '../helpers/auth.helper.js';
import { createTestUser, createTestInstitute } from '../helpers/db.helper.js';
import { signRefreshToken } from '../../src/config/auth.js';

describe('E2E: Authentication Flow (/api/v1/auth)', () => {
  let context;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid email and password', async () => {
      const res = await api
        .post('/api/v1/auth/login')
        .send({
          email: context.instituteAdmin.plainEmail,
          password: context.instituteAdmin.password,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe(context.instituteAdmin.plainEmail);
    });

    it('should fail with 401 on incorrect password', async () => {
      const res = await api
        .post('/api/v1/auth/login')
        .send({
          email: context.instituteAdmin.plainEmail,
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should fail with 401 on non-existent user email', async () => {
      const res = await api
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent_user_99999@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should fail with 422 if email is missing', async () => {
      const res = await api
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should fail if user is inactive', async () => {
      const inactiveUser = await createTestUser({
        school_id: context.institute.id,
        is_active: false,
      });

      const res = await api
        .post('/api/v1/auth/login')
        .send({
          email: inactiveUser.plainEmail,
          password: inactiveUser.password,
        });

      expect([401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current authenticated user profile', async () => {
      const res = await api
        .get('/api/v1/auth/me')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', context.instituteAdmin.user.id);
      expect(res.body.data).toHaveProperty('email', context.instituteAdmin.plainEmail);
    });

    it('should return 401 if token is missing', async () => {
      const res = await api.get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 if token is invalid', async () => {
      const res = await api
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/my-institute', () => {
    it('should return current institute details for institute admin', async () => {
      const res = await api
        .get('/api/v1/auth/my-institute')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', context.institute.id);
    });
  });

  describe('GET /api/v1/auth/my-policies', () => {
    it('should return list of institute policies', async () => {
      const res = await api
        .get('/api/v1/auth/my-policies')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('policies');
    });
  });

  describe('GET /api/v1/auth/refresh-data', () => {
    it('should return updated user data', async () => {
      const res = await api
        .get('/api/v1/auth/refresh-data')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', context.instituteAdmin.user.id);
    });
  });

  describe('GET /api/v1/auth/accounts', () => {
    it('should return list of accounts associated with an email', async () => {
      const res = await api
        .get(`/api/v1/auth/accounts?email=${encodeURIComponent(context.instituteAdmin.plainEmail)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data.accounts)).toBe(true);
      expect(res.body.data.accounts.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should generate a new access token when provided a valid refresh token', async () => {
      const refreshToken = signRefreshToken({ userId: context.instituteAdmin.user.id });
      const res = await api
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should fail with 401 if refresh token is missing', async () => {
      const res = await api
        .post('/api/v1/auth/refresh-token')
        .send({});

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await api
        .post('/api/v1/auth/logout')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
