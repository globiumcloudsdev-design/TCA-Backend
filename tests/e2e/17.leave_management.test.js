import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode } from '../helpers/db.helper.js';

describe('E2E: Leave Management Module (/api/v1/leave-types, /api/v1/leave-requests)', () => {
  let context;
  let createdLeaveTypeId;
  let createdLeaveRequestId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('Leave Types CRUD', () => {
    it('POST /api/v1/leave-types - should create a leave type', async () => {
      const typeName = `Sick Leave ${uniqueCode('')}`;
      const res = await api
        .post('/api/v1/leave-types')
        .set(context.instituteAdmin.headers)
        .send({
          leave_type_name: typeName,
          description: 'Medical and sick leave for staff',
          max_days_per_year: 12,
          is_paid: true,
          requires_approval: true,
          color_code: '#EF4444',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdLeaveTypeId = res.body.data.id;
    });

    it('GET /api/v1/leave-types - should fetch leave types', async () => {
      const res = await api
        .get('/api/v1/leave-types')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/leave-types/:id - should get leave type by ID', async () => {
      if (!createdLeaveTypeId) return;
      const res = await api
        .get(`/api/v1/leave-types/${createdLeaveTypeId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PUT /api/v1/leave-types/:id - should update leave type', async () => {
      if (!createdLeaveTypeId) return;
      const res = await api
        .put(`/api/v1/leave-types/${createdLeaveTypeId}`)
        .set(context.instituteAdmin.headers)
        .send({
          days_allowed: 15,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Leave Requests Workflow', () => {
    it('POST /api/v1/leave-requests - should submit a leave request (by Teacher)', async () => {
      if (!createdLeaveTypeId) return;
      const res = await api
        .post('/api/v1/leave-requests')
        .set(context.teacher.headers)
        .send({
          leave_type_id: createdLeaveTypeId,
          from_date: '2026-05-10',
          to_date: '2026-05-12',
          number_of_days: 3,
          reason: 'Medical appointment and recovery',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdLeaveRequestId = res.body.data.id;
    });

    it('GET /api/v1/leave-requests/my - should fetch user self leave requests', async () => {
      const res = await api
        .get('/api/v1/leave-requests/my')
        .set(context.teacher.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/leave-requests - should list all leave requests for admin', async () => {
      const res = await api
        .get('/api/v1/leave-requests')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /api/v1/leave-requests/:id/status - should approve leave request', async () => {
      if (!createdLeaveRequestId) return;
      const res = await api
        .patch(`/api/v1/leave-requests/${createdLeaveRequestId}/status`)
        .set(context.instituteAdmin.headers)
        .send({
          status: 'APPROVED',
          rejection_reason: null,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
