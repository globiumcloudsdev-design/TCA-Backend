/**
 * The Clouds Academy - Model Index
 * Loads all Sequelize models and sets up associations
 */

import sequelize from '../../config/database.js';

// Import all models
import Institute from './Institute.model.js';
import InstituteType from './InstituteType.model.js';
import User from './User.model.js';
import Role from './Role.model.js';
import AcademicYear from './AcademicYear.model.js';
import Class from './Class.model.js';
import Section from './Section.model.js';
import Subject from './Subject.model.js';
import Attendance from './Attendance.model.js';
import Exam from './Exam.model.js';
import ExamResult from './ExamResult.model.js';
import FeeVoucher from './FeeVoucher.model.js';
import FeePayment from './FeePayment.model.js';
import SubscriptionPlan from './SubscriptionPlan.model.js';
import SchoolSubscription from './SchoolSubscription.model.js';
import Invoice from './Invoice.model.js';
import Notification from './Notification.model.js';
import AuditLog from './AuditLog.model.js';
import Timetable from './Timetable.model.js';
import FeeTemplate from './FeeTemplate.model.js';
import Branch from './Branch.model.js';
import Assignment from './Assignment.model.js';
import AssignmentSubmission from './AssignmentSubmission.model.js';

const models = {
  sequelize,
  Institute,
  InstituteType,
  // Backward-compat alias: any model association that still says models.School 
  // will resolve to the Institute model during the transition
  School: Institute,
  User,
  Role,
  AcademicYear,
  Class,
  Section,
  Subject,
  Attendance,
  Exam,
  ExamResult,
  FeeVoucher,
  FeePayment,
  SubscriptionPlan,
  SchoolSubscription,
  Invoice,
  Notification,
  AuditLog,
  Timetable,
  FeeTemplate,
  Branch,
  Assignment,
  AssignmentSubmission
};

// Run associations — deduplicate so alias School: Institute doesn't call associate twice
const seen = new Set();
Object.values(models).forEach((model) => {
  if (model?.associate && !seen.has(model)) {
    seen.add(model);
    model.associate(models);
  }
});

export { sequelize };
export default models;


