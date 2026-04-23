# Development to Production Migration Guide

## 📋 Overview

This script safely migrates **template data only** from Development DB to Production DB:
- ✅ MASTER_ADMIN users
- ✅ Template roles (is_template = true)
- ✅ Subscription plans

**Custom institute data remains in dev DB** - this is intentional for data isolation.

---

## 🚀 Quick Start

### Option 1: Run with Environment Variable (Recommended)

```bash
cd Backend

# Run production migration
NODE_ENV=production node src/seeders/migrate-dev-to-prod.js
```

### Option 2: Run with Default Settings

```bash
cd Backend

# Loads DATABASE_URL and DATABASE_PROD_URL from .env
node src/seeders/migrate-dev-to-prod.js
```

---

## ⚙️ Prerequisites

### 1. Environment Variables (.env)

Make sure your `.env` file has both database URLs:

```env
# Development Database
DATABASE_URL=postgresql://Globium%20Clouds:npg_iDZ4CvJM1Nay@ep-calm-bird-a1284utj-pooler.ap-southeast-1.aws.neon.tech/The%20Clouds%20Academy?sslmode=require&channel_binding=require

# Production Database  
DATABASE_PROD_URL=postgresql://Globium%20Clouds:npg_iDZ4CvJM1Nay@ep-calm-bird-a1284utj.ap-southeast-1.aws.neon.tech/The-Clouds-Academy-Production?sslmode=require&channel_binding=require
```

### 2. Production DB Tables Must Exist

Before running this script, ensure that your production database has the required tables:
- `users`
- `roles`
- `subscription_plans`

If tables don't exist, run your migrations on production first:

```bash
npx sequelize-cli db:migrate --env production
```

---

## 📊 What Gets Migrated

### MASTER_ADMIN Users
- Users with `user_type = 'MASTER_ADMIN'`
- Includes: name, email, password hash, permissions, avatar, QR code, etc.
- **Note:** Password hashes are migrated as-is. Make sure to use the same hashing algorithm on both DBs.

### Template Roles
- Roles with `is_template = true`
- Includes all permissions for different user types
- Used as blueprints for institute role creation

### Subscription Plans
- All plans: BASIC, STANDARD, PREMIUM, ENTERPRISE
- Includes: pricing, limits, features, metadata
- Used for institute subscriptions

---

## ⚠️ Safety Features

✅ **Duplicate Prevention**
- Script checks if record already exists before inserting
- Skips duplicates gracefully

✅ **Error Handling**
- Individual record errors don't stop the process
- All errors are logged and displayed at the end

✅ **Read-Only from Dev DB**
- Dev DB is only read from, never modified
- Prod DB is only written to

✅ **Connection Verification**
- Both databases are verified before migration
- Disconnects gracefully after completion

---

## 📈 Expected Output

```
🚀 Running in MODE: production
Database Connection: Production

🔗 Checking database connections...
✅ Dev DB connected
✅ Prod DB connected

👤 [1/3] Migrating MASTER_ADMIN users...
  ✅ Created: John Doe (admin@thecloudz.com)

🔐 [2/3] Migrating Template Roles...
  ✅ Created: Institute Admin (INSTITUTE_ADMIN)
  ✅ Created: Teacher (TEACHER)
  ✅ Created: Student (STUDENT)

📊 [3/3] Migrating Subscription Plans...
  ✅ Created: Basic Plan (BASIC)
  ✅ Created: Premium Plan (PREMIUM)

📋 Migration Summary:
  ✅ MASTER_ADMIN users migrated: 1
  ✅ Template roles migrated: 3
  ✅ Subscription plans migrated: 4
  ⏭️  Records skipped (already exist): 0
  📊 Total processed: 8

✨ Migration completed successfully!
```

---

## 🔄 Rollback / Recovery

If something goes wrong:

1. **Check what was migrated:**
```sql
-- In production DB
SELECT user_type, COUNT(*) FROM users GROUP BY user_type;
SELECT is_template, COUNT(*) FROM roles GROUP BY is_template;
SELECT COUNT(*) FROM subscription_plans;
```

2. **Delete migrated records if needed:**
```sql
-- In production DB (careful with this!)
DELETE FROM users WHERE user_type = 'MASTER_ADMIN';
DELETE FROM roles WHERE is_template = true;
DELETE FROM subscription_plans;
```

3. **Re-run the migration:**
```bash
NODE_ENV=production node src/seeders/migrate-dev-to-prod.js
```

---

## 🧪 Testing the Migration

After migration, verify in production DB:

```sql
-- Check MASTER_ADMIN users
SELECT id, first_name, last_name, email, user_type FROM users WHERE user_type = 'MASTER_ADMIN';

-- Check template roles
SELECT id, name, code, is_template FROM roles WHERE is_template = true ORDER BY code;

-- Check subscription plans
SELECT id, name, code, cycle, price FROM subscription_plans ORDER BY code;

-- Verify relationships (if foreign keys exist)
SELECT COUNT(*) FROM users WHERE role_id IS NOT NULL;
```

---

## 🚨 Troubleshooting

### "Connection refused" error
- ✅ Check if URLs in .env are correct
- ✅ Verify internet connection
- ✅ Check firewall/VPN settings
- ✅ Test connection strings manually in a SQL client

### "Table does not exist" error
- ✅ Run migrations on production first:
  ```bash
  npx sequelize-cli db:migrate --env production
  ```

### "Enum value not recognized" error
- ✅ Ensure production DB has same ENUM types defined
- ✅ MySQL vs PostgreSQL might have different ENUM handling

### "Foreign Key constraint error"
- ✅ Check if referenced records exist
- ✅ Migrate parent records first
- ✅ Temporarily disable foreign key checks if needed

---

## 📝 Script Files

Two scripts are provided:

1. **05.migrate-dev-to-prod.seed.js** (Older version)
   - Simple, straightforward migration
   - Use if you prefer basic approach

2. **migrate-dev-to-prod.js** (Recommended)
   - Enhanced error handling
   - Better logging
   - Environment variable support
   - Skips duplicate records gracefully

---

## ✨ After Migration

Once migration is complete:

1. ✅ Verify all data in production
2. ✅ Update any API configurations to point to production DB if needed
3. ✅ Test login with migrated MASTER_ADMIN user
4. ✅ Verify subscription plans are available
5. ✅ Check role permissions are working correctly

---

## 📞 Support

If you encounter issues:
1. Check the full error message in console
2. Review this guide's troubleshooting section
3. Check database connection strings in .env
4. Verify production tables exist and have correct structure

---

**Last Updated:** April 20, 2026  
**Script Version:** 2.0  
**Status:** Production Ready ✅
