module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create devices table
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
          field: 'device_token',
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
          field: 'relevance_threshold',
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        deviceId: {
          type: Sequelize.STRING(100),
          allowNull: true,
          field: 'device_id',
        },
        model: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        systemVersion: {
          type: Sequelize.STRING(20),
          allowNull: true,
          field: 'system_version',
        },
        appVersion: {
          type: Sequelize.STRING(20),
          allowNull: true,
          field: 'app_version',
        },
        buildNumber: {
          type: Sequelize.STRING(20),
          allowNull: true,
          field: 'build_number',
        },
        bundleId: {
          type: Sequelize.STRING(100),
          allowNull: true,
          field: 'bundle_id',
        },
        timeZone: {
          type: Sequelize.STRING(50),
          allowNull: true,
          field: 'time_zone',
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
          type: Sequelize.JSON,
          allowNull: true,
          field: 'quiet_hours',
        },
        registeredAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'registered_at',
        },
        lastUpdated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'last_updated',
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'created_at',
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'updated_at',
        },
      }, { transaction });

      // Create read_posts table
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
          field: 'device_token',
          references: {
            model: 'devices',
            key: 'device_token',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        postId: {
          type: Sequelize.STRING(36),
          allowNull: false,
          field: 'post_id',
        },
        readAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'read_at',
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'created_at',
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'updated_at',
        },
      }, { transaction });

      // Create analytics table
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
          field: 'device_token',
          references: {
            model: 'devices',
            key: 'device_token',
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
          field: 'created_at',
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          field: 'updated_at',
        },
      }, { transaction });

      // Add indexes for better performance
      await queryInterface.addIndex('devices', ['device_token'], {
        unique: true,
        name: 'idx_devices_device_token',
        transaction,
      });

      await queryInterface.addIndex('devices', ['is_active', 'relevance_threshold'], {
        name: 'idx_devices_active_threshold',
        transaction,
      });

      await queryInterface.addIndex('read_posts', ['device_token', 'post_id'], {
        unique: true,
        name: 'idx_read_posts_device_post',
        transaction,
      });

      await queryInterface.addIndex('read_posts', ['post_id'], {
        name: 'idx_read_posts_post_id',
        transaction,
      });

      await queryInterface.addIndex('analytics', ['device_token', 'timestamp'], {
        name: 'idx_analytics_device_timestamp',
        transaction,
      });

      await queryInterface.addIndex('analytics', ['event', 'timestamp'], {
        name: 'idx_analytics_event_timestamp',
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop tables in reverse order due to foreign key constraints
      await queryInterface.dropTable('analytics', { transaction });
      await queryInterface.dropTable('read_posts', { transaction });
      await queryInterface.dropTable('devices', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
