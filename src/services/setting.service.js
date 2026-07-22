// backend/src/services/setting.service.js (COMPLETE UPDATED)

import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Institute from '../models/postgres/Institute.model.js';
import InstituteSettings from '../models/postgres/InstituteSettings.model.js';
import { AppError } from '../utils/lib/AppError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import fs from 'fs';
import logger from '../config/logger.js';

/**
 * Get or create settings for an institute
 */
const getOrCreateSettings = async (instituteId, transaction = null) => {
    let settings = await InstituteSettings.findOne({
        where: { institute_id: instituteId },
        transaction
    });

    if (!settings) {
        settings = await InstituteSettings.create({
            institute_id: instituteId,
            created_by: null
        }, { transaction });
    }

    return settings;
};

/**
 * Get settings by institute ID
 */
export const getSettings = async (instituteId) => {
    const institute = await Institute.findByPk(instituteId);
    if (!institute) {
        throw new AppError('Institute not found', 404);
    }

    const settings = await getOrCreateSettings(instituteId);
    
    // Merge with institute base data
    const result = {
        ...settings.toJSON(),
        institute: {
            id: institute.id,
            name: institute.institute_name,
            code: institute.institute_code,
            email: institute.institute_email,
            phone: institute.institute_contact,
            logo_url: institute.institute_logo_url,
            logo_public_id: institute.institute_logo_public_id,
            settings: institute.settings
        }
    };

    return result;
};

/**
 * Update general information (including institute name)
 */
export const updateGeneralSettings = async (instituteId, data, userId) => {
    const t = await sequelize.transaction();
    
    try {
        const settings = await getOrCreateSettings(instituteId, t);
        const institute = await Institute.findByPk(instituteId, { transaction: t });

        // Update Institute main table fields
        const instituteUpdates = {};
        
        // 🔥 Update institute name
        if (data.display_name !== undefined && data.display_name !== institute.institute_name) {
            instituteUpdates.institute_name = data.display_name;
            logger.info(`🏫 Updating institute name from "${institute.institute_name}" to "${data.display_name}"`);
        }
        
        if (data.email !== undefined && data.email !== institute.institute_email) {
            instituteUpdates.institute_email = data.email;
        }
        
        if (data.phone !== undefined && data.phone !== institute.institute_contact) {
            instituteUpdates.institute_contact = data.phone;
        }
        
        if (data.address !== undefined && data.address !== institute.institute_address) {
            instituteUpdates.institute_address = data.address;
        }
        
        if (data.city !== undefined && data.city !== institute.institute_city) {
            instituteUpdates.institute_city = data.city;
        }
        
        if (data.country !== undefined && data.country !== institute.institute_country) {
            instituteUpdates.institute_country = data.country;
        }

        if (Object.keys(instituteUpdates).length > 0) {
            await institute.update(instituteUpdates, { transaction: t });
            logger.info(`✅ Institute updated: ${Object.keys(instituteUpdates).join(', ')}`);
        }

        // Update Settings table
        const settingsUpdates = {};
        if (data.display_name !== undefined) settingsUpdates.display_name = data.display_name;
        if (data.tagline !== undefined) settingsUpdates.tagline = data.tagline;
        if (data.description !== undefined) settingsUpdates.description = data.description;
        
        // Contact info
        if (data.contact_email !== undefined) settingsUpdates.contact_email = data.contact_email;
        if (data.contact_phone !== undefined) settingsUpdates.contact_phone = data.contact_phone;
        if (data.alternate_phone !== undefined) settingsUpdates.alternate_phone = data.alternate_phone;
        if (data.whatsapp_number !== undefined) settingsUpdates.whatsapp_number = data.whatsapp_number;
        
        // Social media
        if (data.facebook_url !== undefined) settingsUpdates.facebook_url = data.facebook_url;
        if (data.instagram_url !== undefined) settingsUpdates.instagram_url = data.instagram_url;
        if (data.twitter_url !== undefined) settingsUpdates.twitter_url = data.twitter_url;
        if (data.linkedin_url !== undefined) settingsUpdates.linkedin_url = data.linkedin_url;
        if (data.youtube_url !== undefined) settingsUpdates.youtube_url = data.youtube_url;
        
        // Address
        if (data.address_line1 !== undefined) settingsUpdates.address_line1 = data.address_line1;
        if (data.address_line2 !== undefined) settingsUpdates.address_line2 = data.address_line2;
        if (data.city !== undefined) settingsUpdates.city = data.city;
        if (data.state !== undefined) settingsUpdates.state = data.state;
        if (data.country !== undefined) settingsUpdates.country = data.country;
        if (data.postal_code !== undefined) settingsUpdates.postal_code = data.postal_code;
        if (data.latitude !== undefined) settingsUpdates.latitude = data.latitude;
        if (data.longitude !== undefined) settingsUpdates.longitude = data.longitude;

        settingsUpdates.updated_by = userId;
        settingsUpdates.last_sync_at = new Date();

        await settings.update(settingsUpdates, { transaction: t });

        await t.commit();

        // Return updated settings with fresh institute data
        const updatedResult = await getSettings(instituteId);
        return updatedResult;
    } catch (error) {
        await t.rollback();
        logger.error('Error updating general settings:', error);
        throw error;
    }
};

