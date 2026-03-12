/**
 * The Clouds Academy - JWT & Auth Config
 */

import jwt from 'jsonwebtoken';
import config from './index.js';

/**
 * Sign access token
 * @param {object} payload - Token payload
 * @returns {string} - Signed JWT
 */
export const signAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'thecloudsacademy',
  });
};

/**
 * Sign refresh token
 * @param {object} payload - Token payload
 * @returns {string} - Signed JWT
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: 'thecloudsacademy',
  });
};

/**
 * Verify access token
 * @param {string} token - JWT token
 * @returns {object} - Decoded payload
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

/**
 * Verify refresh token
 * @param {string} token - Refresh JWT token
 * @returns {object} - Decoded payload
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

export default { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
