import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
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
    try {
      // Validate device token format
      if (!this.apnsService.isValidDeviceToken(deviceData.deviceToken)) {
        throw new ConflictException('Invalid device token format');
      }

      // Check if device already exists
      const existingDevice = await this.deviceModel.findOne({
        where: { deviceToken: deviceData.deviceToken },
      });

      let device: Device;

      if (existingDevice) {
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
        this.logger.log(`Updated existing device: ${deviceData.deviceToken}`);
      } else {
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
        this.logger.log(`Registered new device: ${deviceData.deviceToken}`);
      }

      return {
        id: device.id.toString(),
        status: 'registered',
      };
    } catch (error) {
      this.logger.error('Error registering device:', error);
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
    // Verify device exists
    const device = await this.deviceModel.findOne({
      where: { deviceToken },
    });

    if (!device) {
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

      this.logger.log(
        `Marked post ${markReadData.postId} as read for device ${deviceToken}`,
      );
    }
  }

  /**
   * Record analytics event
   */
  async recordAnalyticsEvent(eventData: AnalyticsEventDto): Promise<void> {
    // Verify device exists
    const device = await this.deviceModel.findOne({
      where: { deviceToken: eventData.deviceToken },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
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

    this.logger.log(
      `Recorded analytics event ${eventData.event} for device ${eventData.deviceToken}`,
    );
  }

  /**
   * Get active devices that should receive notifications for a post
   */
  async getNotificationTargets(
    postRelevance: number,
    postCategories: string[],
  ): Promise<Device[]> {
    const devices = await this.deviceModel.findAll({
      where: {
        isActive: true,
        relevanceThreshold: {
          [Op.lte]: postRelevance,
        },
        categories: {
          [Op.overlap]: postCategories,
        },
      },
    });

    this.logger.log(
      `Found ${devices.length} devices eligible for notifications (relevance: ${postRelevance}, categories: ${postCategories.join(', ')})`,
    );

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
}
