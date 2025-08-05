import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  Analytics,
  Category,
  Device,
  Draft,
  Event,
  Match,
  Post,
  ReadPost,
  Tagging,
} from '../models';
import { BackupService } from './backup/backup.service';
import { QdrantService } from './qdrant/qdrant.service';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([
      Post,
      Category,
      Tagging,
      Event,
      Match,
      Draft,
      Device,
      ReadPost,
      Analytics,
    ]),
  ],
  exports: [SequelizeModule, QdrantClient, QdrantService],
  providers: [
    BackupService,
    QdrantService,
    {
      provide: QdrantClient,
      useFactory: (configService: ConfigService) => {
        const qdrantUrl = configService.get('QDRANT_URL');

        return new QdrantClient({ url: qdrantUrl });
      },
      inject: [ConfigService],
    },
  ],
})
export class DalModule {}
