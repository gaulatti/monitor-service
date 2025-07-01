import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { CloudWatchService } from 'src/core/cloudwatch/cloudwatch.service';
import { Logger } from 'src/decorators/logger.decorator';
import { TelegramService } from 'src/telegram/telegram.service';
import { JSONLogger } from 'src/utils/logger';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class IngestService {
  /**
   * Logger instance for logging messages.
   */
  @Logger(IngestService.name)
  private readonly logger!: JSONLogger;

  /**
   * TODO: Define this in the UI.
   */
  private readonly seeds = new Set(['chile', 'new york', 'weather']);

  /**
   * Queue of topics to be processed.
   */
  private topicsQueue = new Map<string, number>(
    Array.from(this.seeds).map((seed) => [seed, 1]),
  );

  constructor(
    private readonly telegramService: TelegramService,
    private readonly cloudWatchService: CloudWatchService,
    private readonly postsService: PostsService,
  ) {}

  /**
   * Monitors the content ingestion service by triggering the monitoring process.
   * Logs an error message if the monitoring process fails.
   *
   * @throws Logs an error if the monitoring process encounters an issue.
   */
  @Cron(`* * * * *`)
  monitorIngest() {
    try {
      console.log('Monitoring content ingestion');
      void this.trigger();
    } catch (error) {
      this.logger.error('Monitoring content ingestion failed:', error);
    }
  }

  trigger() {
    /**
     * Sends the top keywords to the n8n webhook for further processing.
     */
    const sortedEntries = Array.from(this.topicsQueue.entries()).sort(
      (a, b) => b[1] - a[1],
    );

    const topKeywords = sortedEntries.slice(0, 5).map(([keyword]) => keyword);

    this.logger.debug(
      'Topics queue:',
      JSON.stringify(Object.fromEntries(this.topicsQueue), null, 2),
    );

    this.logger.debug('Sorted entries (top 10):', sortedEntries.slice(0, 10));

    this.logger.debug('Top keywords being sent:', topKeywords);

    void axios.post(
      process.env.N8N_WEBHOOK!,
      {
        keywords: topKeywords,
        since: 60,
      },
      {
        headers: {
          'x-api-key': process.env.N8N_API_KEY,
        },
      },
    );
  }

  /**
   * Helper to format an ingested item as a Telegram message.
   * @param ingest The ingested item object
   * @param breaking Whether this is a breaking item (for special formatting)
   */
  private formatIngestMessage(ingest: any, breaking = false): string {
    const text = ingest?.content || '';
    const handle = ingest?.author?.handle || '';
    const name = ingest?.author?.name || '';
    const mediaArr: string[] = Array.isArray(ingest?.media) ? ingest.media : [];
    const linkPreview = ingest?.linkPreview;
    const uri = ingest?.uri;
    const source = ingest?.source || '';

    // Use the URI directly if it's a valid URL, otherwise leave link empty
    const link = uri && uri.startsWith('http') ? uri : '';

    let msg = '';
    if (breaking) {
      msg += '🚨 <b>BREAKING</b> 🚨\n';
    }
    msg += `<b>@${handle}</b>`;
    if (name) msg += ` (${name})`;
    msg += '\n';
    if (text) msg += `<i>${text}</i>\n`;
    if (mediaArr.length > 0) {
      msg += mediaArr.map((m, i) => `[Media ${i + 1}](${m})`).join('\n') + '\n';
    }
    if (linkPreview) {
      msg += `[Link Preview](${linkPreview})\n`;
    }
    if (link) {
      const linkText = source
        ? `View on ${source.charAt(0).toUpperCase() + source.slice(1)}`
        : 'View Content';
      msg += `[${linkText}](${link})`;
    }

    return msg;
  }

  /**
   * Processes the incoming data and updates the topics queue with keywords.
   *
   * @param data - The delivery request containing the payload (object or array).
   */
  async receive(data: any) {
    const dataList = Array.isArray(data) ? data : [data];
    for (const entry of dataList) {
      if (entry?.keywords) {
        entry.keywords.forEach((keyword: string) => {
          const key = keyword.toLowerCase();
          const currentValue = this.topicsQueue.get(key) || 0;
          const newValue = currentValue + 1;
          this.topicsQueue.set(key, newValue);
        });
      }
      this.topicsQueue.forEach((value, key) => {
        void this.cloudWatchService.sendMetric('TrendingKeywords', value, {
          Keyword: key,
          Service: 'Monitor/Keywords',
        });
      });
      if (entry?.items?.length) {
        for (const ingest of entry.items) {
          try {
            // Save ingested content to database - pass categories from ingest data if available
            const categories = ingest.categories || [];
            await this.postsService.saveIngest(ingest, categories);

            // Send to Telegram
            const isBreaking = (ingest.relevance ?? 0) >= 7;
            const msg = this.formatIngestMessage(ingest, isBreaking);
            await this.telegramService.sendMessage(msg);
          } catch (error) {
            this.logger.error(`Error processing ingest ${ingest.id}:`, error);
          }
        }
      }
    }
  }
}