/**
 * Update appearance settings with logo upload (with proper delete of old logo)
 */
export const updateAppearanceSettings = async (instituteId, data, userId, logoFile = null, faviconFile = null) => {
    const t = await sequelize.transaction();
    let logoUrl = null;
    let logoPublicId = null;
    let faviconUrl = null;
    let faviconPublicId = null;
    let oldLogoPublicId = null;
    let oldFaviconPublicId = null;

    try {
        const settings = await getOrCreateSettings(instituteId, t);
        const institute = await Institute.findByPk(instituteId, { transaction: t });

        // 🔥 Store old public IDs for deletion
        oldLogoPublicId = institute.institute_logo_public_id;
        oldFaviconPublicId = settings.appearance?.favicon_public_id;

        // Handle logo upload
        if (logoFile) {
            logger.info(`🖼️ Uploading new logo for institute ${instituteId}`);
            
            // Upload new logo
            const result = await uploadToCloudinary(logoFile.path, `the-clouds-academy/${instituteId}/logos`, {
                transformation: [{ width: 200, height: 200, crop: 'limit' }, { quality: 'auto' }]
            });
            
            logoUrl = result.url;
            logoPublicId = result.public_id;
            
            // Update institute with new logo
            await institute.update({
                institute_logo_url: logoUrl,
                institute_logo_public_id: logoPublicId
            }, { transaction: t });
            
            // 🔥 Delete old logo from Cloudinary (after successful upload)
            if (oldLogoPublicId) {
                logger.info(`🗑️ Deleting old logo: ${oldLogoPublicId}`);
                await deleteFromCloudinary(oldLogoPublicId, 'image').catch(err => {
                    logger.error('Failed to delete old logo:', err);
                });
            }
            
            // Clean up temp file
            fs.unlink(logoFile.path, (err) => {
                if (err) logger.error('Error deleting temp logo file:', err);
            });
        }

        // Handle favicon upload
        if (faviconFile) {
            logger.info(`🖼️ Uploading new favicon for institute ${instituteId}`);
            
            const result = await uploadToCloudinary(faviconFile.path, `the-clouds-academy/${instituteId}/favicons`, {
                transformation: [{ width: 64, height: 64, crop: 'limit' }]
            });
            
            faviconUrl = result.url;
            faviconPublicId = result.public_id;
            
            // 🔥 Delete old favicon from Cloudinary
            if (oldFaviconPublicId) {
                logger.info(`🗑️ Deleting old favicon: ${oldFaviconPublicId}`);
                await deleteFromCloudinary(oldFaviconPublicId, 'image').catch(err => {
                    logger.error('Failed to delete old favicon:', err);
                });
            }
            
            fs.unlink(faviconFile.path, (err) => {
                if (err) logger.error('Error deleting temp favicon file:', err);
            });
        }

        // Update appearance settings in InstituteSettings table
        const currentAppearance = settings.appearance || {};
        const updatedAppearance = {
            ...currentAppearance,
            ...data,
            logo_url: logoUrl || currentAppearance.logo_url,
            logo_public_id: logoPublicId || currentAppearance.logo_public_id,
            favicon_url: faviconUrl || currentAppearance.favicon_url,
            favicon_public_id: faviconPublicId || currentAppearance.favicon_public_id
        };

        await settings.update({
            appearance: updatedAppearance,
            updated_by: userId,
            last_sync_at: new Date()
        }, { transaction: t });

        await t.commit();

        logger.info(`✅ Appearance settings updated for institute ${instituteId}`);
        
        // Return updated settings
        const updatedResult = await getSettings(instituteId);
        return updatedResult;
    } catch (error) {
        await t.rollback();
        logger.error('Error updating appearance settings:', error);
        
        // Clean up temp files on error
        if (logoFile?.path) fs.unlink(logoFile.path, () => {});
        if (faviconFile?.path) fs.unlink(faviconFile.path, () => {});
        
        throw error;
    }
};

// ... rest of the service functions (updateAcademicSettings, updateTimingsSettings, etc.)
// Keep all other functions as they are from your existing code

export const updateAcademicSettings = async (instituteId, data, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const currentAcademic = settings.academic || {};
    const updatedAcademic = { ...currentAcademic, ...data };
    await settings.update({
        academic: updatedAcademic,
        updated_by: userId,
        last_sync_at: new Date()
    });
    return await getSettings(instituteId);
};

export const updateTimingsSettings = async (instituteId, data, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const currentTimings = settings.timings || {};
    const updatedTimings = { ...currentTimings, ...data };
    await settings.update({
        timings: updatedTimings,
        updated_by: userId,
        last_sync_at: new Date()
    });
    return await getSettings(instituteId);
};

export const updateFinanceSettings = async (instituteId, data, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const currentFinance = settings.finance || {};
    const updatedFinance = { ...currentFinance, ...data };
    await settings.update({
        finance: updatedFinance,
        updated_by: userId,
        last_sync_at: new Date()
    });
    return await getSettings(instituteId);
};

