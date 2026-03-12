# 📊 THE CLOUDS ACADEMY - BACKEND PROGRESS TRACKER

> **Updated:** 28 February 2026 — Phase 2 Update  
> **Stack:** Node.js (ES6 Modules) + Express + PostgreSQL (Sequelize) + Socket.io  
> **Architecture:** MVC + Service Layer + Dynamic Role System

---

## ✅ COMPLETED

### 📁 Root Files
| File | Status | Description |
|------|--------|-------------|
| `package.json` | ✅ Done | ES6 `"type": "module"`, all dependencies defined |
| `server.js` | ✅ Done | HTTP server, DB connection, Socket.io init, graceful shutdown |
| `.env.example` | ✅ Done | All env variables documented |
| `.gitignore` | ✅ Done | node_modules, logs, uploads/temp excluded |
| `nodemon.json` | ✅ Done | Dev watch config for ES6 modules |

---

### ⚙️ src/config/
| File | Status | Description |
|------|--------|-------------|
| `index.js` | ✅ Done | Master config - all env vars in one object |
| `database.js` | ✅ Done | Sequelize + PostgreSQL, pooling, retry, soft deletes |
| `logger.js` | ✅ Done | Winston + Morgan, daily rotating log files |
| `cors.js` | ✅ Done | CORS whitelist for frontend origins |
| `auth.js` | ✅ Done | JWT sign/verify helpers |
| `cloudinary.js` | ✅ Done | Upload/delete/optimize Cloudinary |
| `email.js` | ✅ Done | Nodemailer + Handlebars templates |
| `sms.js` | ✅ Done | Twilio SMS sender |
| `payment.js` | ✅ Done | Stripe config |
| `rateLimit.js` | ✅ Done | Rate limit options |
| `permissions.js` | ✅ Done | All permission constants + groups for UI checkboxes |
| `multer.js` | ✅ Done | Local disk upload for temp files |

---

### 🗄️ src/models/postgres/
| File | Status | Description |
|------|--------|-------------|
| `index.js` | ✅ Done | Auto-loads all models + runs associations |
| `School.model.js` | ✅ Done | Multi-tenant school entity |
| `User.model.js` | ✅ Done | Platform users (Master Admin + School Users) |
| `Role.model.js` | ✅ Done | **Dynamic roles** per school |
| `Permission.model.js` | ✅ Done | All system permissions (seed data) |
| `RolePermission.model.js` | ✅ Done | Junction: Role ↔ Permission (with restrictions JSONB) |
| `UserRole.model.js` | ✅ Done | Junction: User ↔ Role (one active role per user) |
| `Student.model.js` | ✅ Done | Full student profile |
| `Teacher.model.js` | ✅ Done | Teacher profile + employee details |
| `Parent.model.js` | ✅ Done | Parent/guardian with relation type |
| `Class.model.js` | ✅ Updated | Added `academic_year_id` (required FK), `branch_id` (nullable — only set when `school.has_branches=true`). Sections moved to their own model. Unique index on school+year+branch+name |
| `School.model.js` | ✅ Updated | Added `has_branches` (BOOLEAN) + `role_id` (FK → Role) — assigned role defines school-level module access. `belongsTo Role as AssignedRole` |
| `Section.model.js` | ✅ New | Sections per class per year: `name`, `capacity`, `room_number`, `section_teacher_id`, `academic_year_id` |
| `AcademicYear.model.js` | ✅ New | One `is_current=true` per school at a time. All major models carry `academic_year_id` FK |
| `Subject.model.js` | ✅ Done | Subjects per class with teacher |
| `Attendance.model.js` | ✅ Updated | Added `academic_year_id` + `section_id` FKs |
| `Exam.model.js` | ✅ Updated | Added `academic_year_id` FK |
| `ExamResult.model.js` | ✅ Done | Results per student per subject |
| `FeeVoucher.model.js` | ✅ Updated | Added `academic_year_id` FK — enables per-year fee reporting |
| `FeePayment.model.js` | ✅ Done | Payment collection records |
| `SubscriptionPlan.model.js` | ✅ Done | SaaS plans (Basic/Pro/Enterprise) |
| `SchoolSubscription.model.js` | ✅ Done | School's active subscription |
| `Invoice.model.js` | ✅ Done | SaaS billing invoices |
| `Notification.model.js` | ✅ Done | In-app + push + email notifications |
| `AuditLog.model.js` | ✅ Done | Full audit trail |

