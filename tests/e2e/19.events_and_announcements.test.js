import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode } from '../helpers/db.helper.js';

describe('E2E: Events Module (/api/v1/events)', () => {
  let context;
  let createdEventId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('Events CRUD', () => {
    it('POST /api/v1/events - should create a school event', async () => {
      const eventTitle = `Annual Sports Day ${uniqueCode('')}`;
      const res = await api
        .post('/api/v1/events')
        .set(context.instituteAdmin.headers)
        .send({
          event_name: eventTitle,
          title: eventTitle,
          description: 'All grades athletic competitions and sports activities',
          event_type: 'Sports',
          date: '2026-06-01',
          time: '08:00:00',
          location: 'Main Campus Stadium',
          audience_type: 'all',
          status: 'scheduled',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdEventId = res.body.data.id;
    });

    it('GET /api/v1/events - should list events with pagination', async () => {
      const res = await api
        .get('/api/v1/events?page=1&limit=10')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/events/upcoming - should fetch upcoming events', async () => {
      const res = await api
        .get('/api/v1/events/upcoming')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/events/my - should fetch user events', async () => {
      const res = await api
        .get('/api/v1/events/my')
        .set(context.teacher.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/events/:id - should get event by ID', async () => {
      if (!createdEventId) return;
      const res = await api
        .get(`/api/v1/events/${createdEventId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PUT /api/v1/events/:id - should update event', async () => {
      if (!createdEventId) return;
      const res = await api
        .put(`/api/v1/events/${createdEventId}`)
        .set(context.instituteAdmin.headers)
        .send({
          venue: 'Sports Complex Arena',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /api/v1/events/:id/status - should toggle event status', async () => {
      if (!createdEventId) return;
      const res = await api
        .patch(`/api/v1/events/${createdEventId}/status`)
        .set(context.instituteAdmin.headers)
        .send({
          status: 'completed',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/events/:id/attendance - should get attendance summary', async () => {
      if (!createdEventId) return;
      const res = await api
        .get(`/api/v1/events/${createdEventId}/attendance`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('DELETE /api/v1/events/:id - should delete event', async () => {
      if (!createdEventId) return;
      const res = await api
        .delete(`/api/v1/events/${createdEventId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
