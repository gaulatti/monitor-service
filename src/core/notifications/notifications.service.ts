import {
  Injectable,
  MessageEvent,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Logger } from 'src/decorators/logger.decorator';
import { JSONLogger } from 'src/utils/logger';
import { INotificationsService } from './notifications.service.interface';
import {
  PushService,
  PostNotificationData,
  EventNotificationData,
} from './push/push.service';
import { SSEService } from './sse/sse.service';

/**
 * Orchestrator service for managing dual-channel notifications.
 *
 * NOTIFICATION ARCHITECTURE:
 * This service coordinates notifications across multiple channels:
 * 1. SSE (Server-Sent Events): Real-time web client updates via SSEService
 * 2. APN (Apple Push Notifications): Mobile device notifications via PushService
 *
 * ORCHESTRATION PATTERN:
 * - NotificationsService: High-level orchestrator and public API
 * - SSEService: Manages web client connections and SSE broadcasting
 * - PushService: Handles mobile push notifications and device filtering
 *
 * METHOD NAMING CONVENTION:
 * - notify{Type}(): Complete notifications (both SSE + APN)
 * - broadcast{Type}(): SSE-only notifications (delegates to SSEService)
 * - send{Type}PushOnly(): APN-only notifications (delegates to PushService)
 *
 * NOTIFICATION RULES:
 * - Posts: APN only for relevance 8.0+ (fixed threshold for quality)
 * - Events: APN based on user-specific thresholds (device.relevanceThreshold)
 * - SSE: Always broadcasts to all connected web clients
 *
 * USAGE EXAMPLES:
 * - notifyPost(): Complete post notification (SSE + conditional APN)
 * - notifyEvent(): Complete event notification (SSE + conditional APN)
 * - notifyIngestedPost(): Complete ingested post notification with detailed metadata
 * - broadcastPost(): Web-only post notification
 * - sendPostPushOnly(): Mobile-only post notification
 */
