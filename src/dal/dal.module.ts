import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
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

@Module({
  imports: [
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
  exports: [SequelizeModule],
  providers: [BackupService],
})
export class DalModule {}
