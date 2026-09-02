import { v4 as uuidv4 } from 'uuid';
import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode } from '../helpers/db.helper.js';

describe('E2E: Exam & Results Module (/api/v1/exams)', () => {
  let context;
  let createdExamId;
  let subjectId;

  beforeAll(async () => {
    context = await setupTestContext();
    subjectId = uuidv4();
  });

  describe('Exam Creation & Management', () => {
    it('POST /api/v1/exams - should create a new exam/term', async () => {
      const examName = `Midterm Exam ${uniqueCode('')}`;
      const res = await api
        .post('/api/v1/exams')
        .set(context.instituteAdmin.headers)
        .send({
          name: examName,
          academic_year_id: context.academicYear.id,
          class_id: context.testClass.id,
          type: 'mid_term',
          exam_type: 'mid_term',
          pass_percentage: 40,
          subject_schedules: [
            {
              subject_id: subjectId,
              subject_name: 'Mathematics',
              date: '2026-04-02',
              start_time: '09:00',
              end_time: '12:00',
              total_marks: 100,
              pass_marks: 40,
            },
          ],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdExamId = res.body.data.id;
    });

    it('GET /api/v1/exams - should fetch all exams', async () => {
      const res = await api
        .get('/api/v1/exams')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/exams/options - should fetch exam options for dropdowns', async () => {
      const res = await api
        .get('/api/v1/exams/options')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/exams/:id - should get exam details by ID', async () => {
      if (!createdExamId) return;
      const res = await api
        .get(`/api/v1/exams/${createdExamId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PUT /api/v1/exams/:id - should update exam details', async () => {
      if (!createdExamId) return;
      const res = await api
        .put(`/api/v1/exams/${createdExamId}`)
        .set(context.instituteAdmin.headers)
        .send({
          description: 'Updated exam schedule description',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('Exam Results Management', () => {
    it('POST /api/v1/exams/:id/results - should enter student marks', async () => {
      if (!createdExamId) return;
      const res = await api
        .post(`/api/v1/exams/${createdExamId}/results`)
        .set(context.instituteAdmin.headers)
        .send({
          results: [
            {
              student_id: context.student.user.id,
              is_present: true,
              subject_marks: [
                {
                  subject_id: subjectId,
                  marks_obtained: 85,
                },
              ],
            },
          ],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/exams/:id/results - should fetch results for exam', async () => {
      if (!createdExamId) return;
      const res = await api
        .get(`/api/v1/exams/${createdExamId}/results`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/exams/:id/analytics - should return exam performance analytics', async () => {
      if (!createdExamId) return;
      const res = await api
        .get(`/api/v1/exams/${createdExamId}/analytics`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /api/v1/exams/:id/grade-sheet - should return class grade sheet', async () => {
      if (!createdExamId) return;
      const res = await api
        .get(`/api/v1/exams/${createdExamId}/grade-sheet?student_id=${context.student.user.id}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('POST /api/v1/exams/:id/publish-results - should publish exam results', async () => {
      if (!createdExamId) return;
      const res = await api
        .post(`/api/v1/exams/${createdExamId}/publish-results`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
