import { Injectable, MessageEvent } from '@nestjs/common';
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
import { JSONLogger } from 'src/utils/logger';
import { CommonNotifications } from '../common.notifications';

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
 * Represents a client that receives notifications.
 */
export type NotificationClient = {
  id: string;
  filter?: (message: any) => boolean;
};

/**
 * Represents a notification message.
 */
export type NotificationMessage = {
  clientId?: string;
  message: MessageEvent;
};

/**
 * Service responsible for managing SSE (Server-Sent Events) connections and broadcasting.
 *
 * RESPONSIBILITIES:
 * - Client connection management (connect/disconnect lifecycle)
 * - SSE message broadcasting to web clients
 * - Connection health monitoring and statistics
 * - Keepalive ping messages to maintain connections
 *
 * BROADCASTING RULES:
 * - Always broadcasts to all connected web clients
 * - No filtering based on relevance thresholds
 * - Includes detailed metadata for web UI consumption
 */
@Injectable()
export class SSEService extends CommonNotifications {
  @Logger(SSEService.name)
  private readonly logger!: JSONLogger;

  /**
   * Connected clients registry
   */
  private clients: Record<string, NotificationClient> = {};

  /**
   * Subject for client disconnections
   */
  private disconnectSubject = new Subject<string>();

  /**
   * Global subject for broadcasting messages
   */
  private globalSubject = new Subject<NotificationMessage>();

  /**
   * Generates a unique client ID.
   */
  private generateClientId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Establishes a new SSE connection and returns an observable.
   */
  connect(): Observable<MessageEvent> {
    const clientId = this.generateClientId();

    /**
     * Keepalive observable that emits ping every 25 seconds
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
     * Filter messages for this specific client
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
     * Combine data and keepalive streams
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
   */
  sendMessageToClient(clientId: string, message: string): void {
    if (this.clients[clientId]) {
      this.globalSubject.next({ clientId, message: { data: message } });
    } else {
      this.logger.error(`Client ${clientId} not found`);
    }
  }

  /**
   * Disconnects a client by ID.
   */
  disconnect(clientId: string): void {
    if (this.clients[clientId]) {
      delete this.clients[clientId];
      this.disconnectSubject.next(clientId);
      this.logger.log(`Client disconnected: ${clientId}`);
      this.logger.log(`Total clients: ${Object.keys(this.clients).length}`);
    } else {
      this.logger.log('Client not found for disconnection', clientId);
    }
  }

  /**
   * Broadcasts a message to all connected clients.
   */
  broadcast(message: object): void {
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
   * Broadcasts a post notification to all SSE clients.
   */
  broadcastPost(post: PostNotificationData): void {
    this.broadcast({
      type: 'post',
      post: {
        id: post.id,
        title: post.title,
        relevance: post.relevance,
        categories: post.categories,
        publishedAt: post.publishedAt,
      },
    });
  }

  /**
   * Broadcasts an event notification to all SSE clients.
   */
  broadcastEvent(
    event: EventNotificationData,
    averageRelevance?: number,
  ): void {
    this.broadcast({
      type: 'event',
      subtype: event.status,
      id: event.uuid,
      title: event.title,
      summary: event.summary,
      posts_count: event.posts_count,
      status: event.status,
      url: event.url,
      averageRelevance: averageRelevance,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts a detailed ingested post notification to SSE clients.
   */
  broadcastIngestedPost(post: any, categories: any[]): void {
    this.broadcast({
      id: post.uuid,
      content: post.content,
      source: post.source,
      sourceType: 'posts',
      uri: post.uri,
      relevance: post.relevance,
      lang: post.lang,
      hash: post.hash,
      author: post.author,
      author_id: post.author_id,
      author_name: post.author_name,
      author_handle: post.author_handle,
      author_avatar: post.author_avatar,
      media: post.media,
      linkPreview: post.linkPreview,
      original: post.original,
      posted_at: post.posted_at.toISOString(),
      received_at: post.received_at.toISOString(),
      categories: categories.map((category) => category.slug),
      type: 'POST',
    });
  }

  /**
   * Gets current connection statistics.
   */
  getConnectionStats(): object {
    const clientIds = Object.keys(this.clients);
    return {
      clientCount: clientIds.length,
      clientIds,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Checks if the service is healthy.
   */
  isHealthy(): boolean {
    return !this.globalSubject.closed && !this.disconnectSubject.closed;
  }

  /**
   * Cleans up disconnected clients.
   */
  private cleanupClient(clientId: string): void {
    if (this.clients[clientId]) {
      delete this.clients[clientId];
      this.logger.log(`Client cleaned up: ${clientId}`);
      this.logger.log(`Total clients: ${Object.keys(this.clients).length}`);
    } else {
      this.logger.debug('Client not found for cleanup', clientId);
    }
  }

  /**
   * Cleanup all connections on shutdown.
   */
  onApplicationShutdown(): void {
    const clientIds = Object.keys(this.clients);
    this.logger.log(
      `Shutting down SSE service, disconnecting ${clientIds.length} clients`,
    );

    for (const clientId of clientIds) {
      this.disconnect(clientId);
    }

    this.disconnectSubject.complete();
    this.globalSubject.complete();
  }
}
