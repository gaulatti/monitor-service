import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QdrantClient } from '@qdrant/js-client-rest';
import axios from 'axios';
import { Logger } from 'src/decorators/logger.decorator';
import { IngestDto } from 'src/dto';
import { Category, Post } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { nanoid } from 'src/utils/nanoid';
import { PostsService } from '../posts/posts.service';
import { Cron } from '@nestjs/schedule';

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
   * Initializes the Qdrant collection for storing post vectors.
   */
  private async initializeQdrantCollection(): Promise<void> {
    try {
      this.logger.log('Initializing Qdrant collection', {
        collectionName: this.collectionName,
        vectorSize: 384,
      });

      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName,
      );

      if (!collectionExists) {
        this.logger.log('Creating new Qdrant collection', {
          collectionName: this.collectionName,
          vectorSize: 384,
          distance: 'Cosine',
        });

        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: 384, // Updated to match the actual embedding dimension from real data
            distance: 'Cosine',
          },
        });
        this.logger.log(`Created Qdrant collection: ${this.collectionName}`);
      } else {
        this.logger.log('Qdrant collection already exists', {
          collectionName: this.collectionName,
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant collection', '', {
        collectionName: this.collectionName,
        error: error.message,
        stack: error.stack,
      });
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
      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: embedding,
        limit,
        with_payload: true,
        with_vector: true, // Include the actual vector embeddings
      });

      return searchResult.map((result) => ({
        id: result.id,
        uuid: result.payload?.uuid,
        score: result.score,
        content: result.payload?.content,
        source: result.payload?.source,
        createdAt: result.payload?.createdAt,
        hash: result.payload?.hash,
        embeddings: result.vector, // Include the embeddings for second pass similarity
      }));
    } catch (error) {
      this.logger.error('Failed to search similar posts:', error);
      return [];
    }
  }

  /**
   * Stores post vector in Qdrant.
   */
  private async storePostVector(
    post: Post,
    embedding: number[],
  ): Promise<void> {
    if (embedding.length !== 384) {
      this.logger.warn('Invalid embedding dimensions', {
        uuid: post.uuid,
        expectedDimensions: 384,
        actualDimensions: embedding.length,
      });
      return;
    }

    const pointData = {
      id: post.id,
      vector: embedding,
      payload: {
        uuid: post.uuid,
        content: post.content?.substring(0, 500) || '',
        source: post.source || '',
        createdAt: post.createdAt?.toISOString() || new Date().toISOString(),
        hash: post.hash || '',
      },
    };

    try {
      await this.qdrantClient.upsert(this.collectionName, {
        points: [pointData],
      });
    } catch (error) {
      this.logger.error('Failed to store post vector in Qdrant', '', {
        uuid: post.uuid,
        error: error.message,
      });
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
    console.log('DEBUG: embedding length:', embedding.length);
    console.log(
      'DEBUG: ingestData.embeddings exists:',
      !!ingestData.embeddings,
    );
    console.log('DEBUG: first few embedding values:', embedding.slice(0, 3));

    // Find similar posts and check for duplicates if embeddings are available
    let similarPosts: any[] = [];
    let duplicates: any[] = [];

    if (embedding.length > 0) {
      // Find up to 10 similar posts with any similarity score
      similarPosts = await this.findSimilarPosts(embedding, 10);

      // Check for potential duplicates (high similarity)
      duplicates = similarPosts.filter(
        (similar) => similar.score >= this.similarityThreshold,
      );

      if (duplicates.length > 0) {
        this.logger.log(
          `Found ${duplicates.length} potential duplicates - similarity scores: ${duplicates.map((d) => d.score.toFixed(3)).join(', ')}`,
        );
      }

      if (similarPosts.length > 0) {
        this.logger.log(
          `Found ${similarPosts.length} similar posts - avg similarity: ${(similarPosts.reduce((sum, s) => sum + s.score, 0) / similarPosts.length).toFixed(3)}`,
        );
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
      this.logger.error('Failed to send notification for new post:', error);
    }

    // Load categories relation for complete response
    const completePost = await this.postModel.findByPk(post.id, {
      include: [{ model: Category, as: 'categories_relation' }],
    });

    const finalPost = completePost || post;

    // Convert Sequelize model to plain object to allow dynamic properties
    const postData = finalPost.toJSON();

    // Attach embeddings and similar posts to the plain object
    console.log('DEBUG: About to attach embeddings, length:', embedding.length);
    if (embedding.length > 0) {
      (postData as any).embeddings = embedding;
      console.log('DEBUG: Embeddings attached to postData');
      console.log(
        'DEBUG: postData.embeddings length:',
        (postData as any).embeddings?.length,
      );
    } else {
      console.log('DEBUG: No embeddings to attach (length is 0)');
    }

    // Attach similar posts to the response
    if (similarPosts.length > 0) {
      (postData as any).similarPosts = similarPosts.map((similar) => ({
        id: similar.id,
        uuid: similar.uuid,
        score: similar.score,
        content: similar.content, // Full content without truncation
        source: similar.source,
        createdAt: similar.createdAt,
        hash: similar.hash,
        embeddings: similar.embeddings, // Include embeddings for second pass similarity
      }));
      console.log('DEBUG: Similar posts attached:', similarPosts.length);
    }

    console.log(JSON.stringify(postData, null, 2));

    return postData as any;
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
   * Lists all vectors stored in the Qdrant collection.
   * Returns vector metadata including point IDs and payload information.
   */
  async listVectors(limit: number = 20): Promise<{
    vectors: Array<{
      id: number;
      uuid?: string;
      content?: string;
      source?: string;
      createdAt?: string;
      hash?: string;
      vector?: number[];
    }>;
    total: number;
    collectionInfo: {
      status: string;
      pointsCount: number;
      vectorSize: number;
      distance: string;
    };
  }> {
    const collectionInfo = await this.qdrantClient.getCollection(
      this.collectionName,
    );

    const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
      limit,
      with_payload: true,
      with_vector: true,
    });

    const vectors = scrollResult.points.map((point) => ({
      id: point.id as number,
      uuid: point.payload?.uuid as string,
      content:
        typeof point.payload?.content === 'string'
          ? point.payload.content.substring(0, 100) + '...'
          : undefined,
      source: point.payload?.source as string,
      createdAt: point.payload?.createdAt as string,
      hash: point.payload?.hash as string,
      vector: point.vector as number[],
    }));

    const pointsCount = collectionInfo.points_count || 0;

    // Extract vector configuration
    let vectorSize = 384;
    let distance = 'Cosine';

    const vectorConfig = collectionInfo.config?.params?.vectors;
    if (vectorConfig && typeof vectorConfig === 'object') {
      if ('size' in vectorConfig && typeof vectorConfig.size === 'number') {
        vectorSize = vectorConfig.size;
      }
      if (
        'distance' in vectorConfig &&
        typeof vectorConfig.distance === 'string'
      ) {
        distance = vectorConfig.distance;
      }
    }

    return {
      vectors,
      total: pointsCount,
      collectionInfo: {
        status: collectionInfo.status,
        pointsCount,
        vectorSize,
        distance,
      },
    };
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
    // Process keywords if they exist (this is optional)
    if (data?.keywords) {
      data.keywords.forEach((keyword: string) => {
        const key = keyword.toLowerCase();
        const currentValue = this.topicsQueue.get(key) || 0;
        const newValue = currentValue + 1;
        this.topicsQueue.set(key, newValue);
      });
    }

    try {
      // Extract categories from multiple sources
      let categories = data.categories || [];

      // If no categories in the root, try to extract from classification results
      if (
        categories.length === 0 &&
        data._vote?.content_classification?.full_result?.labels
      ) {
        // Use top 3 categories from classification results with scores above threshold
        const classificationResults =
          data._vote.content_classification.full_result;
        const threshold = 0.1; // Minimum score threshold

        categories = classificationResults.labels
          .slice(0, 5) // Take top 5 labels
          .filter(
            (_, index) => classificationResults.scores[index] >= threshold,
          )
          .slice(0, 3); // Limit to top 3 categories

        this.logger.log(`Extracted categories from classification`, {
          uuid: data.id,
          originalCategories: data.categories,
          extractedCategories: categories,
          classificationScores: classificationResults.scores.slice(0, 3),
        });
      }

      return this.savePost(data, categories);
    } catch (error) {
      this.logger.error(`Error processing ingest ${data.id}:`, error);
      throw error; // Re-throw the error so the controller can handle it properly
    }
  }
}