export const updateCommunicationSettings = async (instituteId, data, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const currentComm = settings.communication || {};
    const updatedComm = { ...currentComm, ...data };
    await settings.update({
        communication: updatedComm,
        updated_by: userId,
        last_sync_at: new Date()
    });
    return await getSettings(instituteId);
};

export const updateSecuritySettings = async (instituteId, data, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const currentSecurity = settings.security || {};
    const updatedSecurity = { ...currentSecurity, ...data };
    await settings.update({
        security: updatedSecurity,
        updated_by: userId,
        last_sync_at: new Date()
    });
    return await getSettings(instituteId);
};

export const updateModuleSettings = async (instituteId, data, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const currentModules = settings.modules || {};
    const updatedModules = { ...currentModules, ...data };
    await settings.update({
        modules: updatedModules,
        updated_by: userId,
        last_sync_at: new Date()
    });
    return await getSettings(instituteId);
};

export const updateFooterSettings = async (instituteId, data, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const currentFooter = settings.footer || {};
    const updatedFooter = { ...currentFooter, ...data };
    await settings.update({
        footer: updatedFooter,
        updated_by: userId,
        last_sync_at: new Date()
    });
    return await getSettings(instituteId);
};

export const bulkUpdateSettings = async (instituteId, updates, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    const institute = await Institute.findByPk(instituteId);
    const allowedSections = ['academic', 'timings', 'finance', 'communication', 'appearance', 'security', 'modules', 'footer'];
    const updateData = {};
    const instituteUpdates = {};

    for (const [section, value] of Object.entries(updates)) {
        if (section === 'general') {
            if (value.display_name) instituteUpdates.institute_name = value.display_name;
            if (value.email) instituteUpdates.institute_email = value.email;
            if (value.phone) instituteUpdates.institute_contact = value.phone;
            if (value.address) instituteUpdates.institute_address = value.address;
            if (value.city) instituteUpdates.institute_city = value.city;
            if (value.country) instituteUpdates.institute_country = value.country;
            if (value.tagline) updateData.tagline = value.tagline;
            if (value.description) updateData.description = value.description;
            if (value.contact_email) updateData.contact_email = value.contact_email;
            if (value.contact_phone) updateData.contact_phone = value.contact_phone;
        } else if (allowedSections.includes(section)) {
            const current = settings[section] || {};
            updateData[section] = { ...current, ...value };
        }
    }

    if (Object.keys(instituteUpdates).length > 0) {
        await institute.update(instituteUpdates);
    }

    updateData.updated_by = userId;
    updateData.last_sync_at = new Date();
    await settings.update(updateData);
    return await getSettings(instituteId);
};

export const resetSettingsSection = async (instituteId, section, userId) => {
    const settings = await getOrCreateSettings(instituteId);
    
    const defaultValues = {
        academic: {
            session_start_month: 'April',
            session_end_month: 'March',
            grading_system: 'percentage',
            gpa_scale: 4.0,
            passing_percentage: 33,
            default_language: 'en',
            timezone: 'Asia/Karachi',
            week_start_day: 'Monday',
            class_duration_minutes: 45,
            break_duration_minutes: 10
        },
        timings: {
            working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            start_time: '08:00',
            end_time: '14:00',
            friday_start_time: '08:00',
            friday_end_time: '12:30',
            breaks: [
                { name: 'Morning Break', start: '10:00', end: '10:15', enabled: true },
                { name: 'Lunch Break', start: '12:00', end: '12:45', enabled: true }
            ],
            attendance_start_time: '07:30',
            attendance_end_time: '09:00',
            weekly_off_days: ['saturday', 'sunday']
        },
        finance: {
            currency: 'PKR',
            currency_symbol: '₨',
            tax_rate: 0,
            late_fee_percentage: 5,
            receipt_prefix: 'INV',
            payment_terms_days: 30
        },
        communication: {
            welcome_email_enabled: true,
            attendance_alerts_enabled: true,
            fee_reminders_enabled: true,
            exam_notifications_enabled: true,
            parent_portal_access: true
        },
        appearance: {
            primary_color: '#10b981',
            secondary_color: '#3b82f6',
            accent_color: '#f59e0b',
            font_family: 'Inter'
        },
        security: {
            password_expiry_days: 90,
            session_timeout_minutes: 30,
            max_login_attempts: 5,
            force_strong_password: true
        },
        modules: {
            attendance: { enabled: true, required: true },
            exams: { enabled: true, required: false },
            assignments: { enabled: true, required: false },
            fees: { enabled: true, required: false }
        },
        footer: {
            invoice_footer_text: 'Thank you for your payment'
        }
    };

    if (!defaultValues[section]) {
        throw new AppError(`Invalid section: ${section}`, 400);
    }

    const updateData = {
        [section]: defaultValues[section],
        updated_by: userId,
        last_sync_at: new Date()
    };

    await settings.update(updateData);
    return await getSettings(instituteId);
};