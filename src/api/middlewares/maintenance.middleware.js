import { sendError } from '../../utils/helpers/response.helper.js';
import models from '../../models/postgres/index.js';

const { GlobalSetting } = models;

/**
 * Maintenance Guard Middleware
 * Checks if the system or a specific feature is under maintenance.
 * Master Admins are always bypassed.
 */
export const maintenanceGuard = async (req, res, next) => {
  try {
    // 0. Bypass for Auth Routes (Login must always work)
    if (req.originalUrl.includes('/auth/')) {
      return next();
    }

    // 1. Bypass for Master Admin & Support Staff
    const adminTypes = ['MASTER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'];
    if (req.user && (adminTypes.includes(req.user.user_type) || adminTypes.includes(req.user.role_code))) {
      return next();
    }

    // 2. Fetch Global Settings
    const [maintenanceMode, featureOverrides] = await Promise.all([
      GlobalSetting.findByPk('maintenance_mode'),
      GlobalSetting.findByPk('feature_overrides')
    ]);

    // 3. Check Full System Maintenance
    if (maintenanceMode && maintenanceMode.value.enabled) {
      return res.status(503).json({
        success: false,
        status: 503,
        message: maintenanceMode.value.message || 'System is under maintenance. Please try again later.',
        type: 'SYSTEM_MAINTENANCE'
      });
    }

    // 4. Check Feature Specific Maintenance
    if (featureOverrides && featureOverrides.value) {
      const overrides = featureOverrides.value;
      const path = req.originalUrl;

      // Map paths to feature IDs (simplified mapping)
      const pathFeatureMap = [
        { pattern: /^\/api\/v1\/academic-years/, feature: 'academic_years' },
        { pattern: /^\/api\/v1\/classes/, feature: 'classes' },
        { pattern: /^\/api\/v1\/students/, feature: 'students' },
        { pattern: /^\/api\/v1\/teachers/, feature: 'teachers' },
        { pattern: /^\/api\/v1\/attendance/, feature: 'attendance' },
        { pattern: /^\/api\/v1\/fees/, feature: 'fees_voucher' },
        { pattern: /^\/api\/v1\/exams/, feature: 'exams' },
        { pattern: /^\/api\/v1\/payroll/, feature: 'payroll' },
        { pattern: /^\/api\/v1\/expense/, feature: 'expense' },
        { pattern: /^\/api\/v1\/notices/, feature: 'notifications' },
      ];

      for (const item of pathFeatureMap) {
        if (item.pattern.test(path)) {
          const featureStatus = overrides[item.feature];
          if (featureStatus && featureStatus.enabled === false) {
            return res.status(503).json({
              success: false,
              status: 503,
              message: featureStatus.message || `The ${item.feature.replace('_', ' ')} module is currently under maintenance.`,
              type: 'FEATURE_MAINTENANCE'
            });
          }
        }
      }
    }
    
    next();
  } catch (error) {
    // If settings fail to load, we proceed but log error
    console.error('Maintenance Guard Error:', error);
    next();
  }
};
