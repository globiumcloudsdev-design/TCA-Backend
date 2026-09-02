import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import {
    getSettings,
    updateGeneralSettings,
    updateAcademicSettings,
    updateTimingsSettings,
    updateFinanceSettings,
    updateCommunicationSettings,
    updateAppearanceSettings,
    updateSecuritySettings,
    updateModuleSettings,
    updateFooterSettings,
    bulkUpdateSettings,
    resetSettingsSection,
    uploadSettingsFiles
} from '../../controllers/setting.controller.js';

const router = Router();

// All routes require authentication
router.use(protect);

// Main settings endpoint
router.route('/')
    .get(getSettings);

// Settings mutation requires Admin privileges
router.use(restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_ADMIN'));

// Section-wise updates
router.put('/general', updateGeneralSettings);
router.put('/academic', updateAcademicSettings);
router.put('/timings', updateTimingsSettings);
router.put('/finance', updateFinanceSettings);
router.put('/communication', updateCommunicationSettings);
router.put('/appearance', uploadSettingsFiles, updateAppearanceSettings);
router.put('/security', updateSecuritySettings);
router.put('/modules', updateModuleSettings);
router.put('/footer', updateFooterSettings);

// Bulk update
router.post('/bulk', bulkUpdateSettings);

// Reset section
router.delete('/reset/:section', resetSettingsSection);

export default router;