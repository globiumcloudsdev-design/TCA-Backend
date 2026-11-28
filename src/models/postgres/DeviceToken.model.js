/**
 * The Clouds Academy - DeviceToken Model (FCM device tokens for push notifications)
 * Table: device_tokens (migrations/20261126000000-create-device-tokens.cjs)
 * One row per physical token; a token that changes hands is re-assigned to the new user.
 */
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const DeviceToken = sequelize.define(
  'DeviceToken',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    institute_id: { type: DataTypes.UUID, allowNull: true },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    token: { type: DataTypes.TEXT, allowNull: false, unique: true },
    platform: { type: DataTypes.STRING(10), allowNull: false }, // android | ios | web
    app: { type: DataTypes.STRING(10), allowNull: false }, // hpss | tca
    device_info: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    last_seen_at: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'device_tokens', paranoid: false }
);

DeviceToken.associate = (models) => {
  DeviceToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

export default DeviceToken;
