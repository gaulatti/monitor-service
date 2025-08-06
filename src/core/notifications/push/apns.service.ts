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
    this.logger.log('Initializing APNs provider', {
      timestamp: new Date().toISOString(),
    });

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

      this.logger.log('APNs configuration loaded', {
        hasKeyId: !!keyId,
        hasTeamId: !!teamId,
        hasBundleId: !!bundleId,
        hasPrivateKey: !!privateKey,
        hasPrivateKeyPath: !!privateKeyPath,
        isProduction,
        keyIdLength: keyId?.length || 0,
        teamIdLength: teamId?.length || 0,
        bundleId: bundleId || 'not set',
      });

      if (!keyId || !teamId || !bundleId) {
        this.logger.error('APNs configuration validation failed', '', {
          missingFields: {
            keyId: !keyId,
            teamId: !teamId,
            bundleId: !bundleId,
          },
          message:
            'Missing required environment variables (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID)',
        });
        return;
      }

      if (!privateKey && !privateKeyPath) {
        this.logger.error('APNs private key configuration missing', '', {
          hasPrivateKey: !!privateKey,
          hasPrivateKeyPath: !!privateKeyPath,
          message: 'Requires either APNS_PRIVATE_KEY or APNS_PRIVATE_KEY_PATH',
        });
        return;
      }

      let keyData: string | Buffer | undefined;

      if (privateKey) {
        this.logger.log('Processing private key from environment variable', {
          keyLength: privateKey.length,
          isPemFormat: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
        });

        // Handle private key from environment variable
        try {
          // Check if it's base64 encoded
          if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            // Already in PEM format
            keyData = privateKey;
            this.logger.log('Private key is in PEM format');
          } else {
            // Assume it's base64 encoded, decode it
            keyData = Buffer.from(privateKey, 'base64').toString('utf8');
            this.logger.log('Private key decoded from base64');
          }
        } catch (error) {
          this.logger.error('Failed to process APNS_PRIVATE_KEY', '', {
            error: error.message,
            keyLength: privateKey.length,
            stack: error.stack,
          });
          return;
        }
      } else if (privateKeyPath) {
        this.logger.log('Using private key from file path', {
          path: privateKeyPath,
        });
        // Handle private key from file path
        keyData = privateKeyPath;
      }

      if (!keyData) {
        this.logger.error('No valid private key configuration found');
        return;
      }

      this.logger.log('Creating APNs provider', {
        keyId,
        teamId,
        bundleId,
        isProduction,
        keyDataType: typeof keyData,
        keyDataLength: typeof keyData === 'string' ? keyData.length : 'N/A',
      });

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

      this.logger.log('APNs provider initialized successfully', {
        isProduction,
        bundleId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to initialize APNs provider', '', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send push notification to a device
   */
  async sendNotification(
    deviceToken: string,
    payload: PushNotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    const maskedToken = this.maskDeviceToken(deviceToken);

    if (!this.isInitialized) {
      this.logger.error('APNs provider not initialized', '', {
        maskedDeviceToken: maskedToken,
        postId: payload.postId,
      });
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
        this.logger.log('Push notification sent successfully', {
          maskedDeviceToken: maskedToken,
          postId: payload.postId,
          sentCount: result.sent.length,
          timestamp: new Date().toISOString(),
        });
        return { success: true };
      } else if (result.failed.length > 0) {
        const failure = result.failed[0];
        const errorMessage = failure.error?.message || 'Unknown error';
        const errorCode = failure.status || 'Unknown status';

        this.logger.error('Push notification failed', '', {
          maskedDeviceToken: maskedToken,
          postId: payload.postId,
          errorMessage,
          errorCode,
          failedCount: result.failed.length,
          device: failure.device,
        });
        return { success: false, error: errorMessage };
      }

      this.logger.warn('No response from APNs', {
        maskedDeviceToken: maskedToken,
        postId: payload.postId,
        sentCount: result.sent.length,
        failedCount: result.failed.length,
      });

      return { success: false, error: 'No result from APNs' };
    } catch (error) {
      this.logger.error('Error sending push notification', '', {
        maskedDeviceToken: maskedToken,
        postId: payload.postId,
        error: error.message,
        stack: error.stack,
      });
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
          const maskedToken = this.maskDeviceToken(deviceToken);
          results.errors.push(`${maskedToken}: ${result.error}`);
        }
      }
    });

    await Promise.all(promises);

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

  /**
   * Mask device token for logging (show first 8 and last 4 characters)
   */
  private maskDeviceToken(token: string): string {
    if (!token || token.length < 12) {
      return '***masked***';
    }
    return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
  }
}
