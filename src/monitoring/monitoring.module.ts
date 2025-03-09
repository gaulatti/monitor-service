import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { BlueskyService } from './bluesky/bluesky.service';
import { BlueskyController } from './bluesky/bluesky.controller';
import { ClientFactory } from './client.factory';
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'client',
        transport: Transport.GRPC,
        options: {
          package: 'client',
          protoPath: join(__dirname, './proto/client.proto'),
        },
      },
    ]),
  ],
  providers: [ClientFactory, BlueskyService],
  controllers: [BlueskyController],
})
export class MonitoringModule {}
