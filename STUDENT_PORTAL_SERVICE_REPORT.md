# Student Portal Service Report

## 1) Scope
This document covers Student Portal implementation across:
- Routes
- Controller
- Service
- Response envelopes
- Endpoint list and payload behavior

Primary files:
- `backend/src/api/routes/v1/portal/student.portal.routes.js`
- `backend/src/api/controllers/portal/studentPortal.controller.js`
- `backend/src/services/portal/studentPortal.service.js`

## 2) Auth & Access
All student portal routes use:
- `protect` middleware (JWT auth)
- `isStudent` middleware (role guard)

Therefore every `/portal/student/*` endpoint requires authenticated `STUDENT` user.

## 3) Endpoint Inventory
Base path: `/api/v1/portal/student`

### 3.1 Dashboard
- `GET /dashboard`
- Service: `getStudentDashboard(studentId, instituteId)`
- Returns dashboard widgets:
  - student info snapshot
  - today classes
  - upcoming assignments
  - recent attendance
  - recent results
  - fee status
  - notices
  - statistics
  - quick actions

### 3.2 Profile
- `GET /profile`
- `PUT /profile` (avatar upload supported)
- Services:
  - `getStudentProfile`
  - `updateStudentProfile`

### 3.3 Classes & Timetable
- `GET /classes`
- `GET /timetable`
- `GET /today-classes`
- Services:
  - `getMyClasses`
  - `getMyTimetable`
  - `getTodayClasses`

### 3.4 Attendance
- `GET /attendance`
- Service: `getMyAttendance`
- Filter support via query:
  - `from_date`, `to_date`, `subject`, `limit`

### 3.5 Assignments
- `GET /assignments`
- `GET /assignments/upcoming`
- `POST /assignments/:assignmentId/submit` (files upload)
- Services:
  - `getMyAssignments`
  - `getUpcomingAssignments`
  - `submitAssignment`

### 3.6 Results
- `GET /results`
- `GET /results/recent`
- Services:
  - `getMyResults`
  - `getRecentResults`

### 3.7 Fees
- `GET /fees`
- `GET /fees/summary`
- Services:
  - `getMyFees`
  - `getFeeSummary`

### 3.8 Notices
- `GET /notices`
- `GET /notices/recent`
- Services:
  - `getNotices`
  - `getRecentNotices`

### 3.9 Library
- `GET /library`
- Service: `getLibraryData`

## 4) Response Envelope Pattern
Controller uses helper responses:
- success:
  - `sendSuccess(res, data, message)`
- pagination:
  - `sendPaginated(res, data, pagination, message)`
- errors:
  - `sendError(res, message, statusCode)`

### 4.1 Standard success envelope
```json
{
  "success": true,
  "message": "...",
  "data": {},
  "timestamp": "2026-03-25T...Z"
}
```

### 4.2 Paginated envelope
```json
{
  "success": true,
  "message": "...",
  "data": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  },
  "timestamp": "2026-03-25T...Z"
}
```

## 5) Service Behavior Deep Dive
## 5.1 Profile normalization
`getStudentProfile` performs robust normalization:
- merges `details` and `details.studentDetails`
- resolves active academic session
- resolves class/section IDs and names
- backward compatibility for multiple key styles

This is one of the strongest parts of the service.

## 5.2 Timetable matching logic
Service includes fallback matching strategy:
- direct current class/section
- active academic sessions
- historical sessions fallback (only when needed)
- slot normalization for day/time fields

This prevents blank timetable results caused by inconsistent data mapping.

## 5.3 Assignment audience matching
Assignments are fetched through multiple audience dimensions:
- `target_type` based audiences
- class/section direct audience
- published-state checks
- submission-status enrichment

Submission flow supports:
- file upload
- resubmission attempts
- late/overdue status logic
- assignment stats update

## 5.4 Attendance, fees, results
- attendance summary + subject-wise computation
- fee summary + due indicators
- exam result grouping per exam with percentage

## 5.5 Notices fallback model
`NoticeModel = Notice || Notification` fallback pattern exists for compatibility.

## 6) Practical Response Samples
## 6.1 Dashboard (`GET /portal/student/dashboard`) data shape
```json
{
  "student": {
    "id": "...",
    "name": "...",
    "registration_no": "...",
    "class": "...",
    "section": "..."
  },
  "today_classes": [],
  "upcoming_assignments": [],
  "recent_attendance": {
    "total_days": 0,
    "present_days": 0,
    "percentage": 0,
    "chart": {}
  },
  "recent_results": [],
  "fee_status": {
    "has_due": false,
    "total_due": 0,
    "due_count": 0
  },
  "notices": [],
  "statistics": {
    "attendance_percentage": 0,
    "total_assignments_submitted": 0,
    "total_exams_taken": 0,
    "rank": 0
  },
  "quick_actions": []
}
```

## 6.2 Assignments (`GET /portal/student/assignments`) data shape
```json
{
  "data": [
    {
      "id": "...",
      "title": "...",
      "subject": "...",
      "status": "pending|submitted|graded|late|overdue",
      "submission": {
        "id": "...",
        "submitted_at": "...",
        "marks": 85,
        "grade": "A"
      }
    }
  ],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  }
}
```

## 7) Current Strengths
- rich normalization logic for profile/class/session
- resilient timetable + assignment audience matching
- consistent response helper usage in controller
- broad endpoint coverage for student lifecycle

## 8) Current Gaps / Risks
1. Mixed production + placeholder logic in some helper sections.
2. Very large service file impacts maintainability.
3. Some JSONB key paths are schema-sensitive and need strict contracts.
4. Heavy operations may become expensive without caching/index strategy.

## 9) Suggested Improvements (Future Roadmap)
1. Split service into modules:
- `studentDashboard.service`
- `studentAcademic.service`
- `studentAssignment.service`
- `studentFee.service`

2. Add DTO/serializer layer:
- strict response schema and backward-compat fields

3. Add service-level tests:
- profile normalization
- timetable matching edge cases
- assignment submission + late logic

4. Add indexes and analytics support:
- attendance date/status indexes
- fee due/status indexes
- common JSONB extraction materialization

5. Add API documentation:
- OpenAPI spec for all `/portal/student/*` endpoints

## 10) Endpoint Quick Table
- `GET /portal/student/dashboard` → dashboard
- `GET /portal/student/profile` → profile
- `PUT /portal/student/profile` → update profile
- `GET /portal/student/classes` → classes
- `GET /portal/student/timetable` → timetable
- `GET /portal/student/today-classes` → today classes
- `GET /portal/student/attendance` → attendance
- `GET /portal/student/assignments` → assignments list
- `GET /portal/student/assignments/upcoming` → upcoming assignments
- `POST /portal/student/assignments/:assignmentId/submit` → submit assignment
- `GET /portal/student/results` → results
- `GET /portal/student/results/recent` → recent results
- `GET /portal/student/fees` → fee detail
- `GET /portal/student/fees/summary` → fee summary
- `GET /portal/student/notices` → notices list
- `GET /portal/student/notices/recent` → recent notices
- `GET /portal/student/library` → library data
