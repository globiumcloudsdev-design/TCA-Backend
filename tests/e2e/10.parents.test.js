import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { uniqueEmail } from '../helpers/db.helper.js';

describe('E2E: Parent Management Module (/api/v1/parents)', () => {
  let context;
  let createdParentId;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  describe('POST /api/v1/parents', () => {
    it('should create a parent successfully', async () => {
      const res = await api
        .post('/api/v1/parents')
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Muhammad',
          last_name: 'Usman',
          email: uniqueEmail('parent_new'),
          password: 'Password@123',
          phone: '+1234567822',
          occupation: 'Civil Engineer',
          address: 'House 5, Street 10',
          city: 'Islamabad',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      const parentUser = res.body.data.user || res.body.data;
      expect(parentUser).toHaveProperty('id');
      createdParentId = parentUser.id;
    });
  });

  describe('GET /api/v1/parents', () => {
    it('should fetch list of parents', async () => {
      const res = await api
        .get('/api/v1/parents?page=1&limit=10')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/parents/search', () => {
    it('should search parents by query', async () => {
      const res = await api
        .get('/api/v1/parents/search?q=Usman')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/parents/find-students', () => {
    it('should find students matching parent info', async () => {
      const res = await api
        .post('/api/v1/parents/find-students')
        .set(context.instituteAdmin.headers)
        .send({
          phone: context.parent.user.phone || '+1234567890',
          email: context.parent.plainEmail,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/parents/:id', () => {
    it('should return parent by ID', async () => {
      const targetId = createdParentId || context.parent.user.id;
      const res = await api
        .get(`/api/v1/parents/${targetId}`)
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', targetId);
    });
  });

  describe('PUT /api/v1/parents/:id', () => {
    it('should update parent details', async () => {
      const targetId = createdParentId || context.parent.user.id;
      const res = await api
        .put(`/api/v1/parents/${targetId}`)
        .set(context.instituteAdmin.headers)
        .send({
          first_name: 'Muhammad Updated',
          phone: '+1234567833',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/parents/:id', () => {
    it('should delete parent', async () => {
      if (!createdParentId) return;
      const res = await api
        .delete(`/api/v1/parents/${createdParentId}`)
        .set(context.instituteAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });
});
