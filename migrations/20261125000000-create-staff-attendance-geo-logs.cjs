'use strict';

/**
 * Geofenced teacher check-in/out: attempt log (accepted + rejected) with device location.
 *
 * NOT RUN AUTOMATICALLY. Review, then: npx sequelize-cli db:migrate
 * Creates ONLY the new table staff_attendance_geo_logs (idempotent). Touches no existing table.
 * The app works without it (attempts are then only written to the server log).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.showAllTables();
    const tables = existing.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tables.includes('staff_attendance_geo_logs')) return;

    await queryInterface.createTable('staff_attendance_geo_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      institute_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'institutes', key: 'id' }, onDelete: 'CASCADE' },
      branch_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'branches', key: 'id' }, onDelete: 'SET NULL' },
      staff_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      staff_attendance_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'staff_attendances', key: 'id' }, onDelete: 'SET NULL' },
      action: { type: Sequelize.STRING(12), allowNull: false },
      outcome: { type: Sequelize.STRING(10), allowNull: false },
      reason: { type: Sequelize.STRING(30), allowNull: false },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      accuracy_m: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      distance_m: { type: Sequelize.DECIMAL(10, 1), allowNull: true },
      radius_m: { type: Sequelize.INTEGER, allowNull: true },
      is_mocked: { type: Sequelize.BOOLEAN, allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      client: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('staff_attendance_geo_logs', ['staff_id', 'created_at'], { name: 'staff_geo_logs_staff_created' });
    await queryInterface.addIndex('staff_attendance_geo_logs', ['institute_id', 'outcome', 'created_at'], { name: 'staff_geo_logs_inst_outcome' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('staff_attendance_geo_logs');
  },
};
