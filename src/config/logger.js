/**
 * The Clouds Academy - Winston Logger Config
 * Daily rotating log files + console output
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../../src/logs');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return stack
    ? `[${timestamp}] ${level}: ${message}\n${stack}`
    : `[${timestamp}] ${level}: ${message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console output (colorized)
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),

    // Error log (rotating)
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      zippedArchive: true,
    }),

    // Combined log (rotating)
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      zippedArchive: true,
    }),
  ],

  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
});

// Morgan middleware for HTTP request logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
const morganMiddleware = morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim()),
  },
  skip: (req) => req.url === '/health',
});

export { morganMiddleware };
export default logger;
