import { Module } from '@nestjs/common';
import { BlueskyController } from './bluesky/bluesky.controller';
import { BlueskyService } from './bluesky/bluesky.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [BlueskyService],
  controllers: [BlueskyController],
})
export class MonitoringModule {}
