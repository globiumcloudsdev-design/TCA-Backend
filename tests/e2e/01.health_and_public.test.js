import { api } from '../helpers/app.helper.js';

describe('E2E: Health, Public & Error Handling Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 with server health metadata', async () => {
      const res = await api.get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'OK');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('environment');
      expect(res.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('GET /', () => {
    it('should return 200 with welcome message', async () => {
      const res = await api.get('/');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('Welcome to The Clouds Academy API');
    });
  });

  describe('GET /api/v1/ping', () => {
    it('should return 200 with ok: true and version v1', async () => {
      const res = await api.get('/api/v1/ping');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, version: 'v1' });
    });
  });

  describe('GET /api/v1/public/pricing-plans', () => {
    it('should return 200 with published pricing plans list', async () => {
      const res = await api.get('/api/v1/public/pricing-plans');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/public/platform-status', () => {
    it('should return 200 with platform status', async () => {
      const res = await api.get('/api/v1/public/platform-status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/public/cms', () => {
    it('should return 200 with cms configuration', async () => {
      const res = await api.get('/api/v1/public/cms');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('404 Route Not Found', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await api.get('/api/v1/invalid-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
    });
  });
});