---

### 🛡️ src/api/middlewares/
| File | Status | Description |
|------|--------|-------------|
| `auth.middleware.js` | ✅ Done | JWT verification, `protect`, `isMasterAdmin`, `optionalAuth` |
| `permission.middleware.js` | ✅ Done | **Dynamic RBAC** - `hasPermission('fee.create')` |
| `schoolContext.middleware.js` | ✅ Done | Resolves school from user or header |
| `subscription.middleware.js` | ✅ Done | Blocks access if subscription expired |
| `rateLimit.middleware.js` | ✅ Done | General + auth + public rate limiters |
| `validation.middleware.js` | ✅ Done | Joi schema validation wrapper |
| `audit.middleware.js` | ✅ Done | Logs all mutating requests |
| `upload.middleware.js` | ✅ Done | Multer wrappers (single/multiple) |
| `errorHandler.middleware.js` | ✅ Done | Global error handler (Sequelize + JWT + AppError) |
| `notFound.middleware.js` | ✅ Done | 404 handler |

---

### 🔧 src/utils/
| File | Status | Description |
|------|--------|-------------|
| `lib/AppError.js` | ✅ Done | Custom error class + common error factories |
| `lib/catchAsync.js` | ✅ Done | Async wrapper - no try/catch needed |
| `lib/apiFeatures.js` | ✅ Done | Sequelize filter/search/sort/paginate |
| `helpers/response.helper.js` | ✅ Done | Standard JSON response helpers |
| `helpers/jwt.helper.js` | ✅ Done | JWT sign/verify/extract |
| `helpers/password.helper.js` | ✅ Done | bcryptjs hash/compare |
| `helpers/date.helper.js` | ✅ Done | Date formatting, ranges, add days/months |

---

### ⚡ src/services/
| File | Status | Description |
|------|--------|-------------|
| `auth.service.js` | ✅ Done | Login (with dynamic role population), refresh, forgot/reset password |
| `role.service.js` | ✅ Done | Full CRUD for dynamic roles + permission assignment |
| `school.service.js` | ✅ Done | School profile fetch (with assigned role + permissions), `assignRoleToSchool`, `removeRoleFromSchool`, `updateSchoolSettings` |
| `academicYear.service.js` | ✅ Done | Full CRUD, `setCurrentAcademicYear` (only one current/school), delete guard (no classes/students attached) |
| `section.service.js` | ✅ Done | Full CRUD nested under class, capacity guard on update, enrolled count enrichment, delete guard |
| `student.service.js` | ✅ Done | Student CRUD with pagination |
| `fee.service.js` | ✅ Done | Voucher creation, listing, payment collection |
| `attendance.service.js` | ✅ Done | Bulk mark, class fetch, summary |
| `email.service.js` | ✅ Done | Welcome, password reset, fee reminder, invoice emails |
| `sms.service.js` | ✅ Done | OTP, fee reminder, attendance alert SMS |
| `notification.service.js` | ✅ Done | CRUD + mark read + unread count |

---

### 🎮 src/api/controllers/
| File | Status | Description |
|------|--------|-------------|
| `auth.controller.js` | ✅ Done | Login, logout, refresh, forgot/reset, getMe |
| `role.controller.js` | ✅ Done | Full role CRUD + assign + all permissions endpoint |
| `school.controller.js` | ✅ Done | `getSchoolProfile` (with role+permissions), `assignRoleToSchool`, `removeRoleFromSchool`, `updateSchoolSettings` |
| `academicYear.controller.js` | ✅ Done | Full CRUD + `setCurrentAcademicYear` endpoint |
| `section.controller.js` | ✅ Done | Full CRUD nested under class (classId param) |
| `student.controller.js` | ✅ Done | Full CRUD with Cloudinary photo upload |
| `fee.controller.js` | ✅ Done | Voucher CRUD + payment collection |
| `attendance.controller.js` | ✅ Done | Mark, get by class/date, student summary |
| `dashboard.controller.js` | ✅ Done | Stats: students, teachers, pending fees, today attendance |

