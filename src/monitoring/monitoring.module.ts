import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { BlueskyService } from './bluesky/bluesky.service';
import { BlueskyController } from './bluesky/bluesky.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'wiphala',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'wiphala',
            protoPath: join(__dirname, '../proto/wiphala.proto'),
            url: configService.get<string>('WIPHALA_GRPC_URL'),
            loader: {
              keepCase: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [BlueskyService],
  controllers: [BlueskyController],
})
export class MonitoringModule {}
