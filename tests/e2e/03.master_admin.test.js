import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { createTestInstitute, uniqueCode, uniqueEmail, getOrCreateInstituteType, getOrCreateTemplateRole } from '../helpers/db.helper.js';

describe('E2E: Master Admin Module (/api/v1/master-admin)', () => {
  let context;
  let testInst;

  beforeAll(async () => {
    context = await setupTestContext();
    testInst = await createTestInstitute();
  });

  describe('RBAC Guards', () => {
    it('should forbid regular institute admin from accessing master-admin routes (403)', async () => {
      const res = await api
        .get('/api/v1/master-admin/institutes')
        .set(context.instituteAdmin.headers);

      expect(res.status).toBe(403);
    });

    it('should forbid student from accessing master-admin routes (403)', async () => {
      const res = await api
        .get('/api/v1/master-admin/institutes')
        .set(context.student.headers);

      expect(res.status).toBe(403);
    });
  });

  describe('Lookup & Metadata Endpoints', () => {
    it('GET /institute-types - should return list of active institute types', async () => {
      const res = await api
        .get('/api/v1/master-admin/institute-types')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /platform-roles - should return list of template platform roles', async () => {
      const res = await api
        .get('/api/v1/master-admin/platform-roles')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /roles/permissions - should return permission catalog', async () => {
      const res = await api
        .get('/api/v1/master-admin/roles/permissions')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /subscription-plans - should return platform subscription plans', async () => {
      const res = await api
        .get('/api/v1/master-admin/subscription-plans')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Institute Management (CRUD)', () => {
    let createdInstituteId;

    it('POST /institutes - should create a new institute with principal info', async () => {
      const instType = await getOrCreateInstituteType();
      const instRole = await getOrCreateTemplateRole();
      const code = uniqueCode('MA');

      const res = await api
        .post('/api/v1/master-admin/institutes')
        .set(context.masterAdmin.headers)
        .send({
          institute_name: `Master Admin Test Institute ${code}`,
          institute_code: code,
          institute_email: uniqueEmail('inst_ma'),
          institute_contact: '+1234567890',
          institute_type_id: instType.id,
          institute_address: '789 Central Ave',
          institute_city: 'Lahore',
          institute_country: 'Pakistan',
          principal_name: 'Dr. Jane Smith',
          principal_email: uniqueEmail('princ_ma'),
          principal_phone: '+1234567892',
          institute_role_id: instRole.id,
          settings: { has_branches: false },
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      createdInstituteId = res.body.data.id;
    });

    it('GET /institutes - should fetch paginated list of institutes', async () => {
      const res = await api
        .get('/api/v1/master-admin/institutes?page=1&limit=10')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data.rows || res.body.data)).toBe(true);
    });

    it('GET /institutes/:id - should fetch institute details by ID', async () => {
      const res = await api
        .get(`/api/v1/master-admin/institutes/${createdInstituteId || testInst.id}`)
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
    });

    it('PUT /institutes/:id - should update institute details', async () => {
      const targetId = createdInstituteId || testInst.id;
      const res = await api
        .put(`/api/v1/master-admin/institutes/${targetId}`)
        .set(context.masterAdmin.headers)
        .send({
          institute_name: 'Updated Institute Name',
          institute_city: 'Karachi',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /institutes/:id/status - should toggle institute active status', async () => {
      const targetId = createdInstituteId || testInst.id;
      const res = await api
        .patch(`/api/v1/master-admin/institutes/${targetId}/status`)
        .set(context.masterAdmin.headers)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('PATCH /institutes/:id/subscription-status - should update subscription status', async () => {
      const targetId = createdInstituteId || testInst.id;
      const res = await api
        .patch(`/api/v1/master-admin/institutes/${targetId}/subscription-status`)
        .set(context.masterAdmin.headers)
        .send({ subscription_status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /institutes/:id/dashboard-stats - should return institute stats', async () => {
      const targetId = createdInstituteId || testInst.id;
      const res = await api
        .get(`/api/v1/master-admin/institutes/${targetId}/dashboard-stats`)
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /institutes/:id/storage - should return institute storage information', async () => {
      const targetId = createdInstituteId || testInst.id;
      const res = await api
        .get(`/api/v1/master-admin/institutes/${targetId}/storage`)
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('DELETE /institutes/:id - should soft-delete institute', async () => {
      if (!createdInstituteId) return;
      const res = await api
        .delete(`/api/v1/master-admin/institutes/${createdInstituteId}`)
        .set(context.masterAdmin.headers);

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('Invoices, Reports & System Controls', () => {
    it('GET /reports - should return aggregated platform reports', async () => {
      const res = await api
        .get('/api/v1/master-admin/reports')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /invoices - should fetch all platform invoices', async () => {
      const res = await api
        .get('/api/v1/master-admin/invoices')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /settings - should return platform global settings', async () => {
      const res = await api
        .get('/api/v1/master-admin/settings')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('GET /system-health - should return system health diagnostics', async () => {
      const res = await api
        .get('/api/v1/master-admin/system-health')
        .set(context.masterAdmin.headers);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
