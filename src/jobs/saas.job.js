/**
 * The Clouds Academy - SaaS Background Jobs
 * Handles Trial Expiration and Monthly Invoice Generation
 */

import { checkAndGenerateInvoice } from '../services/institute.service.js';
import logger from '../config/logger.js';
import models from '../models/postgres/index.js';
import { Op } from 'sequelize';

const { Institute, SubscriptionPlan } = models;

/**
 * Job: Process Trial Expirations and Monthly Invoices
 */
export const runSaaSJob = async () => {
    try {
        const today = new Date();
        logger.info(`🚀 Starting Daily SaaS Job: ${today.toDateString()}`);

        // 1. Handle Trial Expirations
        const expiredTrials = await Institute.findAll({
            where: {
                subscription_status: 'trial',
                trial_end_date: { [Op.lte]: today }
            }
        });

        for (const inst of expiredTrials) {
            await inst.update({ subscription_status: 'expired' });
            logger.info(`⚠️ Trial expired for institute: ${inst.institute_code}`);
        }

        // 2. Handle Monthly Invoices for Active Institutes
        const activeInstitutes = await Institute.findAll({
            where: {
                is_active: true,
                subscription_status: 'active'
            }
        });

        let invoiceCount = 0;
        for (const inst of activeInstitutes) {
            const result = await checkAndGenerateInvoice(inst);
            if (result) invoiceCount++;
        }

        logger.info(`✅ SaaS Job Completed. Invoices generated: ${invoiceCount}`);
    } catch (err) {
        logger.error('❌ SaaS Job failed:', err);
    }
};
