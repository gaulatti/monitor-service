import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Logger } from 'src/decorators/logger.decorator';
import { JSONLogger } from 'src/utils/logger';
import { ClientFactory, OrchestratorService } from '../client.factory';
import { getGrpcTalkbackEndpoint, getHostAndPort } from 'src/utils/network';

@Injectable()
export class BlueskyService {
  /**
   * Logger instance for logging messages.
   */
  @Logger(BlueskyService.name)
  private readonly logger!: JSONLogger;

  constructor(private readonly clientFactory: ClientFactory) {}

  @Cron('* * * * *')
  async monitorBluesky(): Promise<void> {
    try {
      await this.triggerPlaylist();
    } catch (error) {
      this.logger.error('Monitoring from Bluesky failed:', error);
    }
  }

  async triggerPlaylist(): Promise<any> {
    const { hostname, port } = getHostAndPort(process.env.WIPHALA_URL!);

    /**
     * Create a new client to communicate with the client service.
     */
    const client = this.clientFactory.createClient<OrchestratorService>(
      hostname,
      port,
      'orchestrator.proto',
      'orchestrator',
      'OrchestratorService',
    );

    if (!client) {
      console.error('❌ Failed to create gRPC client, skipping delivery.');
      return null;
    }

    /**
     * Deliver the payload to the client service.
     */
    return new Promise((resolve, reject) => {
      try {
        client.triggerPlaylist(
          {
            slug: process.env.WIPHALA_SLUG!,
            context: JSON.stringify({}),
            origin: getGrpcTalkbackEndpoint(),
          },
          (err, response) => {
            if (err) {
              console.error(`⚠️ gRPC delivery failed: ${err.message}`);
              reject(new Error(`gRPC delivery failed: ${err.message}`));
            } else {
              resolve(response);
            }
          },
        );
      } catch (error) {
        console.error(`⚠️ Unexpected gRPC error: ${error.message}`);
        reject(new Error(error.message));
      }
    }).catch((error) => {
      console.error(`⚠️ Gracefully handling gRPC failure: ${error.message}`);
      return null;
    });
  }
}
