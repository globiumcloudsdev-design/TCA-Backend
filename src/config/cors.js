/**
 * The Clouds Academy - CORS Configuration
 */

import config from './index.js';

const envFrontendUrls = config.frontendUrl
  ? config.frontendUrl.split(',').map((url) => url.trim())
  : [];

const allowedOrigins = [
  ...envFrontendUrls,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite dev
  'https://tca-frontend-five.vercel.app',
  'https://tca-hpss.vercel.app'
];

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');
    const isAllowed = allowedOrigins.some((allowed) => {
      if (!allowed) return false;
      return allowed.replace(/\/+$/, '') === normalizedOrigin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-School-Code', 'X-Branch-ID', 'x-branch-id'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
};

export default corsOptions;
