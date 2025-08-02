import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import axios from 'axios';
import { QdrantClient } from '@qdrant/js-client-rest';
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
 * - `QdrantClient` for vector similarity operations (provided by DalModule).
 *
 * Environment Variables:
 * - `N8N_WEBHOOK`: URL for the n8n webhook endpoint.
 * - `N8N_API_KEY`: API key for authenticating requests to the n8n webhook.
 * - `QDRANT_URL`: URL for the Qdrant vector database (optional, defaults to localhost).
 *
 * @remarks
 * This service is designed to be extensible and integrates with external automation tools (like n8n)
 * for further processing of trending topics and ingested content. It leverages QdrantClient from DalModule
 * for vector similarity operations and duplicate detection.
 */
@Injectable()
export class IngestService {
  /**
   * Logger instance for logging messages.
   */
  @Logger(IngestService.name)
  private readonly logger!: JSONLogger;

  /**
   * Collection name for storing post vectors.
   */
  private readonly collectionName = 'posts_vectors';

  /**
   * Similarity threshold for duplicate detection (0.0 to 1.0).
   */
  private readonly similarityThreshold = 0.85;

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
    @Inject(QdrantClient)
    private readonly qdrantClient: QdrantClient,
  ) {
    // Initialize collection on startup
    void this.initializeQdrantCollection();
  }

  /**
   * Checks if Qdrant is healthy and accessible.
   */
  private async isQdrantHealthy(): Promise<boolean> {
    try {
      await this.qdrantClient.getCollections();
      return true;
    } catch (error) {
      this.logger.error('Qdrant health check failed:', error);
      return false;
    }
  }

  /**
   * Initializes the Qdrant collection for storing post vectors.
   * This leverages the QdrantClient provided by DalModule.
   */
  private async initializeQdrantCollection(): Promise<void> {
    try {
      const isHealthy = await this.isQdrantHealthy();
      if (!isHealthy) {
        this.logger.warn(
          'Qdrant is not accessible, skipping collection initialization',
        );
        return;
      }

      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName,
      );

      if (!collectionExists) {
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: 384, // Updated to match the actual embedding dimension from real data
            distance: 'Cosine',
          },
        });
        this.logger.log(`Created Qdrant collection: ${this.collectionName}`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant collection:', error);
    }
  }

  /**
   * Searches for similar posts using vector similarity.
   * This method leverages the QdrantClient from DalModule.
   */
  private async findSimilarPosts(
    embedding: number[],
    limit: number = 5,
  ): Promise<any[]> {
    try {
      const isHealthy = await this.isQdrantHealthy();
      if (!isHealthy) {
        this.logger.warn(
          'Qdrant is not accessible, skipping similarity search',
        );
        return [];
      }

      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: embedding,
        limit,
        with_payload: true,
      });

      return searchResult.map((result) => ({
        postId: result.payload?.postId,
        score: result.score,
        content: result.payload?.content,
      }));
    } catch (error) {
      this.logger.error('Failed to search similar posts:', error);
      return [];
    }
  }

  /**
   * Stores post vector in Qdrant.
   * This method leverages the QdrantClient from DalModule.
   */
  private async storePostVector(
    post: Post,
    embedding: number[],
  ): Promise<void> {
    try {
      const isHealthy = await this.isQdrantHealthy();
      if (!isHealthy) {
        this.logger.warn('Qdrant is not accessible, skipping vector storage');
        return;
      }

      await this.qdrantClient.upsert(this.collectionName, {
        points: [
          {
            id: post.uuid,
            vector: embedding,
            payload: {
              postId: post.uuid,
              content: post.content?.substring(0, 500), // Store truncated content
              source: post.source,
              createdAt: post.createdAt?.toISOString(),
              hash: post.hash,
            },
          },
        ],
      });
    } catch (error) {
      this.logger.error('Failed to store post vector:', error);
    }
  }

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
     * Update topic relevance based on vector similarity.
     */
    void this.updateTopicRelevance();

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
   * This method includes vector similarity checking using QdrantClient from DalModule.
   *
   * @param ingestData - The ingested post data
   * @param categories - Array of category slugs to associate with the post
   * @returns The created post
   */
  async savePost(
    ingestData: IngestDto,
    categories: string[] = [],
  ): Promise<Post> {
    // Use real embeddings from the ingest data
    const embedding = ingestData.embeddings || [];

    // Check for similar existing posts only if embeddings are available
    let duplicates: any[] = [];
    if (embedding.length > 0) {
      const similarPosts = await this.findSimilarPosts(embedding, 3);
      duplicates = similarPosts.filter(
        (similar) => similar.score >= this.similarityThreshold,
      );

      if (duplicates.length > 0) {
        this.logger.log(
          `Found ${duplicates.length} similar posts for content: ${ingestData.content.substring(0, 100)}...`,
        );
        // Optionally skip saving or merge with existing post
        // For now, we'll log and continue with saving
      }
    }

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
      // Note: embeddings are stored in Qdrant only, not in MySQL

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

    // Store post vector in Qdrant (leveraging DalModule's QdrantClient)
    if (embedding.length > 0) {
      await this.storePostVector(post, embedding);
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
   * Searches for posts similar to a given query embedding.
   * Uses vector similarity search in Qdrant to find semantically similar posts.
   */
  async searchSimilarContent(
    queryEmbedding: number[],
    limit: number = 10,
  ): Promise<any[]> {
    if (queryEmbedding.length === 0) {
      this.logger.warn('Empty embedding provided for similarity search');
      return [];
    }
    return this.findSimilarPosts(queryEmbedding, limit);
  }

  /**
   * Updates topic relevance based on vector similarity clustering.
   * Since embeddings are stored in Qdrant only, this method focuses on
   * content-based keyword extraction and frequency analysis.
   */
  private async updateTopicRelevance(): Promise<void> {
    try {
      // Get recent posts to analyze topic trends
      const recentPosts = await this.postModel.findAll({
        limit: 100,
        order: [['createdAt', 'DESC']],
      });

      // Extract keywords from content and boost their frequency based on relevance
      for (const post of recentPosts) {
        if (post.content) {
          // Extract keywords from content and boost their frequency
          const words = post.content.toLowerCase().match(/\b\w{4,}\b/g) || [];
          words.forEach((word) => {
            if (!this.seeds.has(word)) {
              const current = this.topicsQueue.get(word) || 0;
              // Boost frequency based on post relevance score
              const boost = Math.ceil(post.relevance / 2);
              this.topicsQueue.set(word, current + boost);
            }
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to update topic relevance:', error);
    }
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
