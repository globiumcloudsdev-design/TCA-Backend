/**
 * The Clouds Academy - PostgreSQL Database Config
 * Sequelize ORM with connection pooling, retry logic, soft deletes
 */

import { Sequelize } from 'sequelize';
import config from './index.js';
import logger from './logger.js';

// Shared Sequelize options (define, pool, logging)
const sharedOptions = {
  dialect: 'postgres',
  pool: config.database.pool,
  logging: config.isDevelopment ? (msg) => logger.debug(msg) : false,
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true, // Soft deletes enabled
  },
};

// Parse DATABASE_URL manually so URL-encoded chars (%20 spaces etc.) are decoded
// Sequelize v6's built-in URL parsing does not decode path/auth segments.
const _parseDbUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  return {
    database: decodeURIComponent(url.pathname.slice(1)), // strip leading '/'
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host:     url.hostname,
    port:     parseInt(url.port, 10) || 5432,
  };
};

// Use DATABASE_URL (Neon / cloud) if provided, otherwise fall back to individual vars
const sequelize = process.env.DATABASE_URL
  ? (() => {
      const db = _parseDbUrl(process.env.DATABASE_URL);
      return new Sequelize(db.database, db.username, db.password, {
        ...sharedOptions,
        host: db.host,
        port: db.port,
        dialectOptions: {
          ssl: { require: true, rejectUnauthorized: false },
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        },
      });
    })()
  : new Sequelize(config.database.name, config.database.user, config.database.password, {
      ...sharedOptions,
      host: config.database.host,
      port: config.database.port,
      dialectOptions: {
        ssl: config.isProduction ? { require: true, rejectUnauthorized: false } : false,
      },
    });

/**
 * Test database connection on startup
 */
export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL connected successfully');
  } catch (error) {
    logger.error('❌ PostgreSQL connection failed:', error);
    throw error;
  }
};

/**
 * Sync database schema — alters existing tables to match models.
 * @param {object} options  Sequelize sync options (default: { alter: true, force: false })
 */
export const syncDatabase = async (options = {}) => {
  try {
    const syncOptions = { force: false, alter: true, ...options };
    await sequelize.sync(syncOptions);
    logger.info('✅ Database schema synced');
  } catch (error) {
    logger.error('❌ Database sync failed:', error);
    throw error;
  }
};

/**
 * Fix stale FK constraints that reference the old 'schools' table.
 * The system migrated from schools → institutes; this runs once at startup
 * and is idempotent (safe to run every boot).
 */
export const fixForeignKeys = async () => {
  try {
    await sequelize.transaction(async (t) => {
      // 1. Drop the old FK that points to schools.id (if it still exists)
      await sequelize.query(`
        ALTER TABLE users
        DROP CONSTRAINT IF EXISTS users_school_id_fkey;
      `, { transaction: t });

      // 2. Add new FK pointing to institutes.id
      await sequelize.query(`
        ALTER TABLE users
        ADD CONSTRAINT users_school_id_fkey
        FOREIGN KEY (school_id)
        REFERENCES institutes(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
      `, { transaction: t });
    });
    logger.info('✅ FK migration: users.school_id → institutes.id');
  } catch (error) {
    // If constraint already correct Postgres will error on re-add — ignore
    if (error.message?.includes('already exists')) {
      logger.info('✅ FK migration: users_school_id_fkey already points to institutes');
    } else {
      logger.error('⚠️  FK migration warning:', error.message);
    }
  }
};

export { sequelize };
export default sequelize;
