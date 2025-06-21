import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Logger } from 'src/decorators/logger.decorator';
import { JSONLogger } from 'src/utils/logger';
import { TelegramService } from 'src/telegram/telegram.service';

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

  constructor(private readonly telegramService: TelegramService) {}

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
    const topKeywords = Array.from(this.topicsQueue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => keyword);
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
   */
  private formatBlueskyMessage(post: any): string {
    const text = post?.record?.text || '';
    const handle = post?.author?.handle || '';
    const uri = post?.uri;
    let media = '';
    let mediaLabel = '';
    // Try to find image or video
    if (post?.embed?.images?.length) {
      media = post.embed.images[0].fullsize || post.embed.images[0].thumb || '';
      mediaLabel = 'Image';
    } else if (post?.embed?.external?.thumb) {
      media = post.embed.external.thumb;
      mediaLabel = 'Media';
    }
    let link = '';
    if (uri) {
      link = `https://bsky.app/profile/${post.author?.handle}/post/${uri.split('/').pop()}`;
    }
    let msg = `<b>@${handle}</b>\n`;
    if (text) msg += `<i>${text}</i>\n`;
    if (media) msg += `[${mediaLabel}](${media})\n`;
    if (link) msg += `[View on Bluesky](${link})`;
    return msg;
  }

  /**
   * Processes the incoming data and updates the topics queue with keywords.
   *
   * @param data - The delivery request containing the payload.
   */
  async receive(data) {
    if (data?.keywords) {
      /**
       * Initialize the topics queue with seeds and keywords.
       */
      this.topicsQueue = new Map<string, number>(
        Array.from(this.seeds).map((seed) => [seed, 1]),
      );
      data.keywords.forEach((keyword: string) => {
        const key = keyword.toLowerCase();
        this.topicsQueue.set(key, (this.topicsQueue.get(key) || 0) + 1);
      });
    }
    // Send breaking posts first, then cids
    if (data?.breaking?.length) {
      for (const item of data.breaking) {
        const msg = this.formatBlueskyMessage(item.json);
        await this.telegramService.sendMessage(msg);
      }
    }
    if (data?.cids?.length) {
      for (const item of data.cids) {
        const msg = this.formatBlueskyMessage(item.json);
        await this.telegramService.sendMessage(msg);
      }
    }
  }
}
