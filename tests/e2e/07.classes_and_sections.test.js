import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueCode } from '../helpers/db.helper.js';

describe('E2E: Classes & Sections Module (/api/v1/classes)', () => {
  let context;
  let createdClassId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/classes', () => {
    it('should create a class with nested sections and courses', async () => {
      const className = `Grade ${uniqueCode('').slice(-4)}`;
      const res = await api
        .post('/api/v1/classes')
        .set(context.instituteAdmin.headers)
        .send({
          name: className,
          academic_year_id: context.academicYear.id,
          description: 'Class description for testing',
          sections: JSON.stringify([
            { name: 'A', capacity: 35, room_no: '101' },
            { name: 'B', capacity: 35, room_no: '102' },
          ]),
          courses: JSON.stringify([
            { name: 'Mathematics', code: 'MATH-101' },
            { name: 'Science', code: 'SCI-101' },
          ]),
          is_active: true,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdClassId = res.body.data.id;
    });

    it('should fail if class name is missing', async () => {
      const res = await api
        .post('/api/v1/classes')
        .set(context.instituteAdmin.headers)
        .send({
          academic_year_id: context.academicYear.id,
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/classes', () => {
    it('should return list of classes', async () => {
      const res = await api
        .get('/api/v1/classes')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/classes/options', () => {
    it('should return class options for dropdowns', async () => {
      const res = await api
        .get('/api/v1/classes/options')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/classes/:id', () => {
    it('should return class details by ID', async () => {
      const targetId = createdClassId || context.testClass.id;
      const res = await api
        .get(`/api/v1/classes/${targetId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', targetId);
    });
  });

  describe('PUT /api/v1/classes/:id', () => {
    it('should update class details', async () => {
      const targetId = createdClassId || context.testClass.id;
      const res = await api
        .put(`/api/v1/classes/${targetId}`)
        .set(context.instituteAdmin.headers)
        .send({
          description: 'Updated class description',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('PATCH /api/v1/classes/:id/toggle-status', () => {
    it('should toggle class active status', async () => {
      const targetId = createdClassId || context.testClass.id;
      const res = await api
        .patch(`/api/v1/classes/${targetId}/toggle-status`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/classes/:id', () => {
    it('should delete class', async () => {
      if (!createdClassId) return;
      const res = await api
        .delete(`/api/v1/classes/${createdClassId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
