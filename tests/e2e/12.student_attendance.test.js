import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';

describe('E2E: Student Attendance Module (/api/v1/attendance)', () => {
  let context;
  let createdAttendanceId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/attendance/mark', () => {
    it('should mark single student attendance', async () => {
      const res = await api
        .post('/api/v1/attendance/mark')
        .set(context.instituteAdmin.headers)
        .send({
          student_id: context.student.user.id,
          class_id: context.testClass.id,
          section_id: context.testSection.id,
          date: '2026-03-05',
          status: 'PRESENT',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      if (res.body.data?.id) createdAttendanceId = res.body.data.id;
    });
  });

  describe('POST /api/v1/attendance/bulk', () => {
    it('should bulk mark attendance for class/section students', async () => {
      const res = await api
        .post('/api/v1/attendance/bulk')
        .set(context.instituteAdmin.headers)
        .send({
          class_id: context.testClass.id,
          section_id: context.testSection.id,
          date: '2026-03-06',
          records: [
            {
              student_id: context.student.user.id,
              status: 'PRESENT',
            },
          ],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/attendance/holiday', () => {
    it('should mark a holiday for students', async () => {
      const res = await api
        .post('/api/v1/attendance/holiday')
        .set(context.instituteAdmin.headers)
        .send({
          date: '2026-03-23',
          remarks: 'Pakistan Day Holiday',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/attendance', () => {
    it('should list student attendance with filters', async () => {
      const res = await api
        .get(`/api/v1/attendance?class_id=${context.testClass.id}&section_id=${context.testSection.id}&date=2026-03-05`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/attendance/reports', () => {
    it('should fetch attendance summary report', async () => {
      const res = await api
        .get(`/api/v1/attendance/reports?class_id=${context.testClass.id}&month=3&year=2026`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
