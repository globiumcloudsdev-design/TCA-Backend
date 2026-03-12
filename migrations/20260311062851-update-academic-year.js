'use strict';

/** @type {import('sequelize-cli').Migration} */
// module.exports = {
//   async up (queryInterface, Sequelize) {
//     /**
//      * Add altering commands here.
//      *
//      * Example:
//      * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
//      */
//   },

//   async down (queryInterface, Sequelize) {
//     /**
//      * Add reverting commands here.
//      *
//      * Example:
//      * await queryInterface.dropTable('users');
//      */
//   }
// };

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Naya column add karne ke liye
    await queryInterface.addColumn('AcademicYears', 'status', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Agar rollback karna paray to column remove karne ke liye
    await queryInterface.removeColumn('AcademicYears', 'status');
  }
};