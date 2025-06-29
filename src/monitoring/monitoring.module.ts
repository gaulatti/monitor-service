import { Module } from '@nestjs/common';
import { BlueskyController } from './bluesky/bluesky.controller';
import { BlueskyService } from './bluesky/bluesky.service';
import { TelegramModule } from '../telegram/telegram.module';
import { CoreModule } from 'src/core/core.module';

@Module({
  imports: [TelegramModule, CoreModule],
  providers: [BlueskyService],
  controllers: [BlueskyController],
})
export class MonitoringModule {}
