'use strict';

/**
 * Push notifications: FCM device tokens.
 *
 * NOT RUN AUTOMATICALLY. Review, then: npx sequelize-cli db:migrate
 * Creates ONLY the new table device_tokens (idempotent). Touches no existing table.
 * Until it is run, POST /notifications/devices answers 503 and everything else keeps working.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.showAllTables();
    const tables = existing.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tables.includes('device_tokens')) return;

    await queryInterface.createTable('device_tokens', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      institute_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'institutes', key: 'id' }, onDelete: 'CASCADE' },
      branch_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'branches', key: 'id' }, onDelete: 'SET NULL' },
      token: { type: Sequelize.TEXT, allowNull: false },
      platform: { type: Sequelize.STRING(10), allowNull: false },
      app: { type: Sequelize.STRING(10), allowNull: false },
      device_info: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    // unique token (TEXT: use a hash-free unique index on the value itself; FCM tokens are < 4 KB)
    await queryInterface.addIndex('device_tokens', ['token'], { unique: true, name: 'device_tokens_token_unique' });
    await queryInterface.addIndex('device_tokens', ['user_id'], { name: 'device_tokens_user' });
    await queryInterface.addIndex('device_tokens', ['institute_id', 'app'], { name: 'device_tokens_institute_app' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('device_tokens');
  },
};
