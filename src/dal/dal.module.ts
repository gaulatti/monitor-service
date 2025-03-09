import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([])],
  exports: [SequelizeModule],
  providers: [],
})
export class DalModule {}
