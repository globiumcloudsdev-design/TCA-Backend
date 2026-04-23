// // backend/src/utils/qrCodeGenerator.js (UPDATED with Cloudinary)

// import QRCode from 'qrcode';
// import path from 'path';
// import fs from 'fs';
// import { fileURLToPath } from 'url';
// import { v4 as uuidv4 } from 'uuid';
// import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// /**
//  * Generate QR Code and upload to Cloudinary
//  * @param {Object} userData - User data to encode
//  * @param {string} instituteId - Institute ID for folder structure
//  * @param {string} oldPublicId - Old QR code public_id to delete (optional)
//  * @returns {Promise<{url: string, public_id: string}>} - Cloudinary URL and public_id
//  */
// export const generateAndUploadQRCode = async (userData, instituteId, oldPublicId = null) => {
//   let tempFilePath = null;
  
//   try {
//     // 1️⃣ Create QR code data
//     const qrData = {
//       id: userData.id,
//       name: `${userData.first_name} ${userData.last_name}`,
//       type: userData.user_type,
//       email: userData.email,
//       registration_no: userData.registration_no,
//       phone: userData.phone,
//       institute_id: instituteId,
//       generated_at: new Date().toISOString()
//     };

//     // 2️⃣ QR code options
//     const options = {
//       errorCorrectionLevel: 'H',
//       type: 'png',
//       quality: 0.92,
//       margin: 1,
//       width: 300,
//       color: {
//         dark: '#000000',
//         light: '#ffffff'
//       }
//     };

//     // 3️⃣ Create temp directory if not exists
//     const tempDir = path.join(__dirname, '../../public/uploads/temp');
//     if (!fs.existsSync(tempDir)) {
//       fs.mkdirSync(tempDir, { recursive: true });
//     }

//     // 4️⃣ Generate temp file
//     const fileName = `qr_${userData.user_type}_${userData.id}_${Date.now()}.png`;
//     tempFilePath = path.join(tempDir, fileName);
    
//     // Generate QR code and save to temp file
//     await QRCode.toFile(tempFilePath, JSON.stringify(qrData), options);

//     // 5️⃣ Upload to Cloudinary in institute-specific folder
//     const folder = `the-clouds-academy/${instituteId}/qrcodes`;
    
//     const result = await uploadToCloudinary(tempFilePath, folder, {
//       resource_type: 'image',
//       use_filename: true,
//       unique_filename: true,
//       filename_override: fileName
//     });

//     // 6️⃣ Delete old QR code from Cloudinary if exists
//     if (oldPublicId) {
//       try {
//         await deleteFromCloudinary(oldPublicId, 'image');
//         console.log(`✅ Old QR code deleted: ${oldPublicId}`);
//       } catch (deleteError) {
//         console.error('❌ Failed to delete old QR code:', deleteError);
//         // Don't throw error for delete failure
//       }
//     }

//     console.log(`✅ QR Code uploaded to Cloudinary: ${result.url}`);
    
//     return {
//       url: result.url,
//       public_id: result.public_id
//     };
    
//   } catch (error) {
//     console.error('❌ QR Code generation failed:', error);
//     throw error;
//   } finally {
//     // 7️⃣ Clean up temp file
//     if (tempFilePath && fs.existsSync(tempFilePath)) {
//       try {
//         await fs.promises.unlink(tempFilePath);
//       } catch (unlinkError) {
//         console.error('❌ Failed to delete temp file:', unlinkError);
//       }
//     }
//   }
// };

// /**
//  * Generate QR Code as buffer (for email attachment) - no Cloudinary upload
//  */
// export const generateQRCodeBuffer = async (userData) => {
//   try {
//     const qrData = {
//       id: userData.id,
//       name: `${userData.first_name} ${userData.last_name}`,
//       type: userData.user_type,
//       registration_no: userData.registration_no
//     };

//     return await QRCode.toBuffer(JSON.stringify(qrData), {
//       errorCorrectionLevel: 'H',
//       type: 'png',
//       width: 200
//     });
    
//   } catch (error) {
//     console.error('❌ QR Code buffer generation failed:', error);
//     throw error;
//   }
// };

// export default {
//   generateAndUploadQRCode,
//   generateQRCodeBuffer
// };








// backend/src/utils/qrCodeGenerator.js
// UPDATED - Clean QR Code + Cloudinary Upload + Same Important Data

import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate QR Code and Upload to Cloudinary
 * Keeps important data same
 * Makes QR cleaner, less dense, easier to scan
 */
export const generateAndUploadQRCode = async (
  userData,
  instituteId,
  oldPublicId = null
) => {
  let tempFilePath = null;

  try {
    // ✅ Keep your important data
    const qrData = {
      id: userData.id,
      // name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      type: userData.user_type,
      // email: userData.email,
      registration_no: userData.registration_no,
      // phone: userData.phone,
      institute_id: instituteId,
      // generated_at: new Date().toISOString()
    };

    // ✅ Optimized QR Options (clean look)
    const options = {
      errorCorrectionLevel: 'L', // less dots, easier scan
      type: 'png',
      margin: 5, // more white border
      width: 500, // larger image = clear blocks
      maskPattern: 3,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      rendererOpts: {
        quality: 1
      }
    };

    // ✅ Temp folder create
    const tempDir = path.join(__dirname, '../../public/uploads/temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // ✅ Temp file name
    const fileName = `qr_${userData.user_type}_${userData.id}_${Date.now()}.png`;
    tempFilePath = path.join(tempDir, fileName);

    // ✅ Generate QR File
    await QRCode.toFile(
      tempFilePath,
      JSON.stringify(qrData),
      options
    );

    // ✅ Cloudinary Folder
    const folder = `the-clouds-academy/${instituteId}/qrcodes`;

    // ✅ Upload to Cloudinary
    const result = await uploadToCloudinary(tempFilePath, folder, {
      resource_type: 'image',
      use_filename: true,
      unique_filename: true,
      filename_override: fileName
    });

    // ✅ Delete old QR if exists
    if (oldPublicId) {
      try {
        await deleteFromCloudinary(oldPublicId, 'image');
        console.log(`✅ Old QR deleted: ${oldPublicId}`);
      } catch (err) {
        console.error('❌ Failed to delete old QR:', err.message);
      }
    }

    console.log(`✅ QR Uploaded: ${result.url}`);

    return {
      url: result.url,
      public_id: result.public_id
    };
  } catch (error) {
    console.error('❌ QR Code generation failed:', error);
    throw error;
  } finally {
    // ✅ Delete temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (err) {
        console.error('❌ Temp file delete failed:', err.message);
      }
    }
  }
};

/**
 * Generate QR Buffer (Email / Print Use)
 */
export const generateQRCodeBuffer = async (userData) => {
  try {
    const qrData = {
      id: userData.id,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      type: userData.user_type,
      registration_no: userData.registration_no,
      email: userData.email,
      phone: userData.phone
    };

    const buffer = await QRCode.toBuffer(
      JSON.stringify(qrData),
      {
        errorCorrectionLevel: 'L',
        type: 'png',
        margin: 4,
        width: 350,
        maskPattern: 3,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }
    );

    return buffer;
  } catch (error) {
    console.error('❌ QR Buffer generation failed:', error);
    throw error;
  }
};

export default {
  generateAndUploadQRCode,
  generateQRCodeBuffer
};