import {
  Injectable,
  MessageEvent,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  Observable,
  Subject,
  filter,
  map,
  startWith,
  mergeWith,
  interval,
  finalize,
} from 'rxjs';
import { Logger } from 'src/decorators/logger.decorator';
import { JSONLogger } from 'src/utils/logger';
import { CommonNotifications } from './common.notifications';
import { INotificationsService } from './notifications.service.interface';
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
   * Generates a unique client ID.
   *
   * @returns {string} A randomly generated string of 9 characters.
   */
  private generateClientId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * The global subject that emits message events.
   */
  private globalSubject = new Subject<NotificationMessage>();

  /**
   * Establishes a connection and returns an observable that emits message events.
   *
   * @returns {Observable<MessageEvent>} An observable that emits message events filtered by client ID.
   */
  connect(): Observable<MessageEvent> {
    const clientId = this.generateClientId();

    // Create keepalive observable that sends ping every 25 seconds
    // Use 25 seconds instead of 30 to ensure we stay ahead of typical timeout settings
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

    // Create data observable for actual messages
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

    // Combine data and keepalive streams
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
        // Clean up client when the observable is torn down (client disconnected)
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
      // Emit to disconnectSubject to complete the observable
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
    const clientCount = Object.keys(this.clients).length;
    const notificationMessage = {
      message: {
        data: JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        }),
      },
    };
    this.logger.log(`Broadcasting message to ${clientCount} clients`);
    this.logger.debug('Broadcast message:', notificationMessage);
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
}
