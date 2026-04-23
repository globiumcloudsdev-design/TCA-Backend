// backend/src/controllers/setting.controller.js
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import * as settingService from '../../services/setting.service.js';
import upload from '../../config/multer.js';

// Middleware for handling file uploads
export const uploadSettingsFiles = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]);

// GET /settings
export const getSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.getSettings(instituteId);
    sendSuccess(res, settings, 'Settings fetched successfully');
});

// PUT /settings/general
export const updateGeneralSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateGeneralSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'General settings updated successfully');
});

// PUT /settings/academic
export const updateAcademicSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateAcademicSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Academic settings updated successfully');
});

// PUT /settings/timings
export const updateTimingsSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateTimingsSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Timings updated successfully');
});

// PUT /settings/finance
export const updateFinanceSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateFinanceSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Finance settings updated successfully');
});

// PUT /settings/communication
export const updateCommunicationSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateCommunicationSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Communication settings updated successfully');
});

// PUT /settings/appearance
export const updateAppearanceSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const logoFile = req.files?.logo?.[0];
    const faviconFile = req.files?.favicon?.[0];
    
    const settings = await settingService.updateAppearanceSettings(
        instituteId,
        req.body,
        req.user.id,
        logoFile,
        faviconFile
    );
    sendSuccess(res, settings, 'Appearance settings updated successfully');
});

// PUT /settings/security
export const updateSecuritySettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateSecuritySettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Security settings updated successfully');
});

// PUT /settings/modules
export const updateModuleSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateModuleSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Module settings updated successfully');
});

// PUT /settings/footer
export const updateFooterSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.updateFooterSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Footer settings updated successfully');
});

// POST /settings/bulk
export const bulkUpdateSettings = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const settings = await settingService.bulkUpdateSettings(
        instituteId,
        req.body,
        req.user.id
    );
    sendSuccess(res, settings, 'Settings updated successfully');
});

// DELETE /settings/reset/:section
export const resetSettingsSection = catchAsync(async (req, res) => {
    const instituteId = req.user.school_id;
    const { section } = req.params;
    const settings = await settingService.resetSettingsSection(
        instituteId,
        section,
        req.user.id
    );
    sendSuccess(res, settings, `${section} settings reset to default`);
});