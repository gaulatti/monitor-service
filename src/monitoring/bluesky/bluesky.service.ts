import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { CloudWatchService } from 'src/core/cloudwatch/cloudwatch.service';
import { Logger } from 'src/decorators/logger.decorator';
import { TelegramService } from 'src/telegram/telegram.service';
import { JSONLogger } from 'src/utils/logger';

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
  private topicsQueue = new Map<string, number>(
    Array.from(this.seeds).map((seed) => [seed, 1]),
  );

  constructor(
    private readonly telegramService: TelegramService,
    private readonly cloudWatchService: CloudWatchService,
  ) {}

  /**
   * Monitors the Bluesky service by triggering the monitoring process.
   * Logs an error message if the monitoring process fails.
   *
   * @throws Logs an error if the monitoring process encounters an issue.
   */
  @Cron(`* * * * *`)
  monitorBluesky() {
    try {
      console.log('Monitoring from Bluesky');
      void this.trigger();
    } catch (error) {
      this.logger.error('Monitoring from Bluesky failed:', error);
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
   * Helper to format a Bluesky post as a Telegram message.
   * @param post The Bluesky post object (new schema)
   * @param breaking Whether this is a breaking item (for special formatting)
   */
  private formatBlueskyMessage(post: any, breaking = false): string {
    const text = post?.content || '';
    const handle = post?.author?.handle || '';
    const name = post?.author?.name || '';
    const avatar = post?.author?.avatar || '';
    const uri = post?.uri;
    const mediaArr = Array.isArray(post?.media) ? post.media : [];
    const linkPreview = post?.linkPreview;

    let mediaSection = '';
    if (mediaArr.length > 0) {
      // Show all media links as clickable
      mediaSection = mediaArr
        .map((m, i) => `[Media ${i + 1}](${m})`)
        .join('\n');
    }
    if (linkPreview) {
      mediaSection +=
        (mediaSection ? '\n' : '') + `[Link Preview](${linkPreview})`;
    }

    let link = '';
    if (uri && handle) {
      link = `https://bsky.app/profile/${handle}/post/${uri.split('/').pop()}`;
    }

    let msg = '';
    if (breaking) {
      msg += '🚨 <b>BREAKING</b> 🚨\n';
    }
    msg += `<b>@${handle}</b>`;
    if (name) msg += ` (${name})`;
    msg += '\n';
    if (avatar) msg += `<a href=\"${avatar}\">🖼️</a>\n`;
    if (text) msg += `<i>${text}</i>\n`;
    if (mediaSection) msg += `${mediaSection}\n`;
    if (link) msg += `[View on Bluesky](${link})`;
    if (breaking) {
      msg += '\n\n'; // Extra space for breaking
    }
    return msg;
  }

  /**
   * Processes the incoming data and updates the topics queue with keywords.
   *
   * @param dataArray - The delivery request containing the payload.
   */
  async receive(dataArray) {
    for (const data of dataArray) {
      // Update topics queue with keywords
      if (data?.keywords) {
        data.keywords.forEach((keyword: string) => {
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

      // Process each post in items
      if (data?.items?.length) {
        for (const item of data.items) {
          const post = item.json;
          const isBreaking = (post.relevance ?? 0) >= 7;
          const msg = this.formatBlueskyMessage(post, isBreaking);
          await this.telegramService.sendMessage(msg);
        }
      }
    }
  }
}
