/**
 * Invoice Model
 * With proper associations for Institute
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Invoice = sequelize.define(
  'Invoice',
  {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    
    institute_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'institutes',  // Table name
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    
    subscription_plan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'subscription_plans',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    
    tax_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    
    status: {
      type: DataTypes.ENUM('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'),
      defaultValue: 'PENDING'
    },
    
    due_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    paid_at: {
      type: DataTypes.DATE
    },
    
    payment_method: {
      type: DataTypes.STRING(50)
    },
    
    payment_reference: {
      type: DataTypes.STRING(100)
    },
    
    period_start: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    period_end: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    billing_cycle: {
      type: DataTypes.ENUM('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'),
      defaultValue: 'MONTHLY'
    },
    
    notes: {
      type: DataTypes.TEXT
    },
    
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    
    created_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true
    }
  },
  {
    tableName: 'invoices',
    timestamps: true,
    underscored: true, // This ensures created_at/updated_at use snake_case
    indexes: [
      { fields: ['institute_id'] },
      { fields: ['invoice_number'], unique: true },
      { fields: ['status'] },
      { fields: ['due_date'] },
      { fields: ['period_start', 'period_end'] }
    ]
  }
);

// 🔥 FIX: Define associations properly
Invoice.associate = (models) => {
  // An Invoice belongs to one Institute
  Invoice.belongsTo(models.Institute, {
    foreignKey: 'institute_id',
    as: 'institute',  // This is important! 'as' defines the alias
    targetKey: 'id'
  });

  // An Invoice belongs to one SubscriptionPlan
  Invoice.belongsTo(models.SubscriptionPlan, {
    foreignKey: 'subscription_plan_id',
    as: 'plan',
    targetKey: 'id'
  });
};

export default Invoice;