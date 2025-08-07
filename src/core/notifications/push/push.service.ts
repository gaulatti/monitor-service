import { Injectable } from '@nestjs/common';
import { Logger } from 'src/decorators/logger.decorator';
import { Device } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { ApnsService } from './apns.service';
import { DeviceService } from './device.service';

export interface PostNotificationData {
  id: string;
  title: string;
  content: string;
  relevance: number;
  categories: string[];
  url?: string;
  publishedAt: string;
}

export interface EventNotificationData {
  id: string;
  uuid: string;
  title: string;
  summary: string;
  posts_count: number;
  status: 'created' | 'updated';
  url?: string;
}

/**
 * Service responsible for handling push notifications (APN) to mobile devices.
 *
 * PUSH NOTIFICATION RULES:
 * - Posts: APN only for relevance 8.0+ (fixed threshold for quality)
 * - Events: APN based on user-specific thresholds (device.relevanceThreshold)
 *
 * DEVICE FILTERING:
 * - Posts: Filter by categories and unread status
 * - Events: Filter by user-specific relevance thresholds
 *
 * BATCH PROCESSING:
 * - Processes notifications in batches to avoid rate limiting
 * - Default batch size: 100 devices per batch
 */
@Injectable()
export class PushService {
  @Logger(PushService.name)
  private readonly logger!: JSONLogger;

  constructor(
    private readonly deviceService: DeviceService,
    private readonly apnsService: ApnsService,
  ) {}

  /**
   * Send push notifications for a post to mobile devices.
   * Only sends APNs for posts with relevance above the specified threshold.
   *
   * @param post - The post notification data
   * @param relevanceThreshold - Minimum relevance required (default: 8.0 for posts)
   */
  async sendPostPush(
    post: PostNotificationData,
    relevanceThreshold: number = 8.0,
  ): Promise<void> {
    await this.sendPushNotification(
      'post',
      post.relevance,
      relevanceThreshold,
      () => ({
        postId: post.id,
        title: 'Urgent Alert',
        body: this.truncateContent(post.title),
        relevance: post.relevance,
        categories: post.categories,
        url: post.url,
        publishedAt: post.publishedAt,
      }),
      {
        id: post.id,
        logContext: { postId: post.id },
        deviceOptions: {
          categories: post.categories,
          postId: post.id,
        },
      },
    );
  }

  /**
   * Send push notifications for an event to eligible devices based on average relevance.
   *
   * @param event - The event notification data
   * @param averageRelevance - The average relevance threshold used to filter eligible devices
   */
  async sendEventPush(
    event: EventNotificationData,
    averageRelevance?: number,
  ): Promise<void> {
    if (averageRelevance === undefined) {
      this.logger.warn(
        'No average relevance provided for event push notification',
        {
          eventId: event.uuid,
          status: event.status,
        },
      );
      return;
    }

    await this.sendPushNotification(
      'event',
      averageRelevance,
      averageRelevance, // Events use the averageRelevance as both value and threshold
      () => ({
        postId: event.uuid, // Using event UUID as identifier
        relevance: averageRelevance,
        categories: [], // Events don't have specific categories
        title: event.status === 'created' ? 'Monitor Alert' : 'Monitor Update',
        body: this.truncateContent(event.title),
        badge: 1,
      }),
      {
        id: event.uuid,
        logContext: {
          eventId: event.uuid,
          status: event.status,
          averageRelevance,
        },
      },
    );
  }

  /**
   * Sends a test push notification to a specified device token.
   *
   * @param deviceToken - The device token to which the test notification will be sent.
   */
  async sendTestNotification(deviceToken: string): Promise<void> {
    const notification = {
      postId: 'test',
      title: 'Test Notification',
      body: 'Your push notifications are working correctly!',
      relevance: 1.0,
      categories: ['test'],
      publishedAt: new Date().toISOString(),
    };

    await this.apnsService.sendNotificationToDevices(
      [deviceToken],
      notification,
    );
  }

