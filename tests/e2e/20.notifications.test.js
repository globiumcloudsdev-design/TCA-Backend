import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';

describe('E2E: Notification Module (/api/v1/notifications)', () => {
  let context;
  let createdNotificationId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/notifications/send', () => {
    it('should send direct notification to student', async () => {
      const res = await api
        .post('/api/v1/notifications/send')
        .set(context.instituteAdmin.headers)
        .send({
          user_id: context.student.user.id,
          title: 'Welcome to TCA',
          body: 'Your student account is fully active.',
          type: 'general',
          channel: 'in_app',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      if (res.body.data?.id) createdNotificationId = res.body.data.id;
    });
  });

  describe('POST /api/v1/notifications/broadcast', () => {
    it('should broadcast notification to all teachers', async () => {
      const res = await api
        .post('/api/v1/notifications/broadcast')
        .set(context.instituteAdmin.headers)
        .send({
          recipient_type: 'TEACHER',
          title: 'Faculty Meeting',
          body: 'Staff meeting scheduled for 3:00 PM tomorrow.',
          type: 'general',
          channel: 'in_app',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('should list notifications for current user', async () => {
      const res = await api
        .get('/api/v1/notifications')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      if (!createdNotificationId && Array.isArray(res.body.data?.rows) && res.body.data.rows.length > 0) {
        createdNotificationId = res.body.data.rows[0].id;
      }
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const res = await api
        .get('/api/v1/notifications/unread-count')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/notifications/stats', () => {
    it('should return notification stats', async () => {
      const res = await api
        .get('/api/v1/notifications/stats')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark single notification as read', async () => {
      if (!createdNotificationId) return;
      const res = await api
        .patch(`/api/v1/notifications/${createdNotificationId}/read`)
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PATCH /api/v1/notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      const res = await api
        .patch('/api/v1/notifications/mark-all-read')
        .set(context.student.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