@Injectable()
export class NotificationsService
  implements INotificationsService, OnApplicationShutdown
{
  @Logger(NotificationsService.name)
  private readonly logger!: JSONLogger;

  constructor(
    private readonly sseService: SSEService,
    private readonly pushService: PushService,
  ) {}

  // ============================================================================
  // SSE CONNECTION MANAGEMENT (delegated to SSEService)
  // ============================================================================

  /**
   * Establishes a new SSE connection.
   * Delegates to SSEService for connection management.
   */
  connect(): Observable<MessageEvent> {
    return this.sseService.connect();
  }

  /**
   * Sends a message to a specific SSE client.
   * Delegates to SSEService.
   */
  sendMessageToClient(clientId: string, message: string): void {
    this.sseService.sendMessageToClient(clientId, message);
  }

  /**
   * Disconnects a specific SSE client.
   * Delegates to SSEService.
   */
  disconnect(clientId: string): void {
    this.sseService.disconnect(clientId);
  }

  /**
   * Gets current SSE connection statistics.
   * Delegates to SSEService.
   */
  getConnectionStats(): object {
    return this.sseService.getConnectionStats();
  }

  /**
   * Checks if the notification services are healthy.
   * Checks both SSE and Push service health.
   */
  isHealthy(): boolean {
    return this.sseService.isHealthy();
  }

  /**
   * Application shutdown lifecycle hook.
   * Coordinates shutdown of both SSE and Push services.
   */
  onApplicationShutdown(): void {
    this.logger.log('Shutting down NotificationsService orchestrator');
    this.sseService.onApplicationShutdown();
  }

  // ============================================================================
  // COMPLETE NOTIFICATIONS (SSE + Push orchestration)
  // ============================================================================

  /**
   * Send COMPLETE notifications (both SSE and APN) for a new post.
   *
   * SSE: Always broadcasts to all connected web clients
   * APN: Only sends push notifications for posts with relevance 8.0+
   *
   * This method orchestrates both notification channels for posts.
   */
  async notifyPost(post: PostNotificationData): Promise<void> {
    await this.executeNotificationFlow(
      post,
      { type: 'post', id: post.id },
      (data) => this.broadcastPost(data),
      (data) => this.sendPostPushOnly(data),
    );
  }

  /**
   * Send COMPLETE notifications (both SSE and APN) for event creation or updates.
   *
   * SSE: Always broadcasts to all connected web clients
   * APN: Sends push notifications based on user-specific thresholds
   *
   * This method orchestrates both notification channels for events.
   */
  async notifyEvent(
    event: EventNotificationData,
    averageRelevance?: number,
  ): Promise<void> {
    await this.executeNotificationFlow(
      { event, averageRelevance },
      { type: 'event', id: event.uuid },
      (data) => this.broadcastEvent(data.event, data.averageRelevance),
      (data) => this.sendEventPushOnly(data.event, data.averageRelevance),
    );
  }

  /**
   * COMPLETE notifications for a post from the ingestion pipeline (both SSE and APN).
   *
   * This method handles the complete notification flow for posts coming from ingestion:
   * 1. Broadcasts detailed post data to SSE clients (for real-time web UI)
   * 2. Sends push notifications using the same logic as any other post
   */
  async notifyIngestedPost(post: any, categories: any[]): Promise<void> {
    const startTime = Date.now();

    try {
      // Broadcast to SSE clients with detailed metadata
      this.sseService.broadcastIngestedPost(post, categories);

      // Send push notifications (same 8.0+ threshold as any other post)
      const postNotificationData: PostNotificationData = {
        id: post.uuid,
        title: this.extractTitle(post.content),
        content: post.content,
        relevance: post.relevance,
        categories: categories.map((category) => category.slug),
        url: post.uri,
        publishedAt: post.posted_at.toISOString(),
      };

      await this.pushService.sendPostPush(postNotificationData);

      const duration = Date.now() - startTime;
      this.logger.log('Ingested post notification completed successfully', {
        postId: post.uuid,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to send notifications for new post', '', {
        postId: post.uuid,
        source: post.source,
        relevance: post.relevance,
        error: error.message,
        stack: error.stack,
        durationMs: duration,
      });
      throw error;
    }
  }

  // ============================================================================
  // SSE-ONLY NOTIFICATIONS (delegated to SSEService)
  // ============================================================================

  /**
   * Broadcasts a post notification to SSE clients ONLY.
   * Delegates to SSEService.
   */
  broadcastPost(post: PostNotificationData): void {
    this.sseService.broadcastPost(post);
  }

  /**
   * Broadcasts an event notification to SSE clients ONLY.
   * Delegates to SSEService.
   */
  broadcastEvent(
    event: EventNotificationData,
    averageRelevance?: number,
  ): void {
    this.sseService.broadcastEvent(event, averageRelevance);
  }

  /**
   * Generic broadcast method for custom messages.
   * Delegates to SSEService.
   */
  broadcast(message: object): void {
    this.sseService.broadcast(message);
  }

  // ============================================================================
  // PUSH-ONLY NOTIFICATIONS (delegated to PushService)
  // ============================================================================

  /**
   * Send push notifications for a post to mobile devices ONLY.
   * Delegates to PushService.
   */
  async sendPostPushOnly(
    post: PostNotificationData,
    relevanceThreshold: number = 8.0,
  ): Promise<void> {
    await this.pushService.sendPostPush(post, relevanceThreshold);
  }

  /**
   * Send push notifications for an event to mobile devices ONLY.
   * Delegates to PushService.
   */
  async sendEventPushOnly(
    event: EventNotificationData,
    averageRelevance?: number,
  ): Promise<void> {
    await this.pushService.sendEventPush(event, averageRelevance);
  }

  /**
   * Send a test push notification.
   * Delegates to PushService.
   */
  async sendTestNotification(deviceToken: string): Promise<void> {
    await this.pushService.sendTestNotification(deviceToken);
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Sends notifications for a list of posts in bulk.
   * Processes each post sequentially with rate limiting.
   */
  async sendBulkNotifications(posts: PostNotificationData[]): Promise<void> {
    for (const post of posts) {
      try {
        await this.notifyPost(post);
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

  // ============================================================================
  // PRIVATE ORCHESTRATION HELPERS
  // ============================================================================

  /**
   * Generic orchestration method for dual-channel notifications.
   * Coordinates SSE broadcasting and push notification delivery.
   */
  private async executeNotificationFlow<T>(
    data: T,
    context: { type: string; id: string },
    broadcastFn: (data: T) => void,
    pushFn: (data: T) => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Always broadcast to SSE clients first
      broadcastFn(data);

      // Send push notifications
      await pushFn(data);

      const duration = Date.now() - startTime;
      this.logger.log(`${context.type} notification completed successfully`, {
        [`${context.type}Id`]: context.id,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to send complete ${context.type} notification`,
        '',
        {
          [`${context.type}Id`]: context.id,
          error: error.message,
          stack: error.stack,
          durationMs: duration,
        },
      );
      throw error;
    }
  }

  /**
   * Extracts a title from post content for notifications.
   * Takes the first line or sentence of content, up to 60 characters.
   */
  private extractTitle(content: string): string {
    if (!content) {
      return 'New Post';
    }

    // Remove HTML tags and extra whitespace
    const cleanContent = content
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Take first sentence or line, limited to 60 characters
    const firstSentence = cleanContent.split(/[.!?]\s+/)[0];
    const firstLine = cleanContent.split('\n')[0];

    // Use the shorter of first sentence or first line
    const title =
      firstSentence.length <= firstLine.length ? firstSentence : firstLine;

    // Truncate to 60 characters for push notification limits
    return title.length > 60 ? `${title.substring(0, 60)}...` : title;
  }
}
