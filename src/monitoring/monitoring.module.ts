import { Module } from '@nestjs/common';
import { BlueskyController } from './bluesky/bluesky.controller';
import { BlueskyService } from './bluesky/bluesky.service';
@Module({
  imports: [],
  providers: [BlueskyService],
  controllers: [BlueskyController],
})
export class MonitoringModule {}
