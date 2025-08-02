import {
  Injectable,
  MessageEvent,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  Observable,
  Subject,
  filter,
  finalize,
  interval,
  map,
  mergeWith,
  startWith,
} from 'rxjs';
import { Logger } from 'src/decorators/logger.decorator';
import { Device } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { CommonNotifications } from './common.notifications';
import { INotificationsService } from './notifications.service.interface';
import { ApnsService } from './push/apns.service';
import { DeviceService } from './push/device.service';

export interface PostNotificationData {
  id: string;
  title: string;
  content: string;
  relevance: number;
  categories: string[];
  url?: string;
  publishedAt: string;
}

/**
 * Represents a client that receives notifications.
 *
 * @typedef {Object} NotificationClient
 * @property {string} id - The unique identifier for the notification client.
 * @property {(message: any) => boolean} [filter] - An optional function to filter messages.
 * If provided, it should return `true` if the message should be processed, or `false` otherwise.
 */
export type NotificationClient = {
  id: string;
  filter?: (message: any) => boolean;
};

/**
 * Represents a notification message.
 *
 * @typedef {Object} NotificationMessage
 * @property {string} [clientId] - The optional client identifier.
 * @property {MessageEvent} message - The message event associated with the notification.
 */
export type NotificationMessage = {
  clientId?: string;
  message: MessageEvent;
};

/**
 * Service responsible for managing notifications and client connections.
 */
