'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add hash column to posts table
    await queryInterface.addColumn('posts', 'hash', {
      type: Sequelize.STRING(64),
      allowNull: true, // Initially null for existing records
      comment: 'SHA256 hash of the content for deduplication',
    });

    // Add index on hash for faster lookups during deduplication
    await queryInterface.addIndex('posts', ['hash']);
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('posts', ['hash']);

    // Remove hash column
    await queryInterface.removeColumn('posts', 'hash');
  },
};
