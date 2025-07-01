import { Controller, Get, MessageEvent, Req, Sse } from '@nestjs/common';
import { Request } from 'express';
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
   * @param req - The HTTP request object
   * @param res - The HTTP response object
   * @returns {Observable<MessageEvent>} An observable that emits MessageEvent objects.
   */
  @Sse()
  @Public()
  connect(@Req() req: Request): Observable<MessageEvent> {
    // Handle client disconnect
    req.on('close', () => {
      // The connection cleanup is handled by the finalize operator in the service
    });

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
