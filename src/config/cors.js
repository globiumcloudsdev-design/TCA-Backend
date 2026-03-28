const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://tca-frontend-five.vercel.app'
];

export const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow requests with no origin (Postman, curl)
    if (!origin) return callback(null, true);

    // 2. Allow exact matches
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 3. ✅ Allow ALL Vercel deployments (IMPORTANT)
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // 4. Block everything else
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-School-Code'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
};