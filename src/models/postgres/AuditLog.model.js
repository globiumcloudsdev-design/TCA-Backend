/**
 * The Clouds Academy - AuditLog Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    institute_id: { type: DataTypes.UUID },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Optional — which branch context this log entry was created in',
    },
    user_id: { type: DataTypes.UUID },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entity: { type: DataTypes.STRING(100) },
    entity_id: { type: DataTypes.STRING(255) },
    old_values: { type: DataTypes.JSONB },
    new_values: { type: DataTypes.JSONB },
    ip_address: { type: DataTypes.STRING(50) },
    user_agent: { type: DataTypes.TEXT },
  },
  { tableName: 'audit_logs', updatedAt: false }
);

export default AuditLog;
