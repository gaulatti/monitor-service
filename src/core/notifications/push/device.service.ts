import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, literal } from 'sequelize';
import * as crypto from 'crypto';
import {
  RegisterDeviceDto,
  UpdateDeviceDto,
  MarkPostReadDto,
  AnalyticsEventDto,
  DeviceRegistrationResponseDto,
} from 'src/dto';
import { Device, ReadPost, Analytics } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { Logger } from 'src/decorators/logger.decorator';
import { ApnsService } from './apns.service';

/**
 * Service for managing devices and push notifications
 */
@Injectable()
export class DeviceService {
  @Logger(DeviceService.name)
  private readonly logger!: JSONLogger;

  constructor(
    @InjectModel(Device)
    private deviceModel: typeof Device,
    @InjectModel(ReadPost)
    private readPostModel: typeof ReadPost,
    @InjectModel(Analytics)
    private analyticsModel: typeof Analytics,
    private apnsService: ApnsService,
  ) {}

  /**
   * Register a new device or update existing one
   */
  async registerDevice(
    deviceData: RegisterDeviceDto,
  ): Promise<DeviceRegistrationResponseDto> {
    const maskedToken = this.maskDeviceToken(deviceData.deviceToken);

    this.logger.log('Device registration started', {
      maskedDeviceToken: maskedToken,
      platform: deviceData.platform,
      deviceId: deviceData.deviceInfo.deviceId,
      model: deviceData.deviceInfo.model,
      relevanceThreshold: deviceData.relevanceThreshold,
      categoriesCount: deviceData.preferences.categories.length,
    });

    try {
      // Validate device token format
      if (!this.apnsService.isValidDeviceToken(deviceData.deviceToken)) {
        this.logger.error('Invalid device token format', '', {
          maskedDeviceToken: maskedToken,
          platform: deviceData.platform,
        });
        throw new ConflictException('Invalid device token format');
      }

      // Check if device already exists
      const existingDevice = await this.deviceModel.findOne({
        where: { deviceToken: deviceData.deviceToken },
      });

      let device: Device;

      if (existingDevice) {
        this.logger.log('Updating existing device', {
          maskedDeviceToken: maskedToken,
          deviceId: existingDevice.id,
          oldRelevanceThreshold: existingDevice.relevanceThreshold,
          newRelevanceThreshold: deviceData.relevanceThreshold,
          oldCategories: existingDevice.categories,
          newCategories: deviceData.preferences.categories,
          appVersion: deviceData.deviceInfo.appVersion,
        });

        // Update existing device
        await existingDevice.update({
          platform: deviceData.platform,
          relevanceThreshold: deviceData.relevanceThreshold,
          isActive: deviceData.isActive,
          deviceId: deviceData.deviceInfo.deviceId,
          model: deviceData.deviceInfo.model,
          systemVersion: deviceData.deviceInfo.systemVersion,
          appVersion: deviceData.deviceInfo.appVersion,
          buildNumber: deviceData.deviceInfo.buildNumber,
          bundleId: deviceData.deviceInfo.bundleId,
          timeZone: deviceData.deviceInfo.timeZone,
          language: deviceData.deviceInfo.language,
          categories: deviceData.preferences.categories,
          quietHours: deviceData.preferences.quietHours,
          lastUpdated: new Date(deviceData.registeredAt),
        });
        device = existingDevice;

        this.logger.log('Device updated successfully', {
          maskedDeviceToken: maskedToken,
          deviceId: device.id,
          isActive: device.isActive,
        });
      } else {
        this.logger.log('Creating new device', {
          maskedDeviceToken: maskedToken,
          platform: deviceData.platform,
          deviceModel: deviceData.deviceInfo.model,
          appVersion: deviceData.deviceInfo.appVersion,
        });

        // Create new device
        device = await this.deviceModel.create({
          deviceToken: deviceData.deviceToken,
          platform: deviceData.platform,
          relevanceThreshold: deviceData.relevanceThreshold,
          isActive: deviceData.isActive,
          deviceId: deviceData.deviceInfo.deviceId,
          model: deviceData.deviceInfo.model,
          systemVersion: deviceData.deviceInfo.systemVersion,
          appVersion: deviceData.deviceInfo.appVersion,
          buildNumber: deviceData.deviceInfo.buildNumber,
          bundleId: deviceData.deviceInfo.bundleId,
          timeZone: deviceData.deviceInfo.timeZone,
          language: deviceData.deviceInfo.language,
          categories: deviceData.preferences.categories,
          quietHours: deviceData.preferences.quietHours,
          registeredAt: new Date(deviceData.registeredAt),
          lastUpdated: new Date(deviceData.registeredAt),
        } as any);

        this.logger.log('New device created successfully', {
          maskedDeviceToken: maskedToken,
          deviceId: device.id,
          isActive: device.isActive,
        });
      }

      this.logger.log('Device registration completed', {
        maskedDeviceToken: maskedToken,
        deviceId: device.id,
        operation: existingDevice ? 'update' : 'create',
      });

      return {
        id: device.id.toString(),
        status: 'registered',
      };
    } catch (error) {
      this.logger.error('Error registering device', '', {
        maskedDeviceToken: maskedToken,
        platform: deviceData.platform,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update device settings
   */
  async updateDevice(
    deviceToken: string,
    updateData: UpdateDeviceDto,
  ): Promise<void> {
    const device = await this.deviceModel.findOne({
      where: { deviceToken },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await device.update({
      relevanceThreshold:
        updateData.relevanceThreshold ?? device.relevanceThreshold,
      isActive: updateData.isActive ?? device.isActive,
      lastUpdated: new Date(updateData.lastUpdated),
    });

    this.logger.log(`Updated device settings: ${deviceToken}`);
  }

  /**
   * Mark a post as read for a device
   */
  async markPostAsRead(
    deviceToken: string,
    markReadData: MarkPostReadDto,
  ): Promise<void> {
    const maskedToken = this.maskDeviceToken(deviceToken);

    this.logger.log('Marking post as read', {
      maskedDeviceToken: maskedToken,
      postId: markReadData.postId,
      readAt: markReadData.readAt,
    });

    // Verify device exists
    const device = await this.deviceModel.findOne({
      where: { deviceToken },
    });

    if (!device) {
      this.logger.error('Device not found for mark as read', '', {
        maskedDeviceToken: maskedToken,
        postId: markReadData.postId,
      });
      throw new NotFoundException('Device not found');
    }

    // Check if post is already marked as read
    const existingRead = await this.readPostModel.findOne({
      where: {
        deviceToken,
        postId: markReadData.postId,
      },
    });

    if (!existingRead) {
      await this.readPostModel.create({
        deviceToken,
        postId: markReadData.postId,
        readAt: new Date(markReadData.readAt),
      } as any);

      this.logger.log('Post marked as read successfully', {
        maskedDeviceToken: maskedToken,
        postId: markReadData.postId,
        deviceId: device.id,
      });
    } else {
      this.logger.log('Post already marked as read', {
        maskedDeviceToken: maskedToken,
        postId: markReadData.postId,
        deviceId: device.id,
      });
    }
  }

  /**
   * Record analytics event
   */
  async recordAnalyticsEvent(eventData: AnalyticsEventDto): Promise<void> {
    const maskedToken = this.maskDeviceToken(eventData.deviceToken);

    this.logger.log('Recording analytics event', {
      maskedDeviceToken: maskedToken,
      event: eventData.event,
      platform: eventData.platform,
      postId: eventData.postId,
      relevance: eventData.relevance,
      categories: eventData.categories,
      count: eventData.count,
    });

    // Verify device exists or auto-register
    let device = await this.deviceModel.findOne({
      where: { deviceToken: eventData.deviceToken },
    });

    if (!device) {
      this.logger.warn(
        'Device not found for analytics event, auto-registering with defaults',
        {
          maskedDeviceToken: maskedToken,
          event: eventData.event,
          platform: eventData.platform,
        },
      );

      // Auto-register device with default settings
      device = await this.autoRegisterDevice(
        eventData.deviceToken,
        eventData.platform,
        eventData, // Pass the full event data for optional device info
      );

      this.logger.log('Device auto-registered successfully', {
        maskedDeviceToken: maskedToken,
        deviceId: device.id,
        platform: eventData.platform,
        event: eventData.event,
      });
    }

    const metadata: any = {};
    if (eventData.postId) metadata.postId = eventData.postId;
    if (eventData.relevance !== undefined)
      metadata.relevance = eventData.relevance;
    if (eventData.categories) metadata.categories = eventData.categories;
    if (eventData.count !== undefined) metadata.count = eventData.count;

    await this.analyticsModel.create({
      deviceToken: eventData.deviceToken,
      event: eventData.event,
      timestamp: new Date(eventData.timestamp),
      platform: eventData.platform,
      metadata,
    } as any);

    this.logger.log('Analytics event recorded successfully', {
      maskedDeviceToken: maskedToken,
      deviceId: device.id,
      event: eventData.event,
      platform: eventData.platform,
      hasPostId: !!eventData.postId,
      metadataKeys: Object.keys(metadata),
    });
  }

  /**
   * Get active devices that should receive notifications for a post
   */
  async getNotificationTargets(
    postRelevance: number,
    postCategories: string[],
  ): Promise<Device[]> {
    this.logger.log('Finding notification targets', {
      postRelevance,
      postCategories,
      categoryCount: postCategories.length,
    });

    // First, let's see all active devices for debugging
    const allActiveDevices = await this.deviceModel.findAll({
      where: { isActive: true },
      attributes: ['id', 'deviceToken', 'relevanceThreshold', 'categories'],
    });

    this.logger.log('All active devices for debugging', {
      totalActiveDevices: allActiveDevices.length,
      devices: allActiveDevices.map((d) => ({
        id: d.id,
        maskedToken: this.maskDeviceToken(d.deviceToken),
        relevanceThreshold: d.relevanceThreshold,
        categories: d.categories,
        meetsRelevance: d.relevanceThreshold <= postRelevance,
        hasEmptyCategories:
          Array.isArray(d.categories) && d.categories.length === 0,
      })),
    });

    const devices = await this.deviceModel.findAll({
      where: {
        isActive: true,
        relevanceThreshold: {
          [Op.lte]: postRelevance,
        },
        [Op.or]: [
          // Devices with empty categories array receive all notifications
          literal('JSON_LENGTH(categories) = 0'),
          // Devices with matching categories
          { categories: { [Op.overlap]: postCategories } },
        ],
      },
    });

    this.logger.log('Found notification targets', {
      eligibleDeviceCount: devices.length,
      postRelevance,
      postCategories,
      deviceStats: {
        totalFound: devices.length,
        platforms: this.getDevicePlatformStats(devices),
        relevanceThresholds: this.getRelevanceThresholdStats(devices),
      },
    });

    return devices;
  }

  /**
   * Get devices that haven't read a specific post
   */
  async getUnreadDevices(postId: string, devices: Device[]): Promise<Device[]> {
    const deviceTokens = devices.map((d) => d.deviceToken);

    const readPosts = await this.readPostModel.findAll({
      where: {
        postId,
        deviceToken: {
          [Op.in]: deviceTokens,
        },
      },
      attributes: ['deviceToken'],
    });

    const readDeviceTokens = new Set(readPosts.map((rp) => rp.deviceToken));

    const unreadDevices = devices.filter(
      (device) => !readDeviceTokens.has(device.deviceToken),
    );

    this.logger.log(
      `Found ${unreadDevices.length} devices that haven't read post ${postId}`,
    );

    return unreadDevices;
  }

  /**
   * Get device analytics
   */
  async getDeviceAnalytics(
    deviceToken: string,
    days = 7,
  ): Promise<Analytics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.analyticsModel.findAll({
      where: {
        deviceToken,
        timestamp: {
          [Op.gte]: startDate,
        },
      },
      order: [['timestamp', 'DESC']],
    });
  }

  /**
   * Clean up old read posts (older than 30 days)
   */
  async cleanupOldReadPosts(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedCount = await this.readPostModel.destroy({
      where: {
        createdAt: {
          [Op.lt]: thirtyDaysAgo,
        },
      },
    });

    this.logger.log(`Cleaned up ${deletedCount} old read post records`);
  }

  /**
   * Deactivate devices that haven't been updated in 30 days
   */
  async deactivateStaleDevices(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [updatedCount] = await this.deviceModel.update(
      { isActive: false },
      {
        where: {
          lastUpdated: {
            [Op.lt]: thirtyDaysAgo,
          },
          isActive: true,
        },
      },
    );

    this.logger.log(`Deactivated ${updatedCount} stale devices`);
  }

  /**
   * Auto-register a device with default settings when found during analytics
   */
  private async autoRegisterDevice(
    deviceToken: string,
    platform: 'ios' | 'android',
    eventData?: AnalyticsEventDto,
  ): Promise<Device> {
    const maskedToken = this.maskDeviceToken(deviceToken);

    this.logger.log('Auto-registering device with default settings', {
      maskedDeviceToken: maskedToken,
      platform,
      hasDeviceInfo: !!(
        eventData?.deviceId ||
        eventData?.appVersion ||
        eventData?.model
      ),
    });

    // Validate device token format
    if (!this.apnsService.isValidDeviceToken(deviceToken)) {
      this.logger.error(
        'Invalid device token format during auto-registration',
        '',
        {
          maskedDeviceToken: maskedToken,
          platform,
        },
      );
      throw new ConflictException('Invalid device token format');
    }

    // Use provided deviceId if available, otherwise generate one from token
    const deviceId =
      eventData?.deviceId || this.generateDeviceIdFromToken(deviceToken);

    const device = await this.deviceModel.create({
      deviceToken,
      platform,
      relevanceThreshold: 0.5, // Default relevance threshold
      isActive: true,
      deviceId, // Use provided or generated deviceId
      model: eventData?.model || null, // Use provided model if available
      appVersion: eventData?.appVersion || null, // Use provided app version if available
      categories: [], // Empty categories array by default - will receive all notifications
      quietHours: false,
      registeredAt: new Date(),
      lastUpdated: new Date(),
    } as any);

    this.logger.log('Device auto-registration completed', {
      maskedDeviceToken: maskedToken,
      deviceId: device.id,
      providedDeviceId: eventData?.deviceId,
      generatedDeviceId: !eventData?.deviceId ? deviceId : undefined,
      model: eventData?.model,
      appVersion: eventData?.appVersion,
      platform,
      relevanceThreshold: device.relevanceThreshold,
      autoRegistered: true,
    });

    return device;
  }

  /**
   * Generate a consistent deviceId from device token for auto-registration
   * This ensures the same device gets the same deviceId if re-registered
   */
  private generateDeviceIdFromToken(deviceToken: string): string {
    // Use a hash of the device token to generate a consistent deviceId
    // This way, if the same device is auto-registered multiple times,
    // it gets the same deviceId (useful for analytics correlation)
    const hash = crypto.createHash('sha256').update(deviceToken).digest('hex');

    // Take first 16 characters of hash and prefix with 'auto-'
    // This gives us: auto-1a2b3c4d5e6f7g8h (24 chars total)
    return `auto-${hash.substring(0, 16)}`;
  }

  /**
   * Mask device token for logging (show first 8 and last 4 characters)
   */
  private maskDeviceToken(token: string): string {
    if (!token || token.length < 12) {
      return '***masked***';
    }
    return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Get platform statistics for devices
   */
  private getDevicePlatformStats(devices: Device[]): Record<string, number> {
    const stats: Record<string, number> = {};
    devices.forEach((device) => {
      stats[device.platform] = (stats[device.platform] || 0) + 1;
    });
    return stats;
  }

  /**
   * Get relevance threshold statistics for devices
   */
  private getRelevanceThresholdStats(
    devices: Device[],
  ): Record<string, number> {
    const stats: Record<string, number> = {};
    devices.forEach((device) => {
      const threshold = device.relevanceThreshold.toString();
      stats[threshold] = (stats[threshold] || 0) + 1;
    });
    return stats;
  }
}
