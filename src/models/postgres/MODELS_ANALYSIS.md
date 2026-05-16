# Models Usage Analysis

This document tracks which models are currently used in the backend codebase and which appear to be unused or legacy.

## Status Overview

| Model File | Usage Status | Primary Use Case | Notes |
|------------|--------------|------------------|-------|
| `AcademicYear.model.js` | **ACTIVE** | Session/Year management | Heavily used in Timetable, Exams, Students. |
| `Assignment.model.js` | **ACTIVE** | Student assignments | Used in Teacher/Student portals. |
| `AssignmentSubmission.model.js` | **ACTIVE** | Student submissions | Used in Teacher/Student portals. |
| `AuditLog.model.js` | **UNUSED** | System audit trail | File exists but logic uses `logger.info` instead of DB model. |
| `Branch.model.js` | **ACTIVE** | Multi-branch management | Used in Institute service and many others. |
| `Class.model.js` | **ACTIVE** | Grade/Class management | Core model used everywhere. |
| `Event.model.js` | **ACTIVE** | School events/calendar | Used in Event service and portals. |
| `Exam.model.js` | **ACTIVE** | Examination management | Used in Exam service and portals. |
| `ExamResult.model.js` | **ACTIVE** | Student marks/results | Used in Exam service and portals. |
| `Expense.model.js` | **ACTIVE** | Financial expenses | **Fixed**: Renamed from `.modal.js`. |
| `ExpenseCategory.model.js` | **ACTIVE** | Expense categorization | Used in Expense services. |
| `FeePayment.model.js` | **ACTIVE** | Fee transaction history | Used in FeeVoucher service. |
| `FeeTemplate.model.js` | **ACTIVE** | Fee structure blueprints | Used in FeeTemplate service. |
| `FeeVoucher.model.js` | **ACTIVE** | Student fee bills | Core financial model. |
| `Institute.model.js` | **ACTIVE** | Main organization entity | Replaced the old "School" model. |
| `InstituteSettings.model.js` | **ACTIVE** | Complex configuration | Used for specific institute rules (Attendance etc). |
| `InstituteType.model.js` | **ACTIVE** | School/College categories | Used in Master Admin and Institute creation. |
| `Invoice.model.js` | **ACTIVE** | SaaS billing (Institutes) | Used in SaaS job and Master Admin. |
| `LeaveRequest.model.js` | **ACTIVE** | Staff/Teacher leaves | Used in Staff/Teacher services. |
| `LeaveType.model.js` | **ACTIVE** | Leave categories | Used in Staff/Teacher services. |
| `Notification.model.js` | **ACTIVE** | System notifications | Used in Notification service and Sockets. |
| `Payslip.model.js` | **ACTIVE** | Staff payroll | Used in Payroll/Staff services. |
| `Policy.model.js` | **ACTIVE** | Rule engine (Attendance etc) | Used in Payroll and Auth services. |
| `Role.model.js` | **ACTIVE** | RBAC permissions | Core security model. |
| `School.model.js` | **DELETED** | Old organization entity | Replaced by `Institute`. |
| `SchoolSubscription.model.js` | **DELETED** | Old SaaS tracking | Replaced by `Invoice`. |
| `Section.model.js` | **ACTIVE** | Class sections | Core academic model. |
| `StaffAttendance.model.js` | **ACTIVE** | Staff/Teacher attendance | Used in Staff/Teacher services and jobs. |
| `StudentAttendance.model.js` | **ACTIVE** | Student attendance | Used in Student service and jobs. |
| `Subject.model.js` | **ACTIVE** | Course subjects | Used in Timetable and Exam services. |
| `SubscriptionPlan.model.js` | **ACTIVE** | SaaS plan definitions | Used in SaaS billing and Master Admin. |
| `Timetable.model.js` | **ACTIVE** | Class schedules | Core academic model. |
| `User.model.js` | **ACTIVE** | All system users | Unified model for Staff, Students, Parents, Admins. |
| `Vendor.model.js` | **ACTIVE** | Third-party suppliers | **Fixed**: Renamed from `.modal.js`. |

## Actions Taken

1.  **Cleanup Legacy Models**: Deleted `School.model.js` and `SchoolSubscription.model.js`.
2.  **Model Renaming**: Renamed `.modal.js` to `.model.js` for `Expense` and `Vendor`.
3.  **Index Update**: Updated `index.js` to reflect these changes and removed unused imports.

## Future Recommendations

1.  **Audit Log Implementation**: Either start using `AuditLog.model.js` to store history in Postgres, or delete the file and stick to text-based logging.
