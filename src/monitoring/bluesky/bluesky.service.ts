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
   * Helper to format a Bluesky post as a Telegram message (latest schema).
   * @param post The Bluesky post object (latest schema)
   * @param breaking Whether this is a breaking item (for special formatting)
   */
  private formatBlueskyMessage(post: any, breaking = false): string {
    // Extract text
    const text = post?.record?.text || '';
    // Extract author info
    const handle = post?.author?.handle || '';
    const name = post?.author?.displayName || '';
    const avatar = post?.author?.avatar || '';
    // Extract media (from facets, embed, or external)
    let mediaArr: string[] = [];
    // Try to extract media from facets (links)
    if (Array.isArray(post?.record?.facets)) {
      for (const facet of post.record.facets) {
        if (Array.isArray(facet.features)) {
          for (const feature of facet.features) {
            if (feature.uri) {
              mediaArr.push(feature.uri);
            }
          }
        }
      }
    }
    // Try to extract media from embed/external
    if (post?.embed?.external?.uri) {
      mediaArr.push(post.embed.external.uri);
    }
    // Try to extract media from record.embed.external
    if (post?.record?.embed?.external?.uri) {
      mediaArr.push(post.record.embed.external.uri);
    }
    // Remove duplicates
    mediaArr = Array.from(new Set(mediaArr));
    // Link preview (external link description)
    let linkPreview = '';
    if (post?.embed?.external?.uri) {
      linkPreview = post.embed.external.uri;
    } else if (post?.record?.embed?.external?.uri) {
      linkPreview = post.record.embed.external.uri;
    }
    // Bluesky link
    const uri = post?.uri;
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
    if (avatar) msg += `<a href="${avatar}">🖼️</a>\n`;
    if (text) msg += `<i>${text}</i>\n`;
    if (mediaArr.length > 0) {
      msg += mediaArr.map((m, i) => `[Media ${i + 1}](${m})`).join('\n') + '\n';
    }
    if (linkPreview) {
      msg += `[Link Preview](${linkPreview})\n`;
    }
    if (link) msg += `[View on Bluesky](${link})`;
    if (breaking) {
      msg += '\n\n';
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
        for (const post of data.items) {
          const isBreaking = (post.relevance ?? 0) >= 7;
          const msg = this.formatBlueskyMessage(post, isBreaking);
          await this.telegramService.sendMessage(msg);
        }
      }
    }
  }
}
