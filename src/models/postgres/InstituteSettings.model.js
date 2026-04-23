// backend/src/models/postgres/InstituteSettings.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

/**
 * Institute Settings Model
 * Stores all configurable settings for an institute
 * One-to-one relationship with Institute
 */
const InstituteSettings = sequelize.define(
    'InstituteSettings',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        institute_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'institutes',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },

        // ─── Basic Information (overrides Institute table for editable fields) ───
        display_name: {
            type: DataTypes.STRING(200),
            allowNull: true,
            comment: 'Display name (can be different from legal name)'
        },
        tagline: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Institute motto or tagline'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Detailed description of the institute'
        },

        // ─── Contact Information ────────────────────────────────────────────────
        contact_email: {
            type: DataTypes.STRING,
            allowNull: true
        },
        contact_phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        alternate_phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        whatsapp_number: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        facebook_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        instagram_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        twitter_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        linkedin_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        youtube_url: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // ─── Address (separate from institute table) ────────────────────────────
        address_line1: { type: DataTypes.STRING(255), allowNull: true },
        address_line2: { type: DataTypes.STRING(255), allowNull: true },
        city: { type: DataTypes.STRING(100), allowNull: true },
        state: { type: DataTypes.STRING(100), allowNull: true },
        country: { type: DataTypes.STRING(100), defaultValue: 'Pakistan' },
        postal_code: { type: DataTypes.STRING(20), allowNull: true },
        latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
        longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: true },

        // ─── Academic Settings ──────────────────────────────────────────────────
        academic: {
            type: DataTypes.JSONB,
            defaultValue: {
                session_start_month: 'April',
                session_end_month: 'March',
                academic_year_start: null,
                academic_year_end: null,
                grading_system: 'percentage', // percentage, gpa, letter
                gpa_scale: 4.0,
                passing_percentage: 33,
                default_language: 'en',
                timezone: 'Asia/Karachi',
                week_start_day: 'Monday',
                class_duration_minutes: 45,
                break_duration_minutes: 10,
                exam_type_default: 'quarterly'
            }
        },

        // ─── Timings / Schedule Settings ────────────────────────────────────────
        timings: {
            type: DataTypes.JSONB,
            defaultValue: {
                // Regular working hours
                working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                start_time: '08:00',
                end_time: '14:00',
                friday_start_time: '08:00',
                friday_end_time: '12:30',
                
                // Break timings
                breaks: [
                    { name: 'Morning Break', start: '10:00', end: '10:15', enabled: true },
                    { name: 'Lunch Break', start: '12:00', end: '12:45', enabled: true },
                    { name: 'Afternoon Break', start: null, end: null, enabled: false }
                ],
                
                // Attendance windows
                attendance_start_time: '07:30',
                attendance_end_time: '09:00',
                late_attendance_grace_minutes: 10,
                
                // Holiday schedule
                holidays: [],
                weekly_off_days: ['saturday', 'sunday']
            }
        },

        // ─── Fee & Finance Settings ─────────────────────────────────────────────
        finance: {
            type: DataTypes.JSONB,
            defaultValue: {
                currency: 'PKR',
                currency_symbol: '₨',
                tax_rate: 0,
                late_fee_percentage: 5,
                late_fee_days_after_due: 15,
                discount_auto_apply: true,
                receipt_prefix: 'INV',
                payment_terms_days: 30,
                enable_online_payment: false,
                online_payment_gateway: null, // stripe, jazzcash, easypaisa
                bank_account_details: {
                    bank_name: '',
                    account_title: '',
                    account_number: '',
                    iban: ''
                }
            }
        },

        // ─── Communication Settings ─────────────────────────────────────────────
        communication: {
            type: DataTypes.JSONB,
            defaultValue: {
                welcome_email_enabled: true,
                welcome_sms_enabled: false,
                attendance_alerts_enabled: true,
                fee_reminders_enabled: true,
                exam_notifications_enabled: true,
                result_published_alerts: true,
                event_notifications: true,
                parent_portal_access: true,
                student_portal_access: true,
                teacher_portal_access: true,
                sms_gateway: null,
                email_signature: '',
                notification_frequency: 'daily' // instant, daily, weekly
            }
        },

        // ─── Appearance / Branding Settings ─────────────────────────────────────
        appearance: {
            type: DataTypes.JSONB,
            defaultValue: {
                primary_color: '#10b981',
                secondary_color: '#3b82f6',
                accent_color: '#f59e0b',
                font_family: 'Inter',
                logo_url: '',
                logo_public_id: '',
                favicon_url: '',
                favicon_public_id: '',
                login_bg_url: '',
                portal_title: '',
                custom_css: '',
                custom_js: ''
            }
        },

        // ─── Security Settings ──────────────────────────────────────────────────
        security: {
            type: DataTypes.JSONB,
            defaultValue: {
                two_factor_auth: false,
                password_expiry_days: 90,
                session_timeout_minutes: 30,
                max_login_attempts: 5,
                ip_whitelist: [],
                allowed_domains: [],
                force_strong_password: true,
                mfa_required_for_admins: false
            }
        },

        // ─── Module Toggles ─────────────────────────────────────────────────────
        modules: {
            type: DataTypes.JSONB,
            defaultValue: {
                attendance: { enabled: true, required: true },
                exams: { enabled: true, required: false },
                assignments: { enabled: true, required: false },
                fees: { enabled: true, required: false },
                library: { enabled: false, required: false },
                transport: { enabled: false, required: false },
                hostel: { enabled: false, required: false },
                canteen: { enabled: false, required: false },
                events: { enabled: true, required: false },
                notices: { enabled: true, required: false }
            }
        },

        // ─── Footer / Invoice Settings ──────────────────────────────────────────
        footer: {
            type: DataTypes.JSONB,
            defaultValue: {
                invoice_footer_text: 'Thank you for your payment',
                certificate_footer_text: '',
                report_card_header: '',
                report_card_footer: '',
                terms_and_conditions: ''
            }
        },

        // ─── Metadata ───────────────────────────────────────────────────────────
        created_by: { type: DataTypes.UUID, allowNull: true },
        updated_by: { type: DataTypes.UUID, allowNull: true },
        last_sync_at: { type: DataTypes.DATE, allowNull: true }
    },
    {
        tableName: 'institute_settings',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { fields: ['institute_id'], unique: true }
        ]
    }
);

// Association
InstituteSettings.associate = (models) => {
    InstituteSettings.belongsTo(models.Institute, {
        foreignKey: 'institute_id',
        as: 'institute'
    });
    InstituteSettings.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
    });
    InstituteSettings.belongsTo(models.User, {
        foreignKey: 'updated_by',
        as: 'updater'
    });
};

export default InstituteSettings;