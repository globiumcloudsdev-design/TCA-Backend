import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const StudentAttendance = sequelize.define(
  "StudentAttendance",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    school_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "institutes", key: "id" },
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "branches", key: "id" },
      onDelete: "SET NULL",
    },
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "academic_years", key: "id" },
      onDelete: "SET NULL",
    },
    class_id: {
      type: DataTypes.UUID,
      references: { model: "classes", key: "id" },
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "sections", key: "id" },
      onDelete: "SET NULL",
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    event_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'events', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'If this attendance is for an event, link to event',
    },
    // 🔥 Optional: Link to exam if this is exam attendance
    exam_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "exams", key: "id" },
      onDelete: "SET NULL",
      comment: "If this attendance is for an exam, link to exam"
    },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM("present", "absent", "late", "leave", "holiday"),
      defaultValue: "present",
    },
    remarks: { type: DataTypes.STRING(255) },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Attendance type: regular, exam, etc.",
    },
    marked_by: {
      type: DataTypes.UUID,
      references: { model: "users", key: "id" },
    },
    leave_type_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "leave_types", key: "id" },
      onDelete: "SET NULL",
      comment: "If status = leave, reference to leave type",
    },
    leave_request_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "leave_requests", key: "id" },
      onDelete: "SET NULL",
      comment: "Optional link to approved leave request",
    },
  },
  {
    tableName: "student_attendances",
    indexes: [
      { unique: true, fields: ["student_id", "date"] },
      { fields: ["class_id"] },
      { fields: ["section_id"] },
      { fields: ["date"] },
      { fields: ["leave_type_id"] },
      { fields: ["status"] },
    ],
  },
);

StudentAttendance.associate = (models) => {
  StudentAttendance.belongsTo(models.Institute, {
    foreignKey: "school_id",
    as: "institute",
  });
  StudentAttendance.belongsTo(models.AcademicYear, {
    foreignKey: "academic_year_id",
    as: "AcademicYear",
  });
  StudentAttendance.belongsTo(models.Class, { foreignKey: "class_id" });
  StudentAttendance.belongsTo(models.Section, {
    foreignKey: "section_id",
    as: "Section",
  });
  StudentAttendance.belongsTo(models.User, {
    foreignKey: "student_id",
    as: "Student",
  });
  StudentAttendance.belongsTo(models.User, {
    foreignKey: "marked_by",
    as: "MarkedBy",
  });
  StudentAttendance.belongsTo(models.Exam, {
    foreignKey: "exam_id",
    as: "exam",
  });
  StudentAttendance.belongsTo(models.LeaveType, {
    foreignKey: "leave_type_id",
    as: "leaveType",
  });
  StudentAttendance.belongsTo(models.LeaveRequest, {
    foreignKey: "leave_request_id",
    as: "leaveRequest",
  });
  StudentAttendance.belongsTo(models.Event, {
    foreignKey: "event_id",
    as: "event",
  });
};

export default StudentAttendance;
