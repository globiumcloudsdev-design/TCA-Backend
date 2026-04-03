import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { hasPermission } from "../../middlewares/permission.middleware.js";
import {
  markAttendance,
  bulkMarkAttendance,
  scanQR,
  getAttendance,
  updateAttendance,
  getAttendanceReport,
} from "../../controllers/studentAttendance.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// QR scan - marks present only if not already present
router.post("/scan", hasPermission("attendance.mark"), scanQR);

// Manual single or bulk marking
router.post("/mark", hasPermission("attendance.mark"), markAttendance);
router.post("/bulk", hasPermission("attendance.mark"), bulkMarkAttendance);

// View attendance (with filters)
router.get("/", hasPermission("attendance.view"), getAttendance);

// Update attendance record (manual edit allowed)
router.put("/:id", hasPermission("attendance.update"), updateAttendance);

// Reports - class-wise with total students + working days
router.get("/reports", hasPermission("attendance.view"), getAttendanceReport);

export default router;
