// backend/src/models/FeeTemplate.model.js (UPDATED WITH BRANCH)

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const FeeTemplate = sequelize.define(
  'FeeTemplate',
  {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true,
      comment: 'Fee template ki unique ID' 
    },

    institute_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Kis institute ka fee template hai'
    },

    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Kis branch ke liye hai (null means all branches)'
    },

    // Basic Info
    name: { 
      type: DataTypes.STRING(200), 
      allowNull: false,
      comment: 'Fee template ka naam e.g. "Class 1 Regular Fee"' 
    },

    code: { 
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Template code for reference e.g. "CLS1-REG-2026"' 
    },

    description: { 
      type: DataTypes.TEXT,
      comment: 'Template ki description' 
    },

    // Fee Basis
    fee_basis: {
      type: DataTypes.ENUM('monthly', 'quarterly', 'half_yearly', 'annually', 'one_time'),
      defaultValue: 'monthly',
      comment: 'Fee kis basis par hai'
    },

    due_day: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      validate: { min: 1, max: 31 },
      comment: 'Har month ki kitni tarikh ko fee due hogi'
    },

    // Late Fine Configuration
    late_fine_config: {
      type: DataTypes.JSONB,
      defaultValue: {
        enabled: false,
        type: 'fixed',
        amount: 0,
        grace_days: 0,
        max_fine: null
      },
      comment: 'Late fine configuration'
    },

    // Total amount (calculated)
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: 'Total amount after all calculations'
    },

    // Applicable to which entities
    applicable_to: {
      type: DataTypes.JSONB,
      defaultValue: {
        all_classes: false,
        class_ids: [],
        section_ids: [],
        student_ids: [],
        all_branches: true,
        branch_ids: []
      },
      comment: 'Kis class/section/student/branch ke liye applicable'
    },

    // Components array
    components: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: `Fee components array with discounts`
    },

    // Calculated totals
    calculated_totals: {
      type: DataTypes.JSONB,
      defaultValue: {
        base_total: 0,
        total_discount: 0,
        final_total: 0,
        component_count: 0,
        discount_components: 0
      },
      comment: 'Calculated totals after all calculations'
    },

    // Discount summary
    discount_summary: {
      type: DataTypes.JSONB,
      defaultValue: {
        total_fixed_discount: 0,
        total_percentage_discount: 0,
        final_discount: 0
      },
      comment: 'Discount ka summary'
    },

    // Academic year
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'academic_years', key: 'id' },
      comment: 'Kis academic year ke liye hai'
    },

    // Status
    is_active: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: true,
      comment: 'Template active hai ya nahi' 
    },

    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Default template hai ya nahi'
    },

    // Audit
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Kis user ne banaya'
    },

    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Kis user ne update kiya'
    }
  },
  {
    tableName: 'fee_templates',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['institute_id'] },
      { fields: ['branch_id'] },
      { fields: ['academic_year_id'] },
      { fields: ['code'], unique: true },
      { fields: ['is_active'] },
      { fields: ['is_default'] },
      { fields: ['components'], using: 'gin' },
      { fields: ['applicable_to'], using: 'gin' }
    ]
  }
);

FeeTemplate.associate = (models) => {
  FeeTemplate.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  FeeTemplate.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
  FeeTemplate.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'academicYear' });
  FeeTemplate.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  FeeTemplate.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updater' });
};

export default FeeTemplate;