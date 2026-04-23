import * as attendanceService from "../../services/studentAttendance.service.js";
import models from "../../models/postgres/index.js";
import {
  sendSuccess,
  sendPaginated,
  sendError,
  sendNotFound,
} from "../../utils/helpers/response.helper.js";

// Helper to get institute ID from request
const getSchoolId = (req) => req.user?.school_id;

// Helper to sanitize UUID fields that might be empty strings from frontend
const sanitizeUUIDs = (data) => {
  const fields = ["class_id", "section_id", "academic_year_id", "student_id"];
  const sanitized = { ...data };
  fields.forEach((field) => {
    if (sanitized[field] === "") sanitized[field] = null;
  });
  return sanitized;
};

export const markAttendance = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return sendError(res, "School ID not found", 400);

    const data = sanitizeUUIDs({
      ...req.body,
      school_id: schoolId,
      marked_by: req.user.id,
    });
    const result = await attendanceService.markAttendance(data);
    return sendSuccess(res, result, "Attendance marked successfully");
  } catch (error) {
    console.error("Mark attendance error:", error);
    return sendError(res, error.message || "Failed to mark attendance", 400);
  }
};

export const bulkMarkAttendance = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return sendError(res, "School ID not found", 400);

    const data = sanitizeUUIDs({
      ...req.body,
      school_id: schoolId,
      marked_by: req.user.id,
      skip_existing:
        req.body.skip_existing === true || req.body.skip_existing === "true", // accept boolean or string
    });
    const result = await attendanceService.bulkMarkAttendance(data);
    const message =
      result.skipped > 0
        ? `${result.results.length} attendance marked, ${result.skipped} skipped (already existed)`
        : "Bulk attendance marked successfully";
    return sendSuccess(res, result, message);
  } catch (error) {
    console.error("Bulk mark error:", error);
    return sendError(
      res,
      error.message || "Failed to mark bulk attendance",
      400,
    );
  }
};

//
export const scanQR = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return sendError(res, "School ID not found", 400);

    const { student_id, date, type } = req.body;
    if (!student_id) return sendError(res, "Student ID required", 400);

    console.log('Scan QR Api Response', student_id)

    const student = await models.User.findByPk(student_id, {
      attributes: ["user_type", "details", "school_id"],
    });
    if (!student) return sendError(res, "Student not found", 404);
    if (student.user_type !== "STUDENT")
      return sendError(res, "User is not a student", 400);

    const data = {
      student_id,
      date,
      school_id: schoolId,
      marked_by: req.user.id,
      type,
    };
    const result = await attendanceService.scanQR(data);
    return sendSuccess(res, result, "QR scan processed successfully");
  } catch (error) {
    console.error("QR scan error:", error);
    return sendError(res, error.message || "Failed to process QR scan", 400);
  }
};

export const getAttendance = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return sendError(res, "School ID not found", 400);

    const filters = {
      school_id: schoolId,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      student_id: req.query.student_id,
      date: req.query.date,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      status: req.query.status,
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
    };
    const result = await attendanceService.getAttendance(filters, pagination);
    return sendPaginated(
      res,
      result.data,
      result.pagination,
      "Attendance fetched successfully",
    );
  } catch (error) {
    console.error("Get attendance error:", error);
    return sendError(res, error.message || "Failed to fetch attendance", 500);
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    if (!schoolId) return sendError(res, "School ID not found", 400);

    const attendance = await models.StudentAttendance.findOne({
      where: { id, school_id: schoolId },
    });
    if (!attendance) return sendNotFound(res, "Attendance record not found");

    const sanitizedBody = sanitizeUUIDs(req.body);
    const result = await attendanceService.markAttendance({
      ...sanitizedBody,
      id,
      school_id: schoolId,
    });
    return sendSuccess(res, result, "Attendance updated successfully");
  } catch (error) {
    console.error("Update attendance error:", error);
    return sendError(res, error.message || "Failed to update attendance", 400);
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return sendError(res, "School ID not found", 400);

    const params = {
      school_id: schoolId,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      student_id: req.query.student_id,
      month: req.query.month,
      year: req.query.year,
    };
    const report = await attendanceService.getAttendanceReport(params);
    return sendSuccess(res, report, "Report generated");
  } catch (error) {
    console.error("Report error:", error);
    return sendError(res, error.message || "Failed to generate report", 500);
  }
};
