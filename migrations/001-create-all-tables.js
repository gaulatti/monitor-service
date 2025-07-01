'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create posts table with refactored structure
    await queryInterface.createTable('posts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      uuid: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      source_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Original ID from the source (e.g., Bluesky post ID)',
      },
      source: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      uri: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      relevance: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      lang: {
        type: Sequelize.STRING(8),
        allowNull: true,
      },
      author_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      author_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      author_handle: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      author_avatar: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      media: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      linkPreview: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      original: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      // Legacy fields for backward compatibility
      author: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      posted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      received_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      embedding: {
        type: Sequelize.JSON,
        allowNull: true,
      },
    });

    // Add index on uuid for faster lookups
    await queryInterface.addIndex('posts', ['uuid']);
    await queryInterface.addIndex('posts', ['source_id']);

    // Create categories table
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
    });

    // Create taggings table (many-to-many relationship between posts and categories)
    await queryInterface.createTable('taggings', {
      post_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'posts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      category_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });

    // Create events table
    await queryInterface.createTable('events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      uuid: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('open', 'archived', 'dismissed'),
        allowNull: true,
        defaultValue: 'open',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Add index on events uuid
    await queryInterface.addIndex('events', ['uuid']);

    // Create matches table (many-to-many relationship between events and posts)
    await queryInterface.createTable('matches', {
      event_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      post_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'posts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      match_score: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      added_by: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      added_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create drafts table
    await queryInterface.createTable('drafts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      uuid: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true,
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      model_used: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      created_by: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add index on drafts uuid
    await queryInterface.addIndex('drafts', ['uuid']);
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order to respect foreign key constraints
    await queryInterface.dropTable('drafts');
    await queryInterface.dropTable('matches');
    await queryInterface.dropTable('events');
    await queryInterface.dropTable('taggings');
    await queryInterface.dropTable('categories');
    await queryInterface.dropTable('posts');
  },
};
