import { Module } from '@nestjs/common';
import { CoreModule } from 'src/core/core.module';
import { TelegramModule } from '../telegram/telegram.module';
import { IngestController } from './ingest/ingest.controller';
import { IngestService } from './ingest/ingest.service';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';
import { DalModule } from 'src/dal/dal.module';

@Module({
  imports: [TelegramModule, CoreModule, DalModule],
  providers: [IngestService, PostsService],
  controllers: [IngestController, PostsController],
})
export class MonitoringModule {}
