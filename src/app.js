/**
 * The Clouds Academy - Main Express App
 * ES6 Module syntax
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import xss from 'xss-clean';
import hpp from 'hpp';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';

import config from './config/index.js';
import logger from './config/logger.js';
import { corsOptions } from './config/cors.js';
import { morganMiddleware } from './config/logger.js';
import { rateLimiter } from './api/middlewares/rateLimit.middleware.js';
import { errorHandler } from './api/middlewares/errorHandler.middleware.js';
import { notFound } from './api/middlewares/notFound.middleware.js';
import v1Routes from './api/routes/v1/index.js';

const app = express();

// =============================================
// SECURITY MIDDLEWARES
// =============================================
app.use(helmet());
app.use(cors(corsOptions));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// =============================================
// REQUEST PARSING
// =============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// =============================================
// COMPRESSION & LOGGING
// =============================================
app.use(compression());
app.use(morganMiddleware);

// =============================================
// RATE LIMITING
// =============================================
app.use('/api', rateLimiter);

// =============================================
// STATIC FILES
// =============================================
app.use('/uploads', express.static('public/uploads'));
app.use('/downloads', express.static('public/downloads'));

// =============================================
// HEALTH CHECK
// =============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    version: '1.0.0',
  });
});

// =============================================
// ROOT ROUTE
// =============================================
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to The Clouds Academy API!',
    documentation: '/api/v1/docs',
    version: '1.0.0',
  });
});

// =============================================
// API ROUTES
// =============================================
app.use('/api/v1', v1Routes);

// =============================================
// ERROR HANDLING (always last)
// =============================================
app.use(notFound);
app.use(errorHandler);

export default app;
