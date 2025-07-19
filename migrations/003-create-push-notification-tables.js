'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create devices table with correct camelCase column names from the start
      await queryInterface.createTable('devices', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        deviceToken: {
          type: Sequelize.STRING(128),
          allowNull: false,
          unique: true,
        },
        platform: {
          type: Sequelize.ENUM('ios', 'android'),
          allowNull: false,
          defaultValue: 'ios',
        },
        relevanceThreshold: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.5,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        deviceId: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        model: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        systemVersion: {
          type: Sequelize.STRING(20),
          allowNull: true,
        },
        appVersion: {
          type: Sequelize.STRING(20),
          allowNull: true,
        },
        buildNumber: {
          type: Sequelize.STRING(20),
          allowNull: true,
        },
        bundleId: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        timeZone: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        language: {
          type: Sequelize.STRING(10),
          allowNull: true,
        },
        categories: {
          type: Sequelize.JSON,
          allowNull: false,
          defaultValue: [],
        },
        quietHours: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        registeredAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        lastUpdated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      // Create read_posts table with correct camelCase column names from the start
      await queryInterface.createTable('read_posts', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        deviceToken: {
          type: Sequelize.STRING(128),
          allowNull: false,
          references: {
            model: 'devices',
            key: 'deviceToken',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        postId: {
          type: Sequelize.STRING(36),
          allowNull: false,
        },
        readAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      // Create analytics table with correct camelCase column names and NO updatedAt
      await queryInterface.createTable('analytics', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        deviceToken: {
          type: Sequelize.STRING(128),
          allowNull: false,
          references: {
            model: 'devices',
            key: 'deviceToken',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        event: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        timestamp: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        platform: {
          type: Sequelize.ENUM('ios', 'android'),
          allowNull: false,
          defaultValue: 'ios',
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        // Note: No updatedAt column since Analytics model has updatedAt: false
      }, { transaction });

      // Add indexes for better performance
      await queryInterface.addIndex('devices', ['deviceToken'], {
        unique: true,
        name: 'idx_devices_device_token',
        transaction,
      });

      await queryInterface.addIndex('read_posts', ['deviceToken'], {
        name: 'idx_read_posts_device_token',
        transaction,
      });

      await queryInterface.addIndex('read_posts', ['postId'], {
        name: 'idx_read_posts_post_id',
        transaction,
      });

      await queryInterface.addIndex('read_posts', ['deviceToken', 'postId'], {
        unique: true,
        name: 'idx_read_posts_device_post_unique',
        transaction,
      });

      await queryInterface.addIndex('analytics', ['deviceToken'], {
        name: 'idx_analytics_device_token',
        transaction,
      });

      await queryInterface.addIndex('analytics', ['event'], {
        name: 'idx_analytics_event',
        transaction,
      });

      await queryInterface.addIndex('analytics', ['timestamp'], {
        name: 'idx_analytics_timestamp',
        transaction,
      });

      await transaction.commit();
      console.log('Successfully created push notification tables with correct schema');
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating push notification tables:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop tables in reverse order (due to foreign key constraints)
      await queryInterface.dropTable('analytics', { transaction });
      await queryInterface.dropTable('read_posts', { transaction });
      await queryInterface.dropTable('devices', { transaction });

      await transaction.commit();
      console.log('Successfully dropped push notification tables');
    } catch (error) {
      await transaction.rollback();
      console.error('Error dropping push notification tables:', error);
      throw error;
    }
  }
};
