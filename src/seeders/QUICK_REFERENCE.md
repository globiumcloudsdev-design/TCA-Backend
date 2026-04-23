# 🚀 Quick Reference: Seeding & Migration

## Commands Cheat Sheet

### 📌 Development Commands

```bash
# Initial seed (first time setup)
npm run seed

# Reset everything
npm run db:reset

# Specific database operations
npm run db:migrate          # Apply migrations
npm run db:migrate:undo     # Revert migrations
npm run db:seed             # Run seeders
npm run db:seed:undo        # Undo seeders
```

### 🌍 Production Migration Commands

```bash
# PRODUCTION MIGRATION (main command)
npm run migrate:prod

# Test migration (Dev DB only)
npm run migrate:dev

# Or run directly
NODE_ENV=production node src/seeders/migrate-dev-to-prod.js
```

---

## ✅ Pre-Migration Checklist

- [ ] `.env` file has `DATABASE_PROD_URL`
- [ ] Production database exists
- [ ] Production tables created (`npm run db:migrate`)
- [ ] You're in `/Backend` directory
- [ ] Development database is accessible

---

## 📊 Data Flow Diagram

```
Development Database
├── Users (MASTER_ADMIN)
├── Roles (template=true)
└── Subscription Plans
     ↓
     ↓ npm run migrate:prod
     ↓
Production Database
├── Users (MASTER_ADMIN) ← migrated
├── Roles (template=true) ← migrated
└── Subscription Plans ← migrated
```

---

## 🔍 Verification Queries

### After Development Seeding

```sql
-- Check MASTER_ADMIN
SELECT COUNT(*) FROM users WHERE user_type = 'MASTER_ADMIN';

-- Check template roles
SELECT name, code FROM roles WHERE is_template = true;

-- Check subscription plans
SELECT name, code, price FROM subscription_plans ORDER BY display_order;
```

### After Production Migration

```sql
-- Same queries on production database
SELECT COUNT(*) FROM users WHERE user_type = 'MASTER_ADMIN';
SELECT name, code FROM roles WHERE is_template = true;
SELECT name, code, price FROM subscription_plans ORDER BY display_order;
```

---

## 🚨 Common Issues & Quick Fixes

| Issue | Fix |
|-------|-----|
| "Command not found" | Make sure you're in `/Backend` directory |
| "Connection refused" | Check DATABASE_PROD_URL in .env |
| "Table doesn't exist" | Run `npm run db:migrate` first |
| "Duplicate key" | Script skips duplicates - run again |
| "Foreign key error" | Ensure parent records migrated first |

---

## 📈 What Gets Migrated

✅ **Migrated:**
- MASTER_ADMIN users (all fields)
- Template roles with permissions
- Subscription plans with features/limits

❌ **NOT Migrated:**
- Institute-specific data
- Student/teacher/parent records
- Custom roles
- School configurations

---

## 🔐 Security Notes

- Database URLs should never be in version control
- Migration script reads from BOTH databases
- Passwords are migrated as-is (must use same hashing algorithm)
- Script makes NO changes to development database
- All connections close after migration completes

---

## 📞 Quick Help

### Reset development database
```bash
npm run db:reset
```

### Check database status
```bash
# Development
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Production (if db is set)
psql $DATABASE_PROD_URL -c "SELECT COUNT(*) FROM users;"
```

### Run migration with logging
```bash
NODE_ENV=production node src/seeders/migrate-dev-to-prod.js 2>&1 | tee migration.log
```

---

## 📁 Files Created/Modified

```
Created:
✅ src/seeders/migrate-dev-to-prod.js           (main migration)
✅ src/seeders/05.migrate-dev-to-prod.seed.js   (backup)
✅ src/seeders/MIGRATION_GUIDE.md               (detailed guide)
✅ src/seeders/README.md                        (full documentation)

Modified:
✅ package.json                                 (added npm scripts)
```

---

## ⏱️ Estimated Time

- **Development Seeding:** 2-5 seconds
- **Production Migration:** 5-10 seconds per 100 records
- **Verification:** < 1 second

---

**For detailed help, see:** [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)  
**For full docs, see:** [README.md](./README.md)

Last Updated: April 20, 2026