---

### 🛣️ src/api/routes/v1/
| File | Status | Description |
|------|--------|-------------|
| `index.js` | ✅ Updated | V1 route aggregator — now includes schools, academic-years, classes |
| `auth.routes.js` | ✅ Done | Login, logout, refresh, forgot/reset |
| `role.routes.js` | ✅ Done | Role CRUD + permissions list + assign |
| `school.routes.js` | ✅ Done | `GET /profile`, `PATCH /assign-role`, `DELETE /assign-role`, `PATCH /settings` |
| `academicYear.routes.js` | ✅ Done | Full CRUD + `PATCH /:id/set-current` |
| `class.routes.js` | ✅ Done | Class CRUD stubs + mounts section routes as nested resource |
| `section.routes.js` | ✅ Done | Nested under `/classes/:classId/sections` — full CRUD |
| `student.routes.js` | ✅ Done | Student CRUD with all middlewares |
| `fee.routes.js` | ✅ Done | Vouchers + payment collection |
| `attendance.routes.js` | ✅ Done | Mark + fetch + summary |
| `dashboard.routes.js` | ✅ Done | Stats endpoint |

---

### ✅ src/api/validators/
| File | Status | Description |
|------|--------|-------------|
| `auth.validator.js` | ✅ Done | login, forgotPassword, resetPassword schemas |
| `student.validator.js` | ✅ Done | create/update student schemas |
| `fee.validator.js` | ✅ Done | voucher + collect payment schemas |
| `role.validator.js` | ✅ Done | create/update role + assign schemas |
| `academicYear.validator.js` | ✅ Done | create, update, setCurrentYear schemas |
| `section.validator.js` | ✅ Done | create/update section schemas (capacity min/max, uuid section_teacher_id) |

---

### ⏰ src/jobs/
| File | Status | Description |
|------|--------|-------------|
| `index.js` | ✅ Done | node-cron scheduler init |
| `invoice.job.js` | ✅ Done | Daily: generate SaaS invoices |
| `reminder.job.js` | ✅ Done | Daily 9AM: fee reminder SMS |
| `cleanup.job.js` | ✅ Done | Weekly: delete old temp files |

---

### 🔌 src/sockets/
| File | Status | Description |
|------|--------|-------------|
| `index.js` | ✅ Done | Socket.io setup, JWT auth, school/user rooms, emitToSchool/User |

---

### 📧 src/templates/email/
| File | Status | Description |
|------|--------|-------------|
| `welcome.hbs` | ✅ Done | Welcome email template |
| `forgot-password.hbs` | ✅ Done | Password reset template |
| `fee-reminder.hbs` | ✅ Done | Fee reminder template |
| `invoice.hbs` | ✅ Done | SaaS invoice template |

---

## 🔄 REMAINING / TODO

### 📁 Controllers (Not yet created)
| File | Priority | Description |
|------|----------|-------------|
| `teacher.controller.js` | HIGH | Teacher CRUD |
| `class.controller.js` | HIGH | Replace class route stubs with full service |
| `exam.controller.js` | HIGH | Exam CRUD + result entry |
| `user.controller.js` | HIGH | User management (admin creates users, assigns roles) |
| `report.controller.js` | MEDIUM | Financial/attendance reports |
| `subscription.controller.js` | MEDIUM | Subscription management |
| `notification.controller.js` | MEDIUM | Notification CRUD |
| `payment.controller.js` | MEDIUM | Stripe/JazzCash webhooks |

