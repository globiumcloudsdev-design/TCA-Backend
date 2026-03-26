/**
 * Sequelize CLI config (CommonJS, used by sequelize-cli only)
 * Reads from .env using DATABASE_URL (Neon/cloud) or individual DB_* vars
 */

require('dotenv').config();

// Parse DATABASE_URL manually to handle URL-encoded characters
const parseDbUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  return {
    database: decodeURIComponent(url.pathname.slice(1)),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host:     url.hostname,
    port:     parseInt(url.port, 10) || 5432,
  };
};

let dbConfig;

if (process.env.DATABASE_URL) {
  const db = parseDbUrl(process.env.DATABASE_URL);
  dbConfig = {
    username: db.username,
    password: db.password,
    database: db.database,
    host:     db.host,
    port:     db.port,
    dialect:  'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  };
} else {
  dbConfig = {
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME     || 'clouds_academy',
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    dialect:  'postgres',
    dialectOptions: {
      ssl: false,
    },
  };
}

module.exports = {
  development: dbConfig,
  test:        dbConfig,
  production:  dbConfig,
};
