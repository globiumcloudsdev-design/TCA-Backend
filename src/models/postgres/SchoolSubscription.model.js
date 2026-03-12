/**
 * The Clouds Academy - SchoolSubscription Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const SchoolSubscription = sequelize.define(
  'SchoolSubscription',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    plan_id: { type: DataTypes.UUID, references: { model: 'subscription_plans', key: 'id' } },
    status: {
      type: DataTypes.ENUM('trial', 'active', 'expired', 'cancelled', 'suspended'),
      defaultValue: 'trial',
    },
    billing_cycle: { type: DataTypes.ENUM('monthly', 'yearly'), defaultValue: 'monthly' },
    starts_at: { type: DataTypes.DATE },
    ends_at: { type: DataTypes.DATE },
    auto_renew: { type: DataTypes.BOOLEAN, defaultValue: true },
    amount_paid: { type: DataTypes.DECIMAL(10, 2) },
    payment_method: { type: DataTypes.STRING(50) },
    stripe_subscription_id: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
  },
  { tableName: 'school_subscriptions' }
);

SchoolSubscription.associate = (models) => {
  SchoolSubscription.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  SchoolSubscription.belongsTo(models.SubscriptionPlan, { foreignKey: 'plan_id' });
  // Unified invoicing uses subscription_plan_id on Invoice directly or matches via institute
};

export default SchoolSubscription;
