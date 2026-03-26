# Backend Deep Analysis Report (Routes, Controllers, Services, Models)

## 1) Executive Summary
This backend is an Express + Sequelize (PostgreSQL) architecture with layered separation:
- Routes: API contract + middleware composition
- Controllers: request/response orchestration
- Services: business logic + DB access
- Models: Sequelize schema and relations

Current state is functional and broad, but there is overlap between legacy and newer dashboard/portal layers. The newly added institute dashboard endpoint now provides realtime, frontend-ready payloads for institute-level dashboard screens.

## 2) Core Structure
- API root: `/api/v1`
- Route aggregation: `backend/src/api/routes/v1/index.js`
- Main route groups:
  - auth, institutes/schools, academic-years, classes, roles, students, parents, teachers
  - timetable, staff, branches, fees, attendance
  - dashboard, master-admin
  - portal (teacher/student/parent)

## 3) Route Layer Analysis
### 3.1 Main v1 aggregator
File: `backend/src/api/routes/v1/index.js`
- Central mountpoint for all domain modules.
- Good modularity and clear route prefix ownership.

### 3.2 Dashboard routes
File: `backend/src/api/routes/v1/dashboard.routes.js`
- Existing role-specific endpoints:
  - `GET /dashboard/master`
  - `GET /dashboard/teacher`
  - `GET /dashboard/student`
  - `GET /dashboard/student/:studentId`
  - `GET /dashboard/parent`
- Newly implemented endpoint:
  - `GET /dashboard/institute`
  - Access: `INSTITUTE_ADMIN`, `BRANCH_ADMIN`, `STAFF`

### 3.3 Portal routes
File: `backend/src/api/routes/v1/portal/index.js`
- Aggregates:
  - `/portal/teacher`
  - `/portal/student`
  - `/portal/parent`

## 4) Controller Layer Analysis
### 4.1 Dashboard controllers
Folder: `backend/src/api/controllers/dashboard`
- master, teacher, student, parent already present.
- Added institute controller:
  - `backend/src/api/controllers/dashboard/instituteDashboard.controller.js`
  - Responsibilities:
    - resolve institute context from auth user
    - forward query scope (`type`, `branch_id`)
    - return standard `sendSuccess/sendError` envelope

### 4.2 Portal student controller
File: `backend/src/api/controllers/portal/studentPortal.controller.js`
- Thin orchestration controller.
- Consistent helper usage (`sendSuccess`, `sendPaginated`, `sendError`).
- Works as intended for service-driven responses.

## 5) Service Layer Analysis
### 5.1 Dual dashboard stacks currently exist
1. `backend/src/services/dashboard/*`
2. `backend/src/services/portal/*`

Observations:
- `services/dashboard/*` contains mixed quality; some methods still include mock/static sections.
- `services/portal/*` (especially student/teacher) is richer and more production-oriented.

### 5.2 Newly added institute dashboard service
File: `backend/src/services/dashboard/instituteDashboard.service.js`

What it does:
- realtime aggregation from DB on each request
- branch-aware scope
- institute type-aware stat card labels
- frontend-ready shape:
  - `stats[]` cards
  - `summary` object
  - `charts.attendance`
  - `charts.fees`
  - `charts.enrollment`
  - `charts.gender`
  - `charts.feeStatus`
  - `recentActivity[]`
  - `lastUpdated`

Data sources:
- Users, Classes, Sections, Attendance, FeeVoucher, Exam, Institute, Branch

Scoping behavior:
- branch admin is forced to own `branch_id`
- custom branch filters are validated against institute

## 6) Model Layer Analysis
Main model index:
- `backend/src/models/postgres/index.js`
- Includes alias `School: Institute` for compatibility migration

Key models relevant to dashboard:
- `User`: polymorphic user_type table + details JSONB
- `Institute`, `InstituteType`
- `Class`, `Section`
- `Attendance`
- `FeeVoucher`
- `Exam`
- `Branch`

Strengths:
- broad schema coverage
- tenant isolation via `school_id`
- branch-aware schema across major modules

Risks:
- JSONB-heavy `details` requires careful normalization and may need indexed projections later
- duplicated domain logic between old/new dashboard service families

## 7) What Was Implemented in This Task
### Backend
1. Added route/controller/service for institute dashboard:
- `backend/src/api/controllers/dashboard/instituteDashboard.controller.js`
- `backend/src/services/dashboard/instituteDashboard.service.js`
- route wired in `backend/src/api/routes/v1/dashboard.routes.js`

2. Minor stability fix:
- `sendError` import added in `backend/src/api/controllers/dashboard/masterDashboard.controller.js`

### Frontend integration
- `Frontend/src/services/dashboardService.js` now calls realtime endpoint `GET /dashboard/institute`
- removed dummy-data fallback logic from dashboard service
- kept backward-compatible wrappers (`getStats`, `getChartData`) mapped to realtime backend

## 8) Dashboard API Contract (New)
### Endpoint
`GET /api/v1/dashboard/institute`

### Query params
- `type` (optional): school|coaching|academy|college|university|tuition_center
- `branch_id` (optional): branch scope
- `range` (optional): currently accepted for forward compatibility

### Response (high-level)
- `data.institute`
- `data.stats[]`
- `data.summary`
- `data.charts`
- `data.recentActivity[]`
- `data.scope`
- `data.lastUpdated`

## 9) Recommended Additions (Future-safe)
1. Introduce dashboard module boundary:
- move all dashboard endpoints to unified `dashboardV2` contract
- deprecate duplicate legacy services gradually

2. Add caching layer:
- Redis cache for expensive chart aggregations
- TTL: 30-90s for near-realtime UX

3. Add materialized analytics tables:
- daily attendance summary
- monthly fee summary
- class enrollment snapshots

4. Add query performance indexes:
- composite indexes on `(school_id, branch_id, date/status)` for attendance/fees/exams
- JSONB path indexes if class/gender analytics remain JSON-based

5. Add API versioned response schema docs:
- OpenAPI spec for dashboard and portal
- explicit nullable fields + array shape guarantees

6. Add observability:
- request latency and query timing around dashboard endpoints
- error budget alerts for dashboard APIs

7. Add tests:
- service unit tests for dashboard aggregation
- integration tests for role access + branch scoping

## 10) Conclusion
The backend now has a proper institute-level realtime dashboard route/service/controller integrated end-to-end with frontend consumption and no dummy dependency in dashboard service. The codebase is extensible, and with the suggested analytics/caching/test roadmap, future dashboard expansion will remain manageable.
