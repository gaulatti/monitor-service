import { Module } from '@nestjs/common';
import { CoreModule } from 'src/core/core.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PostIngestionController } from './post-ingestion/post-ingestion.controller';
import { PostIngestionService } from './post-ingestion/post-ingestion.service';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';
import { DalModule } from 'src/dal/dal.module';

@Module({
  imports: [TelegramModule, CoreModule, DalModule],
  providers: [PostIngestionService, PostsService],
  controllers: [PostIngestionController, PostsController],
})
export class MonitoringModule {}
