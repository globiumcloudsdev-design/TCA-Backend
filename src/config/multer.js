
// backend/src/middlewares/upload.middleware.js

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AppError } from '../utils/lib/AppError.js';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ IMPORTANT: Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/temp');

// Create directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Created upload directory:', uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use the absolute path we created
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename but make it unique
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    
    // Sanitize filename (remove special characters)
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${timestamp}-${random}-${safeName}${ext}`;
    
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = config.upload?.allowedTypes || [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type not allowed: ${file.mimetype}`, 400), false);
  }
};

// Create multer instance
export const upload = multer({
  storage,
  limits: { 
    fileSize: config.upload?.maxSize || 10 * 1024 * 1024 // Default 10MB
  },
  fileFilter,
});

// Helper functions for different upload scenarios
export const uploadSingle = (fieldName = 'file') => upload.single(fieldName);

export const uploadMultiple = (fieldName = 'files', maxCount = 10) => 
  upload.array(fieldName, maxCount);

export const uploadFields = (fields) => upload.fields(fields);

export default upload;