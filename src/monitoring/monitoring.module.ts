import { Module } from '@nestjs/common';
import { BlueskyService } from './bluesky/bluesky.service';

@Module({
  providers: [BlueskyService],
})
export class MonitoringModule {}
