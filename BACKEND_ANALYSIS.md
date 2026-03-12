# The Clouds Academy — Backend ka Mukammal Jaiza
## (Roman Urdu mein — Developer Reference)

> **File Location:** `backend/BACKEND_ANALYSIS.md`  
> **Last Updated:** March 2026  
> **Purpose:** Poora backend architecture, user system, permissions, aur flow ek jagah detail mein

---

## 1. Backend Ki Buniyad (Technology Stack)

```
Language:     Node.js (ES6 Modules — import/export)
Framework:    Express.js
Database:     PostgreSQL (Sequelize ORM)
Auth:         JWT (Access Token + Refresh Token)
File Upload:  Multer + Cloudinary
Email:        Nodemailer
SMS:          Twilio
Payment:      Stripe + JazzCash
Jobs:         node-cron (background tasks)
Logging:      Winston + Morgan
Security:     Helmet, XSS-clean, HPP, express-mongo-sanitize, CORS
Env:          dotenv (.env file)
```

**Base URL:** `http://localhost:3000`  
**API Prefix:** `/api/v1/...`  
**Port:** `.env` mein `PORT` variable se — default `3000`

---

## 2. Folder Structure ka Matlab

```
backend/
├── server.js              ← Entry point — server start hota hai yahan se
├── src/
│   ├── app.js             ← Express app configure hoti hai yahan (middlewares, routes)
│   ├── api/
│   │   ├── controllers/   ← Request handle karte hain (HTTP layer)
│   │   ├── middlewares/   ← Auth check, permissions, logging, etc.
│   │   ├── routes/v1/     ← URL routing — kaun sa URL kaun se controller pe jata hai
│   │   └── validators/    ← Request body validation (Joi/express-validator)
│   ├── config/
│   │   ├── index.js       ← Tamam env variables ki config — SINGLE SOURCE OF TRUTH
│   │   ├── auth.js        ← JWT sign/verify functions
│   │   ├── database.js    ← Sequelize connection
│   │   ├── permissions.js ← Permission constants + group config
│   │   ├── cors.js        ← CORS settings
│   │   ├── email.js       ← Nodemailer transport
│   │   ├── multer.js      ← File upload config
│   │   ├── cloudinary.js  ← Image upload to Cloudinary
│   │   ├── sms.js         ← Twilio SMS
│   │   ├── payment.js     ← Stripe + JazzCash
│   │   ├── logger.js      ← Winston logger
│   │   └── rateLimit.js   ← Rate limiting config
│   ├── models/postgres/   ← Database tables (Sequelize models)
│   ├── services/          ← Business logic yahan hoti hai (controllers lean rehte hain)
│   ├── jobs/              ← Background cron jobs
│   ├── sockets/           ← Socket.IO real-time events
│   ├── templates/email/   ← Email HTML templates
│   └── utils/
│       ├── helpers/       ← Response helper, password helper, etc.
│       └── lib/           ← AppError class, catchAsync wrapper
└── public/
    ├── uploads/           ← Local file storage (profiles, documents, temp)
    └── downloads/         ← Generated reports export files
```

---

## 3. User System — Kaise Kaam Karta Hai

### 3.1 User Model (`users` table)

```
Column               Description
─────────────────────────────────────────────────────────
id                   UUID — primary key
school_id            NULL agar Master Admin ho, warna institute ka UUID
branch_id            Optional — kaunse branch ka user hai (agar institute mein branches hain)
first_name           
last_name            
email                Unique — login ke liye
phone                Optional
password_hash        bcrypt se hash hota hai (saltRounds = 10)
role_code            ENUM: 'MASTER_ADMIN' ya 'SCHOOL_USER' — do hi values
                     NOTE: Yeh sirf top-level category hai, actual role UserRole table mein hai
avatar_url           Cloudinary URL
is_active            true/false — deactivate kar sakte hain account
last_login_at        Login pe update hota hai
password_reset_token 32 bytes random hex — forgot password ke liye
password_reset_expires 30 minutes expiry
email_verified       Abhi sirf field hai — verification flow future mein
```

### 3.2 User Ke Do Levels

