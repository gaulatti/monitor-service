import { Module } from '@nestjs/common';
import { CoreModule } from 'src/core/core.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BlueskyController } from './bluesky/bluesky.controller';
import { BlueskyService } from './bluesky/bluesky.service';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';
import { DalModule } from 'src/dal/dal.module';

@Module({
  imports: [TelegramModule, CoreModule, DalModule],
  providers: [BlueskyService, PostsService],
  controllers: [BlueskyController, PostsController],
})
export class MonitoringModule {}
