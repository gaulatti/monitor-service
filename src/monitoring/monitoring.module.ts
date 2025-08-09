import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CoreModule } from 'src/core/core.module';
import { DalModule } from 'src/dal/dal.module';
import { Event, Match, Post } from 'src/models';
import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';
import { IngestController } from './ingest/ingest.controller';
import { IngestService } from './ingest/ingest.service';
import { BackfillService } from './posts/backfill.service';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';

@Module({
  imports: [
    CoreModule,
    DalModule,
    SequelizeModule.forFeature([Event, Post, Match]),
  ],
  providers: [IngestService, PostsService, EventsService, BackfillService],
  controllers: [IngestController, PostsController, EventsController],
})
export class MonitoringModule {}
