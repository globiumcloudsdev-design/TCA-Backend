import os from 'os';
import db from '../config/database.js';

export const getSystemHealth = async () => {
  // 1. Server Metrics
  const cpuLoad = os.loadavg(); // [1 min, 5 min, 15 min]
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);
  
  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeStr = `${days}d ${hours}h ${minutes}m`;

  // 2. Database Metrics
  let dbActiveConnections = 0;
  let dbSize = 'Unknown';
  try {
    const connQuery = await db.query(`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `);
    dbActiveConnections = parseInt(connQuery[0][0].active_connections) || 0;

    const sizeQuery = await db.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    dbSize = sizeQuery[0][0].size;
  } catch (err) {
    console.error('Error fetching DB health stats:', err);
  }

  // 3. Application Metrics
  let totalUsers = 0;
  try {
    const usersQuery = await db.query(`SELECT count(*) as count FROM users`);
    totalUsers = parseInt(usersQuery[0][0].count) || 0;
  } catch (err) {
    console.error('Error fetching total users:', err);
  }

  return {
    server: {
      cpuLoad: cpuLoad[0].toFixed(2),
      memory: {
        total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        used: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        percent: parseFloat(memUsagePercent)
      },
      uptime: uptimeStr
    },
    database: {
      activeConnections: dbActiveConnections,
      size: dbSize
    },
    app: {
      totalUsers
    }
  };
};
