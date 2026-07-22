/**
 * The Clouds Academy - Socket.io Setup
 */

import { Server } from 'socket.io';
import { corsOptions } from '../config/cors.js';
import { verifyAccessToken } from '../config/auth.js';
import logger from '../config/logger.js';

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = verifyAccessToken(token);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.userId;
    const schoolId = socket.user?.schoolId;

    logger.info(`🔌 Socket connected: user=${userId}`);

    // Join school room
    if (schoolId) {
      socket.join(`school:${schoolId}`);
    } else {
      // Global user (Master Admin or Global Staff) - join master admin room for global updates like Support Tickets
      socket.join('role:master_admin');
    }

    // Join user room
    socket.join(`user:${userId}`);

    logger.info(`🔌 Socket connected: user=${userId}, school=${schoolId}, rooms: ${Array.from(socket.rooms).join(',')}`);

    socket.on('disconnect', () => {
      logger.info(`🔌 Socket disconnected: user=${userId}`);
    });

    // Notification events
    socket.on('mark_notification_read', (notificationId) => {
      // Handle in notification controller
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

/**
 * Emit event to a specific school room
 */
export const emitToSchool = (schoolId, event, data) => {
  if (io) io.to(`school:${schoolId}`).emit(event, data);
};

/**
 * Emit event to a specific user
 */
export const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit event to all master admins
 */
export const emitToMasterAdmins = (event, data) => {
  if (io) io.to('role:master_admin').emit(event, data);
};

export default { initSocket, getIO, emitToSchool, emitToUser, emitToMasterAdmins };
