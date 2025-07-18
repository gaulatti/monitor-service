import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as apn from 'node-apn';
import { JSONLogger } from 'src/utils/logger';
import { Logger as CustomLogger } from 'src/decorators/logger.decorator';

/**
 * Push notification payload interface
 */
export interface PushNotificationPayload {
  postId: string;
  relevance: number;
  categories: string[];
  title: string;
  body: string;
  badge?: number;
}

/**
 * APNs service for handling Apple Push Notifications
 */
@Injectable()
export class ApnsService {
  private apnProvider: apn.Provider;
  private isInitialized = false;

  @CustomLogger(ApnsService.name)
  private readonly logger!: JSONLogger;

  constructor(private readonly configService: ConfigService) {
    this.initializeProvider();
  }

  /**
   * Initialize the APNs provider with configuration
   */
  private initializeProvider(): void {
    try {
      const keyId = this.configService.get<string>('APNS_KEY_ID');
      const teamId = this.configService.get<string>('APNS_TEAM_ID');
      const privateKey = this.configService.get<string>('APNS_PRIVATE_KEY');
      const privateKeyPath = this.configService.get<string>(
        'APNS_PRIVATE_KEY_PATH',
      );
      const bundleId = this.configService.get<string>('APNS_BUNDLE_ID');
      const isProduction = this.configService.get<boolean>(
        'APNS_PRODUCTION',
        false,
      );

      if (!keyId || !teamId || !bundleId) {
        this.logger.error(
          'APNs configuration is missing required environment variables (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID)',
        );
        return;
      }

      if (!privateKey && !privateKeyPath) {
        this.logger.error(
          'APNs configuration requires either APNS_PRIVATE_KEY or APNS_PRIVATE_KEY_PATH',
        );
        return;
      }

      let keyData: string | Buffer | undefined;

      if (privateKey) {
        // Handle private key from environment variable
        try {
          // Check if it's base64 encoded
          if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            // Already in PEM format
            keyData = privateKey;
          } else {
            // Assume it's base64 encoded, decode it
            keyData = Buffer.from(privateKey, 'base64').toString('utf8');
          }
          this.logger.log(
            'Using private key from APNS_PRIVATE_KEY environment variable',
          );
        } catch (error) {
          this.logger.error('Failed to process APNS_PRIVATE_KEY:', error);
          return;
        }
      } else if (privateKeyPath) {
        // Handle private key from file path
        keyData = privateKeyPath;
        this.logger.log('Using private key from file path:', privateKeyPath);
      }

      if (!keyData) {
        this.logger.error('No valid private key configuration found');
        return;
      }

      const options: apn.ProviderOptions = {
        token: {
          key: keyData,
          keyId: keyId,
          teamId: teamId,
        },
        production: isProduction,
      };

      this.apnProvider = new apn.Provider(options);
      this.isInitialized = true;

      this.logger.log(
        `APNs provider initialized for ${isProduction ? 'production' : 'development'} environment`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize APNs provider:', error);
    }
  }

  /**
   * Send push notification to a device
   */
  async sendNotification(
    deviceToken: string,
    payload: PushNotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      return { success: false, error: 'APNs provider not initialized' };
    }

    try {
      const notification = new apn.Notification();
      
      // Set notification properties
      notification.alert = {
        title: payload.title,
        body: payload.body,
      };
      notification.badge = payload.badge || 1;
      notification.sound = 'default';
      notification.topic = this.configService.get<string>('APNS_BUNDLE_ID')!;
      
      // Set custom payload data
      notification.payload = {
        postId: payload.postId,
        relevance: payload.relevance,
        categories: payload.categories,
        category: 'POST_NOTIFICATION',
      };

      // Set expiration (1 hour from now)
      notification.expiry = Math.floor(Date.now() / 1000) + 3600;

      const result = await this.apnProvider.send(notification, deviceToken);

      if (result.sent.length > 0) {
        this.logger.log(
          `Push notification sent successfully to device: ${deviceToken}`,
        );
        return { success: true };
      } else if (result.failed.length > 0) {
        const failure = result.failed[0];
        const errorMessage = failure.error?.message || 'Unknown error';
        this.logger.error(
          `Push notification failed for device ${deviceToken}: ${errorMessage}`,
        );
        return { success: false, error: errorMessage };
      }

      return { success: false, error: 'No result from APNs' };
    } catch (error) {
      this.logger.error(
        `Error sending push notification to ${deviceToken}:`,
        error,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notifications to multiple devices
   */
  async sendNotificationToDevices(
    deviceTokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const promises = deviceTokens.map(async (deviceToken) => {
      const result = await this.sendNotification(deviceToken, payload);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${deviceToken}: ${result.error}`);
        }
      }
    });

    await Promise.all(promises);

    this.logger.log(
      `Bulk notification results: ${results.success} success, ${results.failed} failed`,
    );

    return results;
  }

  /**
   * Validate device token format
   */
  isValidDeviceToken(deviceToken: string): boolean {
    // APNs device tokens are typically 64 hex characters
    const tokenRegex = /^[a-fA-F0-9]{64}$/;
    return tokenRegex.test(deviceToken);
  }

  /**
   * Shutdown the APNs provider
   */
  shutdown(): void {
    if (this.apnProvider) {
      this.apnProvider.shutdown();
      this.logger.log('APNs provider shutdown completed');
    }
  }
}