@Injectable()
export class NotificationsService
  extends CommonNotifications
  implements INotificationsService, OnApplicationShutdown
{
  /**
   * Logger instance for logging messages.
   */
  @Logger(NotificationsService.name)
  private readonly logger!: JSONLogger;

  /**
   * The clients that are connected to the notification service.
   */
  private clients: Record<string, NotificationClient> = {};

  /**
   * Subject to handle client disconnections
   */
  private disconnectSubject = new Subject<string>();

  /**
   * The global subject that emits message events.
   */
  private globalSubject = new Subject<NotificationMessage>();

  constructor(
    private readonly deviceService: DeviceService,
    private readonly apnsService: ApnsService,
  ) {
    super();
  }

  /**
   * Generates a unique client ID.
   *
   * @returns {string} A randomly generated string of 9 characters.
   */
  private generateClientId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Establishes a connection and returns an observable that emits message events.
   *
   * @returns {Observable<MessageEvent>} An observable that emits message events filtered by client ID.
   */
  connect(): Observable<MessageEvent> {
    const clientId = this.generateClientId();

    /**
     * Create a keepalive observable that emits a ping message every 25 seconds.
     */
    const keepalive$ = interval(25000).pipe(
      map(
        () =>
          ({
            data: JSON.stringify({
              type: 'ping',
              timestamp: new Date().toISOString(),
              clientId,
            }),
          }) as MessageEvent,
      ),
    );

    /**
     * Filter the global subject to only emit messages for the current client ID.
     */
    const data$ = this.globalSubject.pipe(
      filter((event) => {
        const shouldPass = !event.clientId || event.clientId === clientId;
        this.logger.debug(
          `Filter check for client ${clientId}: ${shouldPass}`,
          event,
        );
        return shouldPass;
      }),
      map((event) => event.message),
    );

    /**
     * Combine the data observable with the keepalive observable.
     */
    const observable = data$.pipe(
      mergeWith(keepalive$),
      startWith({
        data: JSON.stringify({
          type: 'connected',
          clientId,
          timestamp: new Date().toISOString(),
        }),
      } as MessageEvent),
      finalize(() => {
        /**
         * Cleanup the client when the observable is torn down.
         */
        this.cleanupClient(clientId);
      }),
    );

    this.clients[clientId] = { id: clientId };
    this.logger.log(`Client connected: ${clientId}`);
    this.logger.log(`Total clients: ${Object.keys(this.clients).length}`);

    return observable;
  }

  /**
   * Sends a message to a specific client.
   *
   * @param clientId - The unique identifier of the client.
   * @param message - The message to be sent to the client.
   *
   * @remarks
   * If the client is found, the message is sent via the globalSubject.
   * If the client is not found, an error is logged.
   */
  sendMessageToClient(clientId: string, message: string) {
    if (this.clients[clientId]) {
      this.globalSubject.next({ clientId, message: { data: message } });
    } else {
      this.logger.error(`Client ${clientId} not found`);
    }
  }

  /**
   * Disconnects a client by their client ID.
   *
   * This method removes the client from the `clients` collection if they exist.
   * It logs a message indicating whether the client was successfully disconnected
   * or if the client was not found.
   *
   * @param clientId - The unique identifier of the client to disconnect.
   */
  disconnect(clientId: string) {
    if (this.clients[clientId]) {
      delete this.clients[clientId];

      /**
       * Emit a disconnect event to the disconnectSubject.
       */
      this.disconnectSubject.next(clientId);
      this.logger.log(`Client disconnected: ${clientId}`);
      this.logger.log(`Total clients: ${Object.keys(this.clients).length}`);
    } else {
      this.logger.log('Client not found for disconnection', clientId);
    }
  }

  /**
   * Lifecycle hook called when the application is shutting down.
   * Disconnects all connected clients.
   */
  onApplicationShutdown(): void {
    const clientIds = Object.keys(this.clients);
    this.logger.log(`Shutting down, disconnecting ${clientIds.length} clients`);

    for (const clientId of clientIds) {
      this.disconnect(clientId);
    }

    // Complete all subjects
    this.disconnectSubject.complete();
    this.globalSubject.complete();
  }

  /**
   * Broadcasts a message to all subscribers.
   *
   * @param message - The message object to be broadcasted. It will be serialized to a JSON string.
   */
  broadcast(message: object) {
    const notificationMessage = {
      message: {
        data: JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        }),
      },
    };
    this.globalSubject.next(notificationMessage);
  }

  /**
   * Gets the current connection statistics.
   *
   * @returns {object} Connection statistics including client count and client IDs.
   */
  getConnectionStats() {
    const clientIds = Object.keys(this.clients);
    return {
      clientCount: clientIds.length,
      clientIds,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Checks if the service is healthy and ready to accept connections.
   *
   * @returns {boolean} True if the service is healthy, false otherwise.
   */
  isHealthy(): boolean {
    return !this.globalSubject.closed && !this.disconnectSubject.closed;
  }

  /**
   * Cleans up a client by removing them from the clients collection.
   *
   * This method is called when the SSE observable is torn down (finalized).
   * Unlike disconnect(), this method only performs cleanup without emitting
   * to the disconnectSubject, since the client has already disconnected.
   *
   * @param clientId - The unique identifier of the client to clean up.
   */
  private cleanupClient(clientId: string) {
    if (this.clients[clientId]) {
      delete this.clients[clientId];
      this.logger.log(`Client cleaned up: ${clientId}`);
      this.logger.log(`Total clients: ${Object.keys(this.clients).length}`);
    } else {
      this.logger.debug('Client not found for cleanup', clientId);
    }
  }

  /**
   * Send push notifications for a new post to relevant devices
   */
  async sendPostNotification(post: PostNotificationData): Promise<void> {
    const startTime = Date.now();

    try {
      // Get devices that should receive this notification
      const targetDevices = await this.deviceService.getNotificationTargets(
        post.relevance,
        post.categories,
      );

      if (targetDevices.length === 0) {
        return;
      }

      // Filter out devices that have already read this post
      const unreadDevices = await this.deviceService.getUnreadDevices(
        post.id,
        targetDevices,
      );

      if (unreadDevices.length === 0) {
        return;
      }

      // Send notifications in batches
      void this.sendNotificationBatch(post, unreadDevices);

      // Also broadcast to SSE clients
      this.broadcast({
        type: 'new_post',
        post: {
          id: post.id,
          title: post.title,
          relevance: post.relevance,
          categories: post.categories,
          publishedAt: post.publishedAt,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Error in post notification process', '', {
        postId: post.id,
        error: error.message,
        stack: error.stack,
        durationMs: duration,
      });
      this.logger.error(
        `Error sending notifications for post ${post.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send notifications to a batch of devices
   */
  private sendNotificationBatch(post: PostNotificationData, devices: Device[]) {
    const deviceTokens = devices.map((device) => device.deviceToken);

    // Prepare notification payload using the expected interface
    const notification = {
      postId: post.id,
      title: this.truncateTitle(post.title),
      body: this.truncateContent(post.content),
      relevance: post.relevance,
      categories: post.categories,
      url: post.url,
      publishedAt: post.publishedAt,
    };

    // Send notifications using APNs service
    void this.apnsService.sendNotificationToDevices(deviceTokens, notification);
  }

  /**
   * Send a test notification to a specific device
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

    this.logger.log(`Test notification sent to device: ${deviceToken}`);
  }

  /**
   * Send bulk notifications for multiple posts (used for catch-up scenarios)
   */
  async sendBulkNotifications(posts: PostNotificationData[]): Promise<void> {
    this.logger.log(`Sending bulk notifications for ${posts.length} posts`);

    for (const post of posts) {
      try {
        await this.sendPostNotification(post);

        // Add small delay between notifications to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(
          `Error sending notification for post ${post.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Truncate title for push notification (iOS limit: ~178 characters total)
   */
  private truncateTitle(title: string): string {
    const maxLength = 60;
    return title.length > maxLength
      ? `${title.substring(0, maxLength)}...`
      : title;
  }

  /**
   * Truncate content for push notification body
   */
  private truncateContent(content: string): string {
    const maxLength = 100;
    // Remove HTML tags and extra whitespace
    const plainText = content
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return plainText.length > maxLength
      ? `${plainText.substring(0, maxLength)}...`
      : plainText;
  }
}
