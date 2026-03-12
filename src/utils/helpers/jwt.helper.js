/**
 * The Clouds Academy - JWT Helper
 */

import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../config/auth.js';

export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };

/**
 * Extract bearer token from header
 */
export const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
};

export default { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, extractToken };
