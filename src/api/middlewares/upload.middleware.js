/**
 * The Clouds Academy - Upload Middleware (Multer)
 */
//src/api/middlewares/upload.middleware.js
import upload from '../../config/multer.js';

// Single file upload
export const uploadSingle = (fieldName = 'file') => upload.single(fieldName);

// Multiple files upload
export const uploadMultiple = (fieldName = 'files', maxCount = 10) =>
  upload.array(fieldName, maxCount);

// Multiple fields
export const uploadFields = (fields) => upload.fields(fields);

export default upload;
