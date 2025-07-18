import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DalModule } from 'src/dal/dal.module';
import { CloudWatchService } from './cloudwatch/cloudwatch.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { ApnsService } from './notifications/push/apns.service';
import { DeviceController } from './notifications/push/device.controller';
import { DeviceService } from './notifications/push/device.service';

@Module({
  imports: [DalModule, ConfigModule],
  providers: [
    NotificationsService,
    CloudWatchService,
    ApnsService,
    DeviceService,
  ],
  controllers: [NotificationsController, DeviceController],
  exports: [
    NotificationsService,
    CloudWatchService,
    ApnsService,
    DeviceService,
  ],
})
export class CoreModule {}
