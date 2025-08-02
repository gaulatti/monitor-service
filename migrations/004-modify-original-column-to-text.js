'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Modify original column from VARCHAR(255) to TEXT to support longer content
    await queryInterface.changeColumn('posts', 'original', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Original content from the source platform - supports unlimited length',
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert original column back to STRING (VARCHAR(255))
    // Note: This may truncate data if any records have original content longer than 255 characters
    await queryInterface.changeColumn('posts', 'original', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Original content from the source platform - limited to 255 characters',
    });
  },
};
