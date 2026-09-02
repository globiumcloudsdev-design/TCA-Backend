import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueEmail } from '../helpers/db.helper.js';

describe('E2E: Staff & Staff Attendance Module (/api/v1/staff, /api/v1/staff-attendance)', () => {
  let context;
  let createdStaffId;
  let createdAttendanceId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('Staff CRUD', () => {
    it('POST /api/v1/staff - should create a staff member', async () => {
      const res = await api
        .post('/api/v1/staff')
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Sara',
          last_name: 'Ahmed',
          email: uniqueEmail('staff_new'),
          password: 'Password@123',
          phone: '+1234567844',
          staff_type: 'Accountant',
          salary: 50000,
          joining_date: '2025-01-15',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdStaffId = res.body.data.id;
    });

    it('GET /api/v1/staff - should fetch list of staff', async () => {
      const res = await api
        .get('/api/v1/staff')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/staff/available-roles - should return available staff roles', async () => {
      const res = await api
        .get('/api/v1/staff/available-roles')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/staff/search - should search staff by name', async () => {
      const res = await api
        .get('/api/v1/staff/search?q=Sara')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/staff/:id - should return staff by ID', async () => {
      const targetId = createdStaffId || context.staff.user.id;
      const res = await api
        .get(`/api/v1/staff/${targetId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', targetId);
    });

    it('PUT /api/v1/staff/:id - should update staff details', async () => {
      const targetId = createdStaffId || context.staff.user.id;
      const res = await api
        .put(`/api/v1/staff/${targetId}`)
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Sara Updated',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /api/v1/staff/:id/status - should toggle staff status', async () => {
      const targetId = createdStaffId || context.staff.user.id;
      const res = await api
        .patch(`/api/v1/staff/${targetId}/status`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /api/v1/staff/:id/permissions - should update custom permissions', async () => {
      const targetId = createdStaffId || context.staff.user.id;
      const res = await api
        .patch(`/api/v1/staff/${targetId}/permissions`)
        .set(context.instituteAdmin.headers)
        .send({
          permissions: ['fee.create', 'fee.read'],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Staff Attendance', () => {
    it('POST /api/v1/staff-attendance - should mark staff attendance', async () => {
      const targetStaffId = createdStaffId || context.staff.user.id;
      const res = await api
        .post('/api/v1/staff-attendance')
        .set(context.instituteAdmin.headers)
        .send({
          staff_id: targetStaffId,
          date: '2026-03-01',
          status: 'PRESENT',
          late_minutes: 0,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      if (res.body.data?.id) createdAttendanceId = res.body.data.id;
    });

    it('GET /api/v1/staff-attendance - should list staff attendances', async () => {
      const res = await api
        .get('/api/v1/staff-attendance')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/staff-attendance/report - should fetch staff attendance report', async () => {
      const res = await api
        .get('/api/v1/staff-attendance/report?month=3&year=2026')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('POST /api/v1/staff-attendance/holiday - should mark holiday for staff', async () => {
      const res = await api
        .post('/api/v1/staff-attendance/holiday')
        .set(context.instituteAdmin.headers)
        .send({
          date: '2026-03-23',
          remarks: 'Pakistan National Day',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/staff/:id', () => {
    it('should delete staff', async () => {
      if (!createdStaffId) return;
      const res = await api
        .delete(`/api/v1/staff/${createdStaffId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
