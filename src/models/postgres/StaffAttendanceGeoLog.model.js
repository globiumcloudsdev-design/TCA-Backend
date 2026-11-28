/**
 * The Clouds Academy - StaffAttendanceGeoLog Model
 *
 * One row per teacher self check-in / check-out ATTEMPT (accepted or rejected) with the device
 * location and the geofence decision. Written best-effort: if this table is missing (migration not
 * run yet) attendance still works and the attempt is only written to the server log.
 * Table: staff_attendance_geo_logs (migrations/20261125000000-create-staff-attendance-geo-logs.cjs)
 */
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const StaffAttendanceGeoLog = sequelize.define(
  'StaffAttendanceGeoLog',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    institute_id: { type: DataTypes.UUID, allowNull: false },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    staff_id: { type: DataTypes.UUID, allowNull: false },
    staff_attendance_id: { type: DataTypes.UUID, allowNull: true },
    action: { type: DataTypes.STRING(12), allowNull: false }, // check_in | check_out
    outcome: { type: DataTypes.STRING(10), allowNull: false }, // accepted | rejected
    reason: { type: DataTypes.STRING(30), allowNull: false }, // OK | OUTSIDE_RADIUS | MOCK_LOCATION | NO_CAMPUS_LOCATION | NO_CAMPUS | INVALID_LOCATION
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    accuracy_m: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    distance_m: { type: DataTypes.DECIMAL(10, 1), allowNull: true },
    radius_m: { type: DataTypes.INTEGER, allowNull: true },
    is_mocked: { type: DataTypes.BOOLEAN, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    client: { type: DataTypes.STRING(255), allowNull: true }, // user-agent / app version hint
  },
  { tableName: 'staff_attendance_geo_logs', updatedAt: false, paranoid: false }
);

export default StaffAttendanceGeoLog;
