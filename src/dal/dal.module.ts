import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BackupService } from './backup/backup.service';

@Module({
  imports: [SequelizeModule.forFeature([])],
  exports: [SequelizeModule],
  providers: [BackupService],
})
export class DalModule {}
