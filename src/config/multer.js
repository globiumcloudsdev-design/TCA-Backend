
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
    // Extension is validated against an allowlist by fileFilter; lower-case it here
    const ext = path.extname(file.originalname).toLowerCase();
    const name = path.basename(file.originalname, path.extname(file.originalname));
    
    // Sanitize filename (remove special characters)
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${timestamp}-${random}-${safeName}${ext}`;
    
    cb(null, filename);
  },
});

// MIME type -> extensions that may legitimately carry it. The client-sent
// mimetype alone is NOT trusted: the extension must match too, so an .html/.svg/.js
// file can never be stored under an image/pdf mimetype (stored-XSS vector).
const MIME_EXTENSIONS = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
};

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
  
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = MIME_EXTENSIONS[file.mimetype];

  if (allowedTypes.includes(file.mimetype) && allowedExts && allowedExts.includes(ext)) {
    cb(null, true);
  } else if (allowedTypes.includes(file.mimetype) && allowedExts) {
    cb(new AppError(`File extension '${ext || 'none'}' does not match its type (${file.mimetype})`, 400), false);
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