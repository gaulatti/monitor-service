import { Module } from '@nestjs/common';
import { CoreModule } from 'src/core/core.module';
import { DalModule } from 'src/dal/dal.module';
import { IngestController } from './ingest/ingest.controller';
import { IngestService } from './ingest/ingest.service';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';

@Module({
  imports: [CoreModule, DalModule],
  providers: [IngestService, PostsService],
  controllers: [IngestController, PostsController],
})
export class MonitoringModule {}
