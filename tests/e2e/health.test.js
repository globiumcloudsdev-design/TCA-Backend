import { api } from '../helpers/app.helper.js';

describe('Health & Public Root Endpoints', () => {
  it('GET /health - should return 200 with server status', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptime');
  });

  it('GET / - should return welcome message and version', async () => {
    const res = await api.get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('Welcome to The Clouds Academy API');
  });

  it('GET /api/v1/ping - should return 200 with ok: true', async () => {
    const res = await api.get('/api/v1/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, version: 'v1' });
  });

  it('GET /api/v1/non-existing-route - should return 404', async () => {
    const res = await api.get('/api/v1/non-existing-route-404');
    expect(res.status).toBe(404);
  });
});