  /**
   * Generic method to send push notifications for any notification type.
   * Handles threshold checking, device filtering, batching, and logging.
   *
   * @param type - The notification type ('post' or 'event')
   * @param relevance - The relevance score to check against threshold
   * @param relevanceThreshold - Minimum relevance required
   * @param payloadBuilder - Function that builds the notification payload
   * @param context - Context for logging and device filtering
   */
  private async sendPushNotification(
    type: 'post' | 'event',
    relevance: number,
    relevanceThreshold: number,
    payloadBuilder: () => any,
    context: {
      id: string;
      logContext: Record<string, any>;
      deviceOptions?: {
        categories?: string[];
        postId?: string;
      };
    },
  ): Promise<void> {
    /**
     * Check relevance threshold
     */
    if (relevance < relevanceThreshold) {
      this.logger.log(`Skipping APN for ${type} - relevance too low`, {
        ...context.logContext,
        relevance,
        threshold: relevanceThreshold,
      });
      return;
    }

    /**
     * Get eligible devices
     */
    const eligibleDevices = await this.getEligibleDevices(
      type,
      relevance,
      context.deviceOptions || {},
    );

    if (eligibleDevices.length === 0) {
      this.logger.log(`No devices meet ${type} relevance threshold`, {
        ...context.logContext,
        relevance,
        threshold: relevanceThreshold,
      });
      return;
    }

    /**
     * Send notifications in batches
     */
    await this.sendNotificationBatches(eligibleDevices, payloadBuilder, {
      type,
      id: context.id,
      batchSize: 100,
    });

    this.logger.log(`${type} push notification sent successfully`, {
      ...context.logContext,
      relevance,
      devicesCount: eligibleDevices.length,
    });
  }

  /**
   * Retrieves eligible devices for notifications based on type and filtering options.
   *
   * @param type - The notification type ('post' or 'event')
   * @param relevance - The relevance score
   * @param options - Filtering options
   */
  private async getEligibleDevices(
    type: 'post' | 'event',
    relevance: number,
    options: {
      categories?: string[];
      postId?: string;
      userThresholds?: boolean;
    } = {},
  ): Promise<Device[]> {
    if (type === 'post') {
      /**
       * For posts, filter devices based on categories and unread status
       */
      const targetDevices = await this.deviceService.getNotificationTargets(
        relevance,
        options.categories || [],
      );

      if (targetDevices.length === 0 || !options.postId) {
        return targetDevices;
      }

      /**
       * Check unread status for the specified post
       */
      return await this.deviceService.getUnreadDevices(
        options.postId,
        targetDevices,
      );
    } else {
      /**
       * For events, filter devices based on user-specific relevance thresholds
       */
      const allDevices = await this.deviceService.getAllDevices();
      return allDevices.filter(
        (device) => relevance >= device.relevanceThreshold,
      );
    }
  }

  /**
   * Sends notifications to devices in batches.
   *
   * @param devices - Array of devices to send notifications to
   * @param payloadBuilder - Function that builds the notification payload
   * @param context - Context object with type, id, and optional batch size
   */
  private async sendNotificationBatches(
    devices: Device[],
    payloadBuilder: (device: Device) => any,
    context: { type: string; id: string; batchSize?: number },
  ): Promise<void> {
    const batchSize = context.batchSize || 100;
    const batches: Device[][] = [];

    /**
     * Split devices into batches
     */
    for (let i = 0; i < devices.length; i += batchSize) {
      batches.push(devices.slice(i, i + batchSize));
    }

    /**
     * Process each batch
     */
    for (const batch of batches) {
      try {
        for (const device of batch) {
          const payload = payloadBuilder(device);
          await this.apnsService.sendNotification(device.deviceToken, payload);
        }

        this.logger.log(`${context.type} notification batch sent`, {
          [`${context.type}Id`]: context.id,
          batchSize: batch.length,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send ${context.type} notification batch`,
          '',
          {
            [`${context.type}Id`]: context.id,
            batchSize: batch.length,
            error: error.message,
          },
        );
      }
    }
  }

  /**
   * Truncates content to maximum length, removing HTML tags.
   */
  private truncateContent(content: string): string {
    const maxLength = 200;
    const plainText = content
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return plainText.length > maxLength
      ? `${plainText.substring(0, maxLength)}...`
      : plainText;
  }
}
