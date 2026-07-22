import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const SupportTicket = sequelize.define(
  'SupportTicket',
  {
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
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('BILLING', 'TECHNICAL', 'GENERAL', 'FEATURE_REQUEST'),
      defaultValue: 'GENERAL',
    },
    priority: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
      defaultValue: 'LOW',
    },
    status: {
      type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'),
      defaultValue: 'OPEN',
    },
    messages: {
      type: DataTypes.JSONB,
      defaultValue: [],
      /*
        Structure of each message:
        {
          id: uuid,
          sender_id: uuid,
          sender_name: string,
          sender_type: 'INSTITUTE' | 'MASTER_ADMIN',
          message: string,
          created_at: ISOString
        }
      */
    },
  },
  {
    tableName: 'support_tickets',
    timestamps: true,
    indexes: [
      { fields: ['institute_id'] },
      { fields: ['status'] },
    ],
  }
);

SupportTicket.associate = (models) => {
  SupportTicket.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'Institute' });
  SupportTicket.belongsTo(models.User, { foreignKey: 'user_id', as: 'creator' });
};

export default SupportTicket;
