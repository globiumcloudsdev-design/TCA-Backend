
/**
 * The Clouds Academy - SubscriptionPlan Model
 * 
 * Updated with:
 * - Plan Cycle (Monthly/Yearly/Quarterly)
 * - Plan Limits (Branches, Students, Teachers, Staff)
 * - Popular flag
 * - Branch-wise user limits support
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const SubscriptionPlan = sequelize.define(
  'SubscriptionPlan',
  {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    
    // Basic Info
    name: { 
      type: DataTypes.STRING(100), 
      allowNull: false,
      comment: 'Plan Name: Basic, Standard, Premium, Enterprise' 
    },
    
    code: { 
      type: DataTypes.STRING(50), 
      unique: true,
      allowNull: false,
      comment: 'Unique plan code: BASIC, STANDARD, PREMIUM, ENTERPRISE' 
    },
    
    description: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Plan description and key features summary' 
    },
    
    // Plan Cycle & Pricing
    cycle: {
      type: DataTypes.ENUM('MONTHLY', 'YEARLY', 'QUARTERLY', 'HALF_YEARLY'),
      defaultValue: 'MONTHLY',
      allowNull: false,
      comment: 'Billing cycle for this plan'
    },
    
    price: { 
      type: DataTypes.DECIMAL(10, 2), 
      allowNull: false,
      comment: 'Price for the selected cycle' 
    },
    
    currency: { 
      type: DataTypes.STRING(5), 
      defaultValue: 'PKR' 
    },
    
    // Trial Settings
    trial_days: { 
      type: DataTypes.INTEGER, 
      defaultValue: 30,
      comment: 'Number of trial days (0 = no trial)' 
    },
    
    // Plan Limits
    limits: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        max_branches: 1,
        max_students: 200,
        max_teachers: 12,
        max_staff: 10,
        max_admins: 2,
        storage_gb: 5,
        // Branch-wise limits (agar multiple branches hain)
        per_branch_limits: {
          enabled: false, // true for plans with multiple branches
          max_students_per_branch: 100,
          max_teachers_per_branch: 6,
          max_staff_per_branch: 5,
          // Ya phir percentage of total
          type: 'FIXED' // 'FIXED' or 'PERCENTAGE'
        }
      },
      comment: 'JSON object containing all plan limits and constraints'
    },
    
    // Popular/Publish Status
    is_popular: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Mark as popular/recommended plan for UI highlighting'
    },
    
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this plan is visible/available for selection'
    },
    
    is_active: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: true,
      comment: 'Whether this plan is active/enabled' 
    },
    
    // Features (Detailed features list)
    features: { 
      type: DataTypes.JSONB, 
      defaultValue: {
        // Core Features
        student_management: true,
        teacher_management: true,
        parent_portal: true,
        attendance_system: true,
        exam_management: true,
        fee_management: true,
        
        // Advanced Features
        payroll_management: false,
        library_management: false,
        transport_management: false,
        hostel_management: false,
        inventory_management: false,
        
        // Communication
        sms_notifications: false,
        email_notifications: true,
        push_notifications: false,
        
        // Reports & Analytics
        basic_reports: true,
        advanced_analytics: false,
        custom_reports: false,
        
        // Integrations
        api_access: false,
        whatsapp_integration: false,
        payment_gateway: true,
        
        // Support
        priority_support: false,
        dedicated_manager: false,
        training_sessions: false
      },
      comment: 'Detailed feature flags for the plan' 
    },
    
    // Role Assignment
    default_role_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Code of the template Role to assign when an institute subscribes to this plan',
    },
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional plan metadata like recommended_for, tags, etc.'
    },
    
    // Display Order
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Order to display plans in UI'
    }
  },
  {
    tableName: 'subscription_plans',
    timestamps: true,
    indexes: [
      { fields: ['code'], unique: true },
      { fields: ['is_active'] },
      { fields: ['is_popular'] },
      { fields: ['is_published'] },
      { fields: ['display_order'] }
    ]
  }
);

// Instance Methods
SubscriptionPlan.prototype.getLimits = function() {
  return this.limits;
};

SubscriptionPlan.prototype.getBranchLimits = function(branchCount = 1) {
  const limits = this.limits;
  
  if (branchCount <= 1 || !limits.per_branch_limits.enabled) {
    return {
      max_students: limits.max_students,
      max_teachers: limits.max_teachers,
      max_staff: limits.max_staff
    };
  }
  
  // Agar multiple branches hain to per-branch limits calculate karo
  if (limits.per_branch_limits.type === 'FIXED') {
    return {
      max_students: limits.per_branch_limits.max_students_per_branch,
      max_teachers: limits.per_branch_limits.max_teachers_per_branch,
      max_staff: limits.per_branch_limits.max_staff_per_branch
    };
  } else {
    // PERCENTAGE type - total ko branches mein divide karo
    return {
      max_students: Math.floor(limits.max_students / branchCount),
      max_teachers: Math.floor(limits.max_teachers / branchCount),
      max_staff: Math.floor(limits.max_staff / branchCount)
    };
  }
};

SubscriptionPlan.prototype.canAddBranch = function(currentBranchCount) {
  return currentBranchCount < this.limits.max_branches;
};

SubscriptionPlan.prototype.checkLimits = function(currentUsage, newEntries = {}) {
  const limits = this.limits;
  const errors = [];
  
  if (currentUsage.branches + (newEntries.branches || 0) > limits.max_branches) {
    errors.push(`Maximum branches limit (${limits.max_branches}) exceeded`);
  }
  
  if (currentUsage.students + (newEntries.students || 0) > limits.max_students) {
    errors.push(`Maximum students limit (${limits.max_students}) exceeded`);
  }
  
  if (currentUsage.teachers + (newEntries.teachers || 0) > limits.max_teachers) {
    errors.push(`Maximum teachers limit (${limits.max_teachers}) exceeded`);
  }
  
  if (currentUsage.staff + (newEntries.staff || 0) > limits.max_staff) {
    errors.push(`Maximum staff limit (${limits.max_staff}) exceeded`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Class Methods
SubscriptionPlan.getPublishedPlans = function() {
  return this.findAll({
    where: { 
      is_published: true,
      is_active: true 
    },
    order: [['display_order', 'ASC']]
  });
};

SubscriptionPlan.getPopularPlans = function() {
  return this.findAll({
    where: { 
      is_popular: true,
      is_published: true,
      is_active: true 
    },
    order: [['display_order', 'ASC']]
  });
};

// Associations
SubscriptionPlan.associate = (models) => {
  SubscriptionPlan.hasMany(models.SchoolSubscription, { 
    foreignKey: 'plan_id',
    as: 'subscriptions' 
  });
  SubscriptionPlan.hasMany(models.Institute, {
    foreignKey: 'subscription_plan_id',
    as: 'institutes'
  });
};

export default SubscriptionPlan;