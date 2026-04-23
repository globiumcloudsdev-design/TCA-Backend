# 🚀 Backend Seeding & Migration System

Complete guide for development seeding and production migration.

---

## 📋 Table of Contents

1. [Quick Commands](#quick-commands)
2. [Development Seeding](#development-seeding)
3. [Production Migration](#production-migration)
4. [Script Descriptions](#script-descriptions)
5. [Troubleshooting](#troubleshooting)

---

## ⚡ Quick Commands

### Development Environment Only

```bash
cd Backend

# Initial seed for development
npm run seed

# Reset entire dev DB
npm run db:reset
```

### Production Migration (From Dev → Prod)

```bash
cd Backend

# Migrate template data to production
npm run migrate:prod
```

### Testing Migration (Dev DB → Dev DB)

```bash
cd Backend

# Run migration locally for testing
npm run migrate:dev
```

---

## 🔧 Development Seeding

### What Happens

When you run `npm run seed`, the following seeders execute in order:

1. **00.instituteTypes.seed.js** - Institute types (School, College, University, etc.)
2. **01.roles.seed.js** - Template roles for all user types
3. **02.subscriptionPlans.seed.js** - BASIC, STANDARD, PREMIUM, ENTERPRISE plans
4. **03.masterAdmin.seed.js** - Master admin user for platform access
5. **04.leaveTypes.seed.js** - Leave types for the first institute

### Command

```bash
npm run seed
```

### Output Example

```
╔══════════════════════════════════════════════════════╗
║   The Clouds Academy — Database Seeder               ║
╚══════════════════════════════════════════════════════╝

✅ Database connected!
📌 Syncing schemas...
✅ Schema sync complete

🌳 Seeding Institute Types...
   ✅ School
   ✅ College
   ✅ University

🔐 Seeding Template Roles...
   ✅ Institute Admin
   ✅ Teacher
   ...

📊 Seeding Subscription Plans...
   ✅ BASIC (PKR 0)
   ✅ PREMIUM (PKR 5000)
   ...

✨ Seeding complete!
```

---

## 🌍 Production Migration

### What Gets Migrated

From **Development DB** → **Production DB**:
- ✅ MASTER_ADMIN users
- ✅ Template roles (is_template = true)
- ✅ All subscription plans

**NOT migrated:**
- ❌ Institute-specific data (custom roles, etc.)
- ❌ Student/teacher/parent data
- ❌ School/branch specific configurations

### Setup

Ensure `.env` has both database URLs:

```env
DATABASE_URL=postgresql://...development...
DATABASE_PROD_URL=postgresql://...production...
```

### Command

```bash
npm run migrate:prod
```

### Output Example

```
🚀 Running in MODE: production
Database Connection: Production

🔗 Checking database connections...
✅ Dev DB connected
✅ Prod DB connected

👤 [1/3] Migrating MASTER_ADMIN users...
  ✅ Created: John Doe (admin@example.com)

🔐 [2/3] Migrating Template Roles...
  ✅ Created: Institute Admin
  ✅ Created: Teacher
  ✅ Created: Student
  ✅ Created: Parent

📊 [3/3] Migrating Subscription Plans...
  ✅ Created: BASIC (PKR 0)
  ✅ Created: STANDARD (PKR 2500)
  ✅ Created: PREMIUM (PKR 5000)
  ✅ Created: ENTERPRISE (Custom)

📋 Migration Summary:
  ✅ MASTER_ADMIN users migrated: 1
  ✅ Template roles migrated: 4
  ✅ Subscription plans migrated: 4
  ⏭️  Records skipped (already exist): 0

✨ Migration completed successfully!
```

### Safety Features

✅ **Duplicate Detection** - Skips records that already exist  
✅ **Error Handling** - Continues on individual record errors  
✅ **Read-Only from Dev** - Dev DB is never modified  
✅ **Connection Verification** - Verifies both DBs before starting  
✅ **Clean Disconnection** - Closes connections gracefully  

---

## 📁 Script Descriptions

### Seeding Scripts (Development)

| Script | Purpose | Frequency |
|--------|---------|-----------|
| `00.instituteTypes.seed.js` | Creates institute type options | Once, on first setup |
| `01.roles.seed.js` | Creates template roles for permissions | Once, on first setup |
| `02.subscriptionPlans.seed.js` | Creates subscription plans | Once, on first setup |
| `03.masterAdmin.seed.js` | Creates master admin user | Once, on first setup |
| `04.leaveTypes.seed.js` | Creates leave type options | Once per institute |

### Migration Scripts (Dev → Prod)

| Script | Purpose | When to Use |
|--------|---------|------------|
| `migrate-dev-to-prod.js` | Production-ready migration | Migrating to production |
| `05.migrate-dev-to-prod.seed.js` | Legacy migration (backup) | If main script fails |

### Configuration Files

| File | Purpose |
|------|---------|
| `MIGRATION_GUIDE.md` | Detailed migration documentation |
| `index.seed.js` | Main development seeder orchestrator |

---

## 🗂️ File Structure

```
Backend/
├── src/
│   └── seeders/
│       ├── 00.instituteTypes.seed.js       ← Dev seeding
│       ├── 01.roles.seed.js                 ← Dev seeding
│       ├── 02.subscriptionPlans.seed.js     ← Dev seeding
│       ├── 03.masterAdmin.seed.js           ← Dev seeding
│       ├── 04.leaveTypes.seed.js            ← Dev seeding
│       ├── 05.migrate-dev-to-prod.seed.js   ← Backup migration
│       ├── migrate-dev-to-prod.js           ← Production migration ⭐
│       ├── index.seed.js                    ← Dev orchestrator
│       ├── seed-leave-types-only.js         ← Utility for leave types
│       ├── MIGRATION_GUIDE.md               ← Migration documentation
│       └── README.md                        ← This file
```

---

## 🔄 Workflow Examples

### Scenario 1: Fresh Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Run migrations (create tables)
npm run db:migrate

# 3. Seed with template data
npm run seed

# 4. Start development server
npm run dev
```

### Scenario 2: Deploy to Production

```bash
# 1. Create new fresh production database

# 2. Run migrations on production
npm run db:migrate

# 3. Migrate template data from dev to prod
npm run migrate:prod

# 4. Deploy backend code
git push origin main
```

### Scenario 3: Reset Development Database

```bash
# Complete reset: undo migrations, re-migrate, re-seed
npm run db:reset

# Or manually:
npm run db:migrate:undo:all   # Undo all migrations
npm run db:migrate            # Re-apply all migrations
npm run seed                  # Re-seed template data
```

### Scenario 4: Add New Leave Types to Existing Institute

```bash
node src/seeders/seed-leave-types-only.js
```

---

## ✅ Verification

After running any seeding/migration, verify in database:

### Development
```sql
SELECT COUNT(*) FROM users WHERE user_type = 'MASTER_ADMIN';
SELECT COUNT(*) FROM roles WHERE is_template = true;
SELECT COUNT(*) FROM subscription_plans;
```

### Production (after migration)
```sql
-- Should show same counts as development
SELECT COUNT(*) FROM users WHERE user_type = 'MASTER_ADMIN';
SELECT COUNT(*) FROM roles WHERE is_template = true;
SELECT COUNT(*) FROM subscription_plans;

-- Verify master admin can login
SELECT id, email, user_type FROM users WHERE user_type = 'MASTER_ADMIN';
```

---

## 🚨 Troubleshooting

### Issue: "Cannot find seed file"

```
Error: ENOENT: no such file or directory
```

**Solution:**
```bash
# Ensure you're in the Backend directory
cd Backend

# Check file exists
ls -la src/seeders/migrate-dev-to-prod.js
```

### Issue: "Database connection refused"

```
Error: connect ECONNREFUSED
```

**Solution:**
```bash
# Verify .env has correct URLs
cat .env | grep DATABASE

# Test connection with a SQL client
psql "postgresql://..."
```

### Issue: "Foreign key constraint failed"

```
SequelizeConnectionRefusedError: foreign key constraint
```

**Solution:**
```bash
# Ensure parent records exist
# Run migration in correct order (roles before users, etc.)

# If stuck, you can disable FK temporarily:
-- In SQL client:
ALTER TABLE users DISABLE TRIGGER ALL;
-- Run migration
ALTER TABLE users ENABLE TRIGGER ALL;
```

### Issue: "Enum value not recognized"

```
Error: invalid input value for enum
```

**Solution:**
```bash
# Ensure production DB has same enum types
# Check enum in schema:
SELECT enum_range(NULL::user_type);

# May need to add enum value:
ALTER TYPE user_type ADD VALUE 'NEW_TYPE';
```

### Issue: "Duplicate key value violates unique constraint"

```
Error: duplicate key value violates unique constraint
```

**Solution:**
- This is normal if running migration twice
- Script automatically skips duplicates
- Run migration again - it will skip existing records

---

## 📚 Related Documentation

- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Detailed migration guide
- [Database Config](../config/database.js) - Database connection setup
- [Models Index](../models/postgres/index.js) - All model definitions
- [Backend README](../README.md) - Backend setup instructions

---

## 💡 Best Practices

✅ **Do:**
- Run `npm run seed` before starting development
- Always run migrations before deploying
- Use `npm run migrate:prod` for production migrations
- Verify data after migration with SQL queries
- Keep `.env` file secure (don't commit to repo)

❌ **Don't:**
- Run seeding scripts directly in production (use migration script)
- Modify seed scripts without testing locally first
- Commit `.env` file with real database URLs
- Run migrations with `force: true` on production DB
- Delete records directly without backup

---

## 📞 Need Help?

1. Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed steps
2. Review error messages carefully - they often indicate the exact issue
3. Verify database connections in `.env`
4. Ensure migration files have correct permissions
5. Check database user has appropriate privileges

---

**Last Updated:** April 20, 2026  
**Version:** 2.0  
**Status:** Production Ready ✅
