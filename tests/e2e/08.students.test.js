import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode, uniqueEmail } from '../helpers/db.helper.js';

describe('E2E: Student Management Module (/api/v1/students)', () => {
  let context;
  let createdStudentId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/students', () => {
    it('should enroll/create a new student successfully', async () => {
      const regNo = uniqueCode('ST');
      const res = await api
        .post('/api/v1/students')
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Ahmed',
          last_name: 'Khan',
          registration_no: regNo,
          email: uniqueEmail('student_enroll'),
          password: 'Password@123',
          class_id: context.testClass.id,
          section_id: context.testSection.id,
          admission_number: regNo,
          date_of_birth: '2012-04-10',
          gender: 'male',
          roll_number: '12',
          father_name: 'Tariq Khan',
          parent_id: context.parent.user.id,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdStudentId = res.body.data.id;
    });

    it('should fail if required fields are missing', async () => {
      const res = await api
        .post('/api/v1/students')
        .set(context.instituteAdmin.headers)
        .send({
          last_name: 'Incomplete',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/students', () => {
    it('should fetch list of students with pagination & filters', async () => {
      const res = await api
        .get(`/api/v1/students?page=1&limit=10&class_id=${context.testClass.id}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/students/search', () => {
    it('should search students by name or registration number', async () => {
      const res = await api
        .get('/api/v1/students/search?q=Ahmed')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/students/:id', () => {
    it('should fetch single student details with profile', async () => {
      const targetId = createdStudentId || context.student.user.id;
      const res = await api
        .get(`/api/v1/students/${targetId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', targetId);
    });
  });

  describe('PUT /api/v1/students/:id', () => {
    it('should update student details', async () => {
      const targetId = createdStudentId || context.student.user.id;
      const res = await api
        .put(`/api/v1/students/${targetId}`)
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Ahmed Updated',
          phone: '+1234567899',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Promotion & Alumni Endpoints', () => {
    it('GET /:id/promotion-eligibility - should check promotion eligibility', async () => {
      const targetId = createdStudentId || context.student.user.id;
      const res = await api
        .get(`/api/v1/students/${targetId}/promotion-eligibility`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /:id/alumni - should mark student as alumni', async () => {
      const targetId = createdStudentId || context.student.user.id;
      const res = await api
        .patch(`/api/v1/students/${targetId}/alumni`)
        .set(context.instituteAdmin.headers)
        .send({
          reason: 'Graduated',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /:id/restore-alumni - should restore student from alumni', async () => {
      const targetId = createdStudentId || context.student.user.id;
      const res = await api
        .patch(`/api/v1/students/${targetId}/restore-alumni`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('POST /:id/behavior - should add a behavioral note/record', async () => {
      const targetId = createdStudentId || context.student.user.id;
      const res = await api
        .post(`/api/v1/students/${targetId}/behavior`)
        .set(context.instituteAdmin.headers)
        .send({
          title: 'Exemplary Attendance',
          description: 'Awarded perfect attendance for the term.',
          type: 'positive',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/students/:id', () => {
    it('should delete student', async () => {
      if (!createdStudentId) return;
      const res = await api
        .delete(`/api/v1/students/${createdStudentId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
