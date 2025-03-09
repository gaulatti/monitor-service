import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Logger } from 'src/decorators/logger.decorator';
import { JSONLogger } from 'src/utils/logger';

@Injectable()
export class BlueskyService {
  /**
   * Logger instance for logging messages.
   */
  @Logger(BlueskyService.name)
  private readonly logger!: JSONLogger;

  @Cron('* * * * *')
  async monitorBluesky(): Promise<void> {
    try {
      this.logger.log('lala');
      return Promise.resolve();
    } catch (error) {
      this.logger.error('Monitoring from Bluesky failed:', error);
    }
  }
}
