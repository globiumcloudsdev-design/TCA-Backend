// src/models/postgres/Vendor.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Vendor = sequelize.define('Vendor', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    institute_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'institutes',
            key: 'id',
        },
    },
    branch_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'branches',
            key: 'id',
        },
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'books, uniform, transport, canteen, it, etc',
    },
    phone: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            isEmail: true,
        },
    },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    assigned_student_ids: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Array of student IDs assigned to this vendor (e.g., for transport)',
    },
    cnic: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    bank_account: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: '{ bank_name, account_title, account_number, iban }',
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_login_at: { type: DataTypes.DATE },
    password_reset_token: { type: DataTypes.STRING },
    password_reset_expires: { type: DataTypes.DATE },
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },

    avatar_url: { type: DataTypes.STRING },
    avatar_public_id: { type: DataTypes.STRING },
    qr_code_url: { type: DataTypes.STRING, comment: 'URL to generated QR code' },
    qr_code_public_id: { type: DataTypes.STRING, comment: 'Cloudinary public ID for QR code' },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
}, {
    tableName: 'vendors',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['institute_id'] },
        { fields: ['branch_id'] },
        { fields: ['type'] },
        { fields: ['status'] },
        { fields: ['institute_id', 'branch_id'] },
    ],
});

Vendor.associate = (models) => {
    Vendor.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
    Vendor.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
    Vendor.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    Vendor.hasMany(models.Expense, { foreignKey: 'vendor_id', as: 'expenses' });
};

export default Vendor;