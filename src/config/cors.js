/**
 * The Clouds Academy - CORS Configuration
 */

import config from './index.js';

const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite dev
  'https://tca-frontend-five.vercel.app'
];

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-School-Code'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
};

export default corsOptions;