### 📁 Routes (Not yet created)
| File | Priority | Description |
|------|----------|-------------|
| `teacher.routes.js` | HIGH | |
| `exam.routes.js` | HIGH | |
| `user.routes.js` | HIGH | |
| `report.routes.js` | MEDIUM | |
| `subscription.routes.js` | MEDIUM | |
| `notification.routes.js` | MEDIUM | |
| `admin.routes.js` | MEDIUM | Master admin only routes |

### 📁 Services (Not yet created)
| File | Priority |
|------|----------|
| `teacher.service.js` | HIGH |
| `class.service.js` | HIGH — replace route stubs |
| `exam.service.js` | HIGH |
| `report.service.js` | MEDIUM |
| `subscription.service.js` | MEDIUM |
| `payment.service.js` | MEDIUM |
| `backup.service.js` | LOW |

### 📁 Models (Not yet created)
| File | Priority |
|------|----------|
| `Library.model.js` | LOW |
| `Homework.model.js` | LOW |
| `TimeTable.model.js` | LOW |

### 📁 Database Migrations
| Status | Description |
|--------|-------------|
| ⏳ Pending | Sequelize CLI migration files for all models |
| ⏳ Pending | Seeder for permissions (all PERMISSIONS constants) |
| ⏳ Pending | Seeder for Master Admin user |
| ⏳ Pending | Seeder for demo Subscription Plans (Basic/Pro/Enterprise) |

### 📁 Other Files
| File | Status | Priority |
|------|--------|----------|
| `src/jobs/backup.job.js` | ⏳ Pending | LOW |
| `src/jobs/report.job.js` | ⏳ Pending | LOW |
| `src/events/index.js` | ⏳ Pending | LOW |
| `ecosystem.config.js` | ⏳ Pending | LOW - PM2 config |
| `Dockerfile` | ⏳ Pending | LOW |
| `swagger.yaml` | ⏳ Pending | MEDIUM - API docs |
| `tests/` | ⏳ Pending | LOW |

---

## 📊 OVERALL PROGRESS

```
✅ Core Architecture     : 100%
✅ Config Files          : 100%  (permissions updated with 12 new perms)
✅ Models                : 95%  (23 models — AcademicYear + Section added; Class/School/Student/Attendance/Exam/FeeVoucher updated)
✅ Middlewares           : 100%
✅ Utils/Helpers         : 80%
✅ Services              : 75%  (11/14 — school + academicYear + section added)
✅ Controllers           : 60%  (9/15 — school + academicYear + section added)
✅ Routes                : 75%  (11/14 — school + academicYear + class/sections added)
✅ Validators            : 75%  (6/8 — academicYear + section added)
✅ Jobs                  : 60%  (3/5)
✅ Sockets               : 70%
✅ Templates             : 80%  (4/5)
⏳ Migrations/Seeders    : 0%
⏳ Tests                 : 0%
```

---

## 🚀 HOW TO RUN

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Fill in your DB, JWT, Cloudinary, Email credentials

# 3. Create PostgreSQL database
# Run in psql: CREATE DATABASE clouds_academy;

# 4. Run migrations (when created)
npm run db:migrate

# 5. Seed data (when created)
npm run db:seed

# 6. Start development server
npm run dev

# 7. Server runs at:
# http://localhost:3000
# Health: http://localhost:3000/health
# API: http://localhost:3000/api/v1
```

---

## 🏗️ NEXT STEPS (Priority Order)

1. **Create `class.service.js` + `class.controller.js`** — Replace route stubs with full implementation (branch_id validation against school.has_branches)
2. **Create `teacher.service.js` + `teacher.controller.js` + `teacher.routes.js`**
3. **Create `exam.service.js` + `exam.controller.js` + `exam.routes.js`**
4. **Create `user.controller.js` + `user.routes.js`** — Admin creates users and assigns roles
5. **Database migrations + seeders** — especially permission seeder and Master Admin seeder
6. **Create `subscription.controller.js`** — Stripe integration
7. **Create `report.controller.js`** — Financial/attendance Excel export

---

*Last updated: 28-02-2026 Phase 2 | Built with ❤️ - The Clouds Academy Team*
