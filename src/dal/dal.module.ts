import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BackupService } from './backup/backup.service';
import { Post, Category, Tagging, Event, Match, Draft } from '../models';

@Module({
  imports: [
    SequelizeModule.forFeature([Post, Category, Tagging, Event, Match, Draft]),
  ],
  exports: [SequelizeModule],
  providers: [BackupService],
})
export class DalModule {}
