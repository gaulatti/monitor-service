import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { Logger } from 'src/decorators/logger.decorator';
import { WiphalaService } from 'src/interfaces/wiphala.interface';
import { JSONLogger } from 'src/utils/logger';
import { getGrpcTalkbackEndpoint } from 'src/utils/network';
import { DeliverRequest, DeliverResponse } from './bluesky.controller';

@Injectable()
export class BlueskyService {
  /**
   * Logger instance for logging messages.
   */
  @Logger(BlueskyService.name)
  private readonly logger!: JSONLogger;

  /**
   * TODO: Define this in the UI.
   */
  private readonly seeds = new Set(['chile', 'new york', 'weather']);

  /**
   * Queue of topics to be processed.
   */
  private topicsQueue = new Set(this.seeds);
  private wiphalaService: WiphalaService;

  constructor(@Inject('wiphala') private readonly client: ClientGrpc) {}

  /**
   * Lifecycle hook that is called when the module is initialized.
   * This method retrieves and assigns the WiphalaService instance
   * from the client to the `WiphalaService` property.
   */
  onModuleInit() {
    this.wiphalaService =
      this.client.getService<WiphalaService>('WiphalaService');
  }

  /**
   * Monitors the Bluesky service by triggering the monitoring process.
   * Logs an error message if the monitoring process fails.
   *
   * @returns {Promise<void>} A promise that resolves when the monitoring process completes.
   * @throws Logs an error if the monitoring process encounters an issue.
   */
  @Cron(`* * * * *`)
  async monitorBluesky(): Promise<void> {
    try {
      await this.trigger();
    } catch (error) {
      this.logger.error('Monitoring from Bluesky failed:', error);
    }
  }

  /**
   * Triggers a request to the Wiphala service with the specified parameters.
   *
   * @returns A promise that resolves with the result of the Wiphala service trigger.
   *
   * The request includes:
   * - `slug`: The Wiphala slug, retrieved from the environment variable `WIPHALA_SLUG`.
   * - `context`: A JSON string containing:
   *   - `keywords`: An array of topics from the `topicsQueue`.
   *   - `since`: A time interval in seconds (defaulting to 3 minutes).
   * - `origin`: The gRPC talkback endpoint obtained from `getGrpcTalkbackEndpoint()`.
   */
  async trigger(): Promise<any> {
    return firstValueFrom(
      this.wiphalaService.trigger({
        slug: process.env.WIPHALA_SLUG!,
        context: JSON.stringify({
          keywords: [...this.topicsQueue],
          since: 60 * 3,
        }),
        origin: getGrpcTalkbackEndpoint(),
      }),
    );
  }

  /**
   * Processes the incoming data and updates the topics queue with keywords.
   *
   * @param data - The delivery request containing the payload.
   * @returns An object indicating the success of the operation.
   */
  receive(data: DeliverRequest): DeliverResponse {
    const {
      context: { sequence },
    } = JSON.parse(data.payload);

    const item = sequence.find((item: { name: string }) => {
      return item.name == 'MonitorHydrate';
    });

    if (item.output?.keywords) {
      /**
       * Add the keywords to the topics queue.
       */
      this.topicsQueue = new Set(this.seeds);
      item.output.keywords.forEach((keyword: string) =>
        this.topicsQueue.add(keyword.toLowerCase()),
      );
    }

    return { success: true };
  }
}
