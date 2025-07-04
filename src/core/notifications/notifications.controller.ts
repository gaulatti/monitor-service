import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Public } from 'src/decorators/public.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Establishes a connection to the notifications service and returns an observable
   * that emits MessageEvent objects.
   *
   * @returns {Observable<MessageEvent>} An observable that emits MessageEvent objects.
   */
  @Sse()
  @Public()
  connect(): Observable<MessageEvent> {
    return this.notificationsService.connect();
  }

  /**
   * Gets the health status and connection statistics of the notifications service.
   *
   * @returns {object} Health status and connection statistics.
   */
  @Get('health')
  @Public()
  getHealth() {
    return {
      healthy: this.notificationsService.isHealthy(),
      ...this.notificationsService.getConnectionStats(),
    };
  }
}
