import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode } from '../helpers/db.helper.js';

describe('E2E: Timetable Module (/api/v1/timetable)', () => {
  let context;
  let createdTimetableId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('GET /api/v1/timetable/entities', () => {
    it('should return entities for dropdown selectors', async () => {
      const res = await api
        .get('/api/v1/timetable/entities')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/timetable/check-conflict', () => {
    it('should check if teacher has scheduling conflict', async () => {
      const res = await api
        .post('/api/v1/timetable/check-conflict')
        .set(context.instituteAdmin.headers)
        .send({
          teacher_id: context.teacher.user.id,
          day: 'monday',
          period_number: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/timetable', () => {
    it('should create a timetable schedule', async () => {
      const ttName = `Weekly Schedule ${uniqueCode('')}`;
      const res = await api
        .post('/api/v1/timetable')
        .set(context.instituteAdmin.headers)
        .send({
          name: ttName,
          academic_year_id: context.academicYear.id,
          entity_type: 'school',
          entity_ids: {
            class_id: context.testClass.id,
            section_id: context.testSection.id,
          },
          period_config: {
            total_periods: 6,
            periods: [
              { number: 1, start_time: '08:00', end_time: '08:45' },
              { number: 2, start_time: '08:45', end_time: '09:30' },
            ],
            breaks: [
              { name: 'Lunch', start_time: '12:00', end_time: '12:45' },
            ],
          },
          slots: [
            {
              day: 'monday',
              period_number: 1,
              subject_name: 'Mathematics',
              teacher_id: context.teacher.user.id,
              room_no: '101',
            },
          ],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdTimetableId = res.body.data.id;
    });
  });

  describe('GET /api/v1/timetable', () => {
    it('should fetch list of timetables', async () => {
      const res = await api
        .get('/api/v1/timetable')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/timetable/busy-teachers', () => {
    it('should fetch busy teachers for given day & period', async () => {
      const res = await api
        .get('/api/v1/timetable/busy-teachers?day=monday&period_number=1')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/timetable/:id', () => {
    it('should return timetable details by ID', async () => {
      if (!createdTimetableId) return;
      const res = await api
        .get(`/api/v1/timetable/${createdTimetableId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PUT /api/v1/timetable/:id', () => {
    it('should update timetable schedule', async () => {
      if (!createdTimetableId) return;
      const res = await api
        .put(`/api/v1/timetable/${createdTimetableId}`)
        .set(context.instituteAdmin.headers)
        .send({
          name: 'Updated Weekly Schedule',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/timetable/:id', () => {
    it('should delete timetable', async () => {
      if (!createdTimetableId) return;
      const res = await api
        .delete(`/api/v1/timetable/${createdTimetableId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
