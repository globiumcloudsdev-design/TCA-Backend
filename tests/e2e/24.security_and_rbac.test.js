import { api } from '../helpers/app.helper.js';
import { setupTestContext } from '../helpers/auth.helper.js';
import { createTestInstitute, createTestBranch, createTestUser } from '../helpers/db.helper.js';

describe('E2E: Security, RBAC & Multi-Tenant Isolation', () => {
  let contextA;
  let contextB;

  beforeAll(async () => {
    contextA = await setupTestContext();

    // Create a separate tenant (Institute B)
    const instituteB = await createTestInstitute();
    const branchB = await createTestBranch(instituteB.id);
    const instAdminB = await createTestUser({
      user_type: 'INSTITUTE_ADMIN',
      school_id: instituteB.id,
      branch_id: branchB.id,
      permissions: ['ALL'],
    });

    contextB = {
      institute: instituteB,
      branch: branchB,
      admin: instAdminB,
    };
  });

  describe('Multi-Tenant Isolation', () => {
    it('Institute Admin from Institute B should NOT be able to access Institute A branch', async () => {
      const { generateTestToken, authHeader } = await import('../helpers/auth.helper.js');
      const tokenB = generateTestToken(contextB.admin.user);
      const headersB = authHeader(tokenB);

      // Attempt to access Institute A's branch
      const res = await api
        .get(`/api/v1/branches/${contextA.branch.id}`)
        .set(headersB);

      // Should return 404 or 403 (branch not found within tenant)
      expect([403, 404]).toContain(res.status);
    });

    it('Institute Admin from Institute B should NOT be able to access Institute A class', async () => {
      const { generateTestToken, authHeader } = await import('../helpers/auth.helper.js');
      const tokenB = generateTestToken(contextB.admin.user);
      const headersB = authHeader(tokenB);

      const res = await api
        .get(`/api/v1/classes/${contextA.testClass.id}`)
        .set(headersB);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('Student should NOT be permitted to create a class (403)', async () => {
      const res = await api
        .post('/api/v1/classes')
        .set(contextA.student.headers)
        .send({
          name: 'Hacked Class',
          academic_year_id: contextA.academicYear.id,
        });

      expect([401, 403]).toContain(res.status);
    });

    it('Teacher should NOT be permitted to access Master Admin routes (403)', async () => {
      const res = await api
        .get('/api/v1/master-admin/institutes')
        .set(contextA.teacher.headers);

      expect(res.status).toBe(403);
    });

    it('Parent should NOT be permitted to modify institute settings (403)', async () => {
      const res = await api
        .put('/api/v1/settings/general')
        .set(contextA.parent.headers)
        .send({
          institute_name: 'Defaced Name',
        });

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('JWT Security & Token Tampering', () => {
    it('should reject request when Authorization header is absent on protected routes (401)', async () => {
      const res = await api.get('/api/v1/classes');
      expect(res.status).toBe(401);
    });

    it('should reject request with tampered JWT signature (401)', async () => {
      const validToken = contextA.instituteAdmin.token;
      const tamperedToken = `${validToken.slice(0, -5)}abcde`;

      const res = await api
        .get('/api/v1/classes')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject non-bearer token format (401)', async () => {
      const res = await api
        .get('/api/v1/classes')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
    });
  });
});
