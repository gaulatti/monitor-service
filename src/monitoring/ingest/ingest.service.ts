import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import axios from 'axios';
import { Logger } from 'src/decorators/logger.decorator';
import { IngestDto } from 'src/dto';
import { Category, Post } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { nanoid } from 'src/utils/nanoid';
import { PostsService } from '../posts/posts.service';

/**
 * Service responsible for ingesting, processing, and monitoring content within the application.
 *
 * The `IngestService` handles:
 * - Managing a queue of topic keywords and their frequencies.
 * - Periodically triggering monitoring and ingestion processes.
 * - Sending top keywords to an external n8n webhook for further processing.
 * - Saving ingested posts to the database and associating them with categories.
 * - Notifying other services about new ingested posts.
 * - Receiving and processing incoming data payloads, updating the topics queue, and persisting content.
 *
 * Dependencies:
 * - `Post` and `Category` models for database operations.
 * - `PostsService` for post-related business logic and notifications.
 *
 * Environment Variables:
 * - `N8N_WEBHOOK`: URL for the n8n webhook endpoint.
 * - `N8N_API_KEY`: API key for authenticating requests to the n8n webhook.
 *
 * @remarks
 * This service is designed to be extensible and integrates with external automation tools (like n8n)
 * for further processing of trending topics and ingested content.
 */
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
  private readonly seeds = new Set(['chile', 'new york', 'weather', 'zohran']);

  /**
   * Queue of topics to be processed.
   */
  private topicsQueue = new Map<string, number>(
    Array.from(this.seeds).map((seed) => [seed, 1]),
  );

  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(Category)
    private categoryModel: typeof Category,
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

  /**
   * Triggers the process of sending the top keywords from the topics queue to an n8n webhook for further processing.
   *
   * This method:
   * - Sorts the topics queue by frequency in descending order.
   * - Selects the top 5 keywords.
   * - Logs the current state of the topics queue, the top 10 sorted entries, and the top keywords being sent.
   * - Sends a POST request to the configured n8n webhook with the top keywords and a fixed 'since' value.
   *
   * @remarks
   * The n8n webhook URL and API key are expected to be provided via environment variables `N8N_WEBHOOK` and `N8N_API_KEY`.
   */
  trigger() {
    /**
     * Sends the top keywords to the n8n webhook for further processing.
     */
    const sortedEntries = Array.from(this.topicsQueue.entries()).sort(
      (a, b) => b[1] - a[1],
    );

    /**
     * Log the current state of the topics queue.
     */
    const topKeywords = Array.from(
      new Set([
        ...sortedEntries.slice(0, 5).map(([keyword]) => keyword),
        ...this.seeds,
      ]),
    );

    /**
     * Trigger n8n with the top keywords.
     * This is used to update the topics queue with the most relevant keywords.
     */
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
   * Saves an ingested post to the database and sends notifications.
   *
   * @param ingestData - The ingested post data
   * @param categories - Array of category slugs to associate with the post
   * @returns The created post
   */
  async savePost(
    ingestData: IngestDto,
    categories: string[] = [],
  ): Promise<Post> {
    const categorySlugs = categories || [];
    const categoryModels: Category[] = [];

    for (const slug of categorySlugs) {
      const [category] = await this.categoryModel.findOrCreate({
        where: { slug },
        defaults: {
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
        } as any,
      });
      categoryModels.push(category);
    }

    const post = await this.postModel.create({
      uuid: nanoid(),
      source_id: ingestData.id,
      source: ingestData.source,
      uri: ingestData.uri,
      content: ingestData.content,
      createdAt: new Date(ingestData.createdAt),
      relevance: ingestData.relevance,
      lang: ingestData.lang,
      hash: ingestData.hash,
      author_id: ingestData.author.id,
      author_name: ingestData.author.name,
      author_handle: ingestData.author.handle,
      author_avatar: ingestData.author.avatar,
      media: ingestData.media,
      linkPreview: ingestData.linkPreview,
      original: ingestData.original,

      /**
       * Legacy fields for backward compatibility
       */
      author: ingestData.author.name,
      posted_at: new Date(ingestData.createdAt),
      received_at: new Date(),
    } as any);

    /**
     * Associate categories with the post.
     */
    if (categoryModels.length > 0) {
      await post.$set('categories_relation', categoryModels);
    }

    /**
     * Notify about the new post.
     */
    try {
      await this.postsService.notifyNewIngest(post, categoryModels);
    } catch (error) {
      /**
       * Log the error if notification fails.
       */
      console.error('Failed to send notification for new post:', error);
    }

    return post;
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

      // Handle direct post objects (your posts array)
      if (entry?.id && entry?.source && entry?.content) {
        try {
          const categories = entry.categories || [];
          await this.savePost(entry, categories);
        } catch (error) {
          this.logger.error(`Error processing ingest ${entry.id}:`, error);
        }
      }
      // Handle wrapped posts in items array (legacy format)
      else if (entry?.items?.length) {
        for (const ingest of entry.items) {
          try {
            const categories = ingest.categories || [];
            await this.savePost(ingest, categories);
          } catch (error) {
            this.logger.error(`Error processing ingest ${ingest.id}:`, error);
          }
        }
      }
    }
  }
}
