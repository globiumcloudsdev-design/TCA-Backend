// src/config/cloudinary.js

import { v2 as cloudinary } from 'cloudinary';
import config from './index.js';
import logger from './logger.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

/**
 * Upload file to Cloudinary with institute-specific folder
 * @param {string} filePath - Local temp file path
 * @param {string} folder - Full folder path (e.g., "the-clouds-academy/instituteId/materials/2024")
 * @param {Object} options - Extra Cloudinary options
 */
export const uploadToCloudinary = async (filePath, folder, options = {}) => {
  try {
    const isRaw = options.resource_type === 'raw';

    const uploadOptions = {
      folder: folder, // Full folder path
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      ...options,
    };

    // Don't apply image transformations to raw files (PDFs)
    if (!isRaw) {
      uploadOptions.transformation = [
        { quality: 'auto' }, 
        { fetch_format: 'auto' }
      ];
    }

    logger.info(`📤 Uploading to Cloudinary folder: ${folder}`);
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    logger.info(`✅ Uploaded to Cloudinary: ${result.public_id}`);

    return {
      public_id: result.public_id,
      url: result.secure_url,
      size: result.bytes,
      format: result.format,
    };
  } catch (error) {
    logger.error('❌ Cloudinary upload failed:', error);
    throw error;
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @param {string} resourceType - 'image' | 'video' | 'raw' (default: 'raw' for PDFs)
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'raw') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info(`✅ Deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error('❌ Cloudinary delete failed:', error);
    throw error;
  }
};

export { cloudinary };
export default cloudinary;