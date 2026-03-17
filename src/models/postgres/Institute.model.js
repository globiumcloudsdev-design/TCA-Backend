/**
 * The Clouds Academy - Institute Model
 * 
 * Institute = School/College/Coaching Center
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Institute = sequelize.define(
    'Institute',
    {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

        // Basic Info
        institute_name: { type: DataTypes.STRING(200), allowNull: false },
        institute_code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        institute_email: { type: DataTypes.STRING, allowNull: false, unique: true },
        institute_contact: { type: DataTypes.STRING(20), allowNull: false },
        institute_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'institute_types', key: 'id' },
            comment: 'School, College, Academy, Coaching, etc.'
        },

        // Address
        institute_address: { type: DataTypes.TEXT, allowNull: false },
        institute_city: { type: DataTypes.STRING(100), allowNull: false },
        institute_country: { type: DataTypes.STRING(100), defaultValue: 'Pakistan' },
        institute_zip_code: { type: DataTypes.STRING(20) },

        // Logo
        institute_logo_url: { type: DataTypes.STRING },
        institute_logo_public_id: { type: DataTypes.STRING },

        // Owner/Principal Info
        principal_name: { type: DataTypes.STRING(200), allowNull: false },
        principal_email: { type: DataTypes.STRING, allowNull: false },
        principal_phone: { type: DataTypes.STRING(20), allowNull: false },
        principal_user_id: {
            type: DataTypes.UUID,
            references: { model: 'users', key: 'id' },
            comment: 'Auto-assigned after user creation'
        },

        // Role & Subscription
        institute_role_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'roles', key: 'id' },
            comment: 'The role assigned to this institute (defines permissions for all users)'
        },

        subscription_plan_id: {
            type: DataTypes.UUID,
            references: { model: 'subscription_plans', key: 'id' },
            comment: 'Current subscription plan'
        },

        // Trial
        trial_days: { type: DataTypes.INTEGER, defaultValue: 30 },
        trial_start_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        trial_end_date: {
            type: DataTypes.DATE,
            defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },

        // Status
        joining_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
        subscription_status: {
            type: DataTypes.ENUM('trial', 'active', 'expired', 'suspended'),
            defaultValue: 'trial',
        },

        // 🔥 NEW FIELD: Track if trial was ever used
        has_used_trial: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Whether this institute has ever used a trial (prevents multiple trials)'
        },

        // Settings
        settings: {
            type: DataTypes.JSONB,
            defaultValue: {
                has_branches: false,
                enable_parent_portal: true,
                enable_teacher_portal: true,
                enable_student_portal: true,
                enable_sms_notifications: false
            }
        },
    },
    {
        tableName: 'institutes',
        indexes: [
            { fields: ['institute_code'], unique: true },
            { fields: ['institute_email'], unique: true },
            { fields: ['institute_type_id'] },
            { fields: ['subscription_status'] },
            { fields: ['has_used_trial'] } // Add index for new field
        ]
    }
);

Institute.associate = (models) => {
    Institute.belongsTo(models.InstituteType, { foreignKey: 'institute_type_id', as: 'type' });
    Institute.belongsTo(models.Role, { foreignKey: 'institute_role_id', as: 'assignedRole' });
    Institute.belongsTo(models.SubscriptionPlan, { foreignKey: 'subscription_plan_id', as: 'plan' });
    Institute.belongsTo(models.User, { foreignKey: 'principal_user_id', as: 'principal' });
    // school_id is the FK column in child tables (renamed to institute_id in JS via field mapping)
    // 🔥 ADD THIS: Institute has many Invoices
  Institute.hasMany(models.Invoice, {
    foreignKey: 'institute_id',
    as: 'invoices',  // This must match the include in your service
    onDelete: 'CASCADE'
  });
  
    Institute.hasMany(models.User, { foreignKey: 'school_id', as: 'users' });
    Institute.hasMany(models.Role, { foreignKey: 'school_id', as: 'roles' });
};

export default Institute;