```
MASTER_ADMIN
  └── role_code = 'MASTER_ADMIN'
  └── school_id = NULL
  └── Kisi bhi permission check se bypass
  └── Permissions: ['ALL'] — login pe directly return
  └── Sirf ek ya kuch platform-level users hote hain

SCHOOL_USER
  └── role_code = 'SCHOOL_USER'
  └── school_id = (kisi institute ka UUID)
  └── Actual permissions → UserRole → Role → RolePermissions → Permission table se aati hain
  └── Har school apni dynamic roles bana sakti hai
```

---

## 4. Authentication Flow — Step by Step

### 4.1 Login

```
Client → POST /api/v1/auth/login
         Body: { email, password }
         ↓
[auth.controller.js] login()
         ↓
[auth.service.js] loginService()
  1. User email se dhundho (scope: withPassword — password_hash include karta hai)
  2. user nahi mila → 401 "Invalid email or password"
  3. is_active = false → 403 "Account is deactivated"
  4. bcrypt.compare(password, password_hash) → match nahi → 401
  5. last_login_at update karo
  6. agar MASTER_ADMIN:
       roleData = { code: 'MASTER_ADMIN', name: 'Master Admin' }
       permissions = ['ALL']
  7. agar SCHOOL_USER:
       UserRole → Role → RolePermissions → Permission load karo
       permissions = ['student.create', 'fee.read', ...] wali dot-notation strings
  8. JWT tokens generate karo:
       accessToken  → { userId, schoolId, roleCode } → JWT_SECRET → expires 7 days
       refreshToken → { userId } → JWT_REFRESH_SECRET → expires 30 days
  ↓
Response:
  - accessToken: HTTP response body mein aata hai
  - refreshToken: httpOnly cookie mein set hota hai (JS se access nahi hoti)
  - user: { id, firstName, lastName, email, schoolId, role, permissions, avatarUrl }
```

### 4.2 Request Pe Auth Check

```
Client → GET /api/v1/students (ya koi bhi protected route)
          Header: Authorization: Bearer <accessToken>
          ya cookie: accessToken=<token>
         ↓
[auth.middleware.js] protect()
  1. Header se ya cookie se token nikalo
  2. Token nahi → 401 "No token provided"
  3. jwt.verify(token, JWT_SECRET) → invalid/expired → 401
  4. decoded.userId se User.findByPk() karo (password_hash exclude)
  5. User nahi mila → 401
  6. is_active = false → 403
  7. req.user = user (baad ke middleware ko milta hai)
         ↓
[permission.middleware.js] hasPermission('student.read')
  1. req.user.role_code === 'MASTER_ADMIN' → skip → next() (bypass)
  2. userId se UserRole → Role → RolePermissions → Permission load karo
  3. permissions ka Set banao: { 'student.read', 'fee.create', ... }
  4. requiredPermission Set mein hai → next()
  5. nahi hai → 403 "Access denied. Required permission: student.read"
```

### 4.3 Token Refresh

```
Client → POST /api/v1/auth/refresh-token
          Body ya cookie: refreshToken
         ↓
jwt.verify(refreshToken, JWT_REFRESH_SECRET)
  → User dhundho
  → Naya accessToken generate karo
  → Return karo
```

### 4.4 Logout

```
Client → POST /api/v1/auth/logout
         ↓
res.clearCookie('refreshToken')
→ 200 "Logged out successfully"

NOTE: accessToken ko server side revoke nahi kiya jata abhi.
      Token expire hone tak valid rehta hai.
      Production mein Redis blacklist add karni chahiye.
```

---

## 5. Role & Permission System — Dynamic Roles

### 5.1 Tables Ka Rishta

```
users table
  id, role_code ('SCHOOL_USER'), school_id
    │
    ↓
user_roles table (junction)
  id, user_id, role_id, branch_id, is_active, expires_at, assigned_by
    │
    ↓
roles table (dynamic — har school ki apni)
  id, school_id, name, code, description, is_active, created_by
    │
    ↓
role_permissions table (junction)
  id, role_id, permission_id, is_allowed
    │
    ↓
permissions table (static — seeded on init)
  id, module, action, name, description, group
  example: module='fee', action='collect', name='Collect Fee Payment'
```

### 5.2 Permission String Format

```
module.action format use hoti hai:

student.create    → Student create karna
student.read      → Students ki list dekhna
fee.collect       → Fee voucher pe payment collect karna
attendance.mark   → Attendance mark karna
exam.result.enter → Exam ke results enter karna

Permission check: permissionsSet.has('student.create')
```

### 5.3 Role Assignment Flow

```
1. Institute Admin → New Role banana:
   POST /api/v1/roles
   Body: { name: 'Class Teacher', code: 'CLASS_TEACHER', description: '...' }
   → roles table mein entry

2. Role ko permissions assign karna:
   POST /api/v1/roles/:roleId/permissions
   Body: { permission_ids: ['uuid1', 'uuid2', ...] }
   → role_permissions table mein entries (is_allowed = true)

3. User ko role assign karna:
   PATCH /api/v1/users/:userId/assign-role
   Body: { role_id: 'uuid' }
   → user_roles table mein entry (is_active = true)
```

### 5.4 School Ko Role Assign Karna (Subscription Role)

```
Yeh ek alag concept hai — School ke "plan level" ke liye hai.

School model mein: role_id field hai
Master Admin assign karta hai: PATCH /api/v1/schools/assign-role

Iska matlab: Yeh school Basic plan mein hai ya Premium mein.
Subscription role se decide hota hai ke school ke users
kaun kaun se modules access kar sakte hain.
```

---

## 6. School Context Middleware

### Har school user ke request pe yeh hota hai:

```
[schoolContext.middleware.js]

1. MASTER_ADMIN → skip (school_id nahi hota uske paas)

2. req.user.school_id se School.findByPk()
   → school nahi mila → 403

3. school.is_active = false → 403 "School subscription is inactive"

4. req.school = school  ← Baad ke sab middleware/controller use karte hain

5. Branch context:
   agar school.has_branches = true:
     → X-Branch-ID header check karo
     → user.branch_id check karo
     → koi nahi mila → null (school-wide scope)
   agar has_branches = false:
     → req.branch_id = null

NOTE: Branch context ka faida:
  Service layer mein: WHERE branch_id = req.branch_id (ya school-wide)
  Isse data isolation hoti hai branches ke beech
```

---

## 7. Subscription Check Middleware

```
[subscription.middleware.js]

1. MASTER_ADMIN → skip
2. req.school ki subscription_status check karo:
   - 'expired' → 402 "School subscription has expired. Please renew."
   - 'suspended' → 403 "School account has been suspended. Contact support."
   - 'trial' / 'active' → allow karo
```

---

## 8. Audit Log Middleware

```
[audit.middleware.js]

Har mutating request (POST, PUT, PATCH, DELETE) pe:
  → Response successful (status < 400) hone ke baad:
  → Winston logger mein likho:

Format:
[AUDIT] POST /api/v1/students | User: uuid | School: uuid | Branch: uuid | Status: 201

Database mein AuditLog table bhi hai (AuditLog.model.js):
  user_id, school_id, action, resource, resource_id, old_values, new_values
```

---

## 9. Rate Limiting

```
[rateLimit.middleware.js]

Sirf /api/* routes pe lagu hota hai:
  - Window: 15 minutes (configurable via .env RATE_LIMIT_WINDOW_MS)
  - Max requests: 100 per window (RATE_LIMIT_MAX)
  - Agar exceed ho → 429 Too Many Requests

Purpose: Brute force aur DDoS se bachao
```

---

## 10. Registered API Routes (v1)

```
Base: /api/v1

Auth:
  POST   /auth/login                 ← Login
  POST   /auth/logout                ← Logout (cookie clear)
  POST   /auth/refresh-token         ← Refresh access token
  POST   /auth/forgot-password       ← Password reset email bhejna
  POST   /auth/reset-password        ← New password set karna
  GET    /auth/me                    ← Apna profile dekhna

Schools (school-level):
  GET    /schools/profile            ← Apne school ka profile
  PATCH  /schools/assign-role        ← School ko role assign karna
  DELETE /schools/assign-role        ← Role remove karna
  PATCH  /schools/settings           ← Settings update (branches toggle, etc.)

Academic Years:
  GET    /academic-years             ← List
  POST   /academic-years             ← Create
  GET    /academic-years/:id
  PUT    /academic-years/:id
  DELETE /academic-years/:id         ← Soft delete
  PATCH  /academic-years/:id/set-current

Classes + Sections:
  GET    /classes
  POST   /classes
  GET    /classes/:id
  PUT    /classes/:id
  DELETE /classes/:id
  GET    /classes/:classId/sections
  POST   /classes/:classId/sections
  GET    /classes/:classId/sections/:id
  PUT    /classes/:classId/sections/:id
  DELETE /classes/:classId/sections/:id

Roles (Dynamic):
  GET    /roles
  POST   /roles
  GET    /roles/:id
  PUT    /roles/:id
  DELETE /roles/:id
  GET    /roles/permissions          ← All permissions list (for UI checkboxes)
  POST   /roles/:id/permissions      ← Role ko permissions set karna
  POST   /roles/:id/assign           ← Role users ko assign karna

Students:
  GET    /students
  POST   /students
  GET    /students/:id
  PUT    /students/:id
  DELETE /students/:id

Fees:
  GET    /fees/vouchers
  POST   /fees/vouchers
  GET    /fees/vouchers/:id
  PUT    /fees/vouchers/:id
  PATCH  /fees/vouchers/:id/collect  ← Payment collect karna
  GET    /fees/payments

Attendance:
  GET    /attendance
  POST   /attendance/bulk            ← Bulk attendance mark karna
  GET    /attendance/student/:id
  GET    /attendance/summary/:classId

Dashboard:
  GET    /dashboard                  ← Stats: students, fees, attendance summary

Health:
  GET    /health                     ← Server alive check
  GET    /api/v1/ping                ← Version ping
```

---

## 11. Background Jobs (node-cron)

```
3 scheduled jobs hain:

1. Invoice Job — Har raat midnight (0 0 * * *)
   → Monthly invoices generate karo active subscriptions ke liye

2. Fee Reminder Job — Har roz subah 9 AM (0 9 * * *)
   → Students jinki fee due hai unhe reminder bhejo (SMS ya email)

3. Cleanup Job — Har Sunday raat 2 AM (0 2 * * 0)
   → public/uploads/temp/ se puranay temporary files delete karo
```

---

## 12. Security Measures (OWASP)

```
1. Helmet        → HTTP security headers (XSS, HSTS, CSP, etc.)
2. CORS          → Sirf allowed origins se requests
3. express-mongo-sanitize → NoSQL injection prevent (MongoDB operators sanitize)
4. xss-clean     → XSS prevent — request body se malicious scripts clean
5. hpp           → HTTP Parameter Pollution prevent
6. bcrypt        → Password hashing (saltRounds: 10)
7. JWT           → Stateless auth — short-lived access tokens
8. httpOnly Cookie → refreshToken JS se accessible nahi
9. Rate Limiting → Brute force se bachao
10. Input Validation → validators/ mein request body validate
11. Audit Logs   → Har mutating action log hoti hai
12. Soft Delete  → Data permanently delete nahi hota
13. Environment Variables → .env mein secrets, code mein nahi
```

---

## 13. Database Models — Tamam Tables

```
Table                  Description
─────────────────────────────────────────────────────────────────
users                  Platform ke tamam users (Master Admin + School users)
schools                Institutes (har school/college/coaching ek row)
school_subscriptions   Har school ki active subscription detail
subscription_plans     Available plans (Basic, Standard, Premium, Enterprise)
roles                  Dynamic roles — har school ki apni
permissions            Static permission list (seeded — module + action pairs)
role_permissions       Role aur permission ka rishta (junction table)
user_roles             User aur role ka rishta (junction table)
students               Institute ke tamam students
teachers               Institute ke tamam teaching/non-teaching staff
parents                Students ke parents
classes                Classes/Grades (school), Courses (coaching), Programs (college)
sections               Class ke andar sections (A, B, C)
subjects               Subjects / courses taught
academic_years         Academic session records
attendance             Daily attendance records
exam                   Exam records
exam_results           Student-wise exam results
fee_vouchers           Fee dues (har student ka monthly voucher)
fee_payments           Collected payments
invoices               Billing invoices for subscriptions
notifications          In-app notifications
audit_logs             Every mutating action ka trail
```

---

## 14. Master Admin ka Special Flow

```
Master Admin LOGIN:
  POST /api/v1/auth/login
  → loginService check karta hai: user.role_code === 'MASTER_ADMIN'
  → Dynamic role load nahi karta (UserRole table nahi dekhta)
  → permissions = ['ALL'] directly return karta hai
  → Frontend isko receive kar ke store mein save karta hai

Master Admin KISI BHI ROUTE PE:
  → protect() middleware → JWT verify → req.user attach
  → schoolContext() → role_code MASTER_ADMIN → skip (school dhundne ki zaroorat nahi)
  → subscription check → skip
  → hasPermission() → role_code MASTER_ADMIN → skip → next()
  → Controller direct call hota hai

Matlab: Master Admin ke liye koi bhi permission check apply nahi hota.
        Woh platform ka owner hai — tamam kuch access kar sakta hai.
```

---

## 15. Frontend Se Backend Ka Connection

```
Frontend (Next.js):
  src/lib/api.js     ← Axios instance — Authorization header automatically add hota hai
  src/services/      ← Har module ka service (API calls)
  src/store/authStore.js ← Zustand store — user + tokens store hote hain

Flow:
  1. User login karta hai → authService.login() call
  2. Backend accessToken return karta hai
  3. authStore mein save hota hai (memory + localStorage/cookie)
  4. Har API call pe axios interceptor Bearer token add karta hai
  5. 401 response aye → refresh token se naya access token lo
  6. Agar refresh bhi fail → logout aur login page pe redirect

Headers jo backend expect karta hai:
  Authorization: Bearer <accessToken>   ← Har authenticated request pe
  X-School-Code: SPRINGS001               ← School identify karne ke liye (optional)
  X-Branch-ID: <uuid>                     ← Branch context (optional)
```

---

## 16. Kya Kya Abhi Nahi Bana / Future Work

```
Backend mein ye cheezein abhi exist nahi kartein ya incomplete hain:

1. Master Admin ke routes (admin panel backend):
   → /api/v1/admin/schools, /api/v1/admin/subscriptions, etc.
   → Abhi sirf school-level routes hain
   → Master Admin frontend dummy data use kar raha hai

2. Email verification flow:
   → email_verified field hai magar send verification email route nahi

3. Token blacklist (Redis):
   → Logout ke waqt accessToken still valid rehta hai
   → Production ke liye Redis mein blacklist banana chahiye

4. WebSocket / Socket.IO:
   → sockets/index.js exist karta hai magar routes se connect nahi

5. Subject routes:
   → Subject model hai, apiEndpoints mein SUBJECTS hai
   → Magar routes/v1/ mein subject.routes.js nahi dikha

6. Exam, Payroll, Notification routes:
   → Models hain, endpoints define hain
   → Magar routes registered nahi v1/index.js mein

7. Branch management routes:
   → Branch model zaroor hoga magar routes nahi bane abhi

8. Forgot/Reset password email:
   → forgotPasswordService token banata hai
   → sendPasswordResetEmail call hoti hai
   → Email template banana baqi hai

9. Stripe webhook:
   → config mein webhookSecret hai
   → Webhook handler route abhi nahi bana

10. Rate limiting per-user:
    → Abhi global IP-based hai
    → User-specific rate limiting add karni chahiye
```

---

## 17. .env Variables Jo Chahiye

```
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clouds_academy
DB_USER=postgres
DB_PASSWORD=yourpassword

# JWT
JWT_SECRET=aik-bohat-lamba-secret-string
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=aik-aur-lamba-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Email (Gmail / SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=app-password
EMAIL_FROM=noreply@thecloudsacademy.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Twilio SMS (Optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Stripe (Optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Frontend URL (CORS ke liye)
FRONTEND_URL=http://localhost:3001
```

---

## 18. Quick Summary — Aik Nazar Mein

```
┌─────────────────────────────────────────────────────────────┐
│  User Login karta hai                                        │
│    → JWT access token milta hai (7 din)                     │
│    → Refresh token httpOnly cookie mein (30 din)            │
│                                                              │
│  Har request pe:                                            │
│    1. JWT verify (protect middleware)                       │
│    2. School context resolve (schoolContext)                │
│    3. Subscription check                                    │
│    4. Permission check (hasPermission)                      │
│    5. Controller run hota hai                               │
│                                                              │
│  MASTER_ADMIN steps 2,3,4 skip karta hai                   │
│                                                              │
│  Permissions system:                                        │
│    School → Role → RolePermissions → Permission             │
│    "module.action" dot-notation strings                     │
│    Database mein stored (dynamic)                           │
│                                                              │
│  Two-token strategy:                                        │
│    accessToken  = short-lived (request header mein)         │
│    refreshToken = long-lived (httpOnly cookie mein)         │
└─────────────────────────────────────────────────────────────┘
```

---

*Yeh document backend ka poora jaiza hai. Koi bhi cheez samajh nahi aye to directly code dekho aur is document se match karo.*
