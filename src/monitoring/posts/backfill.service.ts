import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QdrantClient } from '@qdrant/js-client-rest';
import axios from 'axios';
import { Logger } from 'src/decorators/logger.decorator';
import { Post } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { IngestService } from '../ingest/ingest.service';

/**
 * Interface for backfill result items
 */
interface BackfillItem {
  postId: number;
  stored: boolean;
  reason?: string;
  similarCount?: number;
}

/**
 * Interface for backfill summary response
 */
interface BackfillSummary {
  scanned: number;
  missing: number;
  processed: number;
  skipped: number;
  duration_ms: number;
  items: BackfillItem[];
}

/**
 * Service responsible for backfilling missing post vectors in Qdrant.
 *
 * This service:
 * - Identifies posts that don't have vectors stored in Qdrant
 * - Ensures embeddings exist (fetches from embed service if missing)
 * - Stores vectors using existing IngestService.storePostVector method
 * - Optionally computes similar posts for reporting
 * - Processes all posts in batches to avoid memory issues
 */
@Injectable()
export class BackfillService {
  @Logger(BackfillService.name)
  private readonly logger!: JSONLogger;

  /**
   * Hardcoded embed service endpoint
   */
  private readonly embedEndpoint = 'http://192.168.0.99:8000/embed';

  /**
   * Batch size for processing posts
   */
  private readonly batchSize = 500;

  /**
   * Collection name for posts vectors
   */
  private readonly collectionName = 'posts_vectors';

  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @Inject(QdrantClient)
    private readonly qdrantClient: QdrantClient,
    private readonly ingestService: IngestService,
  ) {}

  /**
   * Main backfill method that processes all posts missing from Qdrant
   */
  async run(): Promise<BackfillSummary> {
    const startTime = Date.now();
    const summary: BackfillSummary = {
      scanned: 0,
      missing: 0,
      processed: 0,
      skipped: 0,
      duration_ms: 0,
      items: [],
    };

    this.logger.log('Starting posts backfill process');

    try {
      // Step 1: Get existing point IDs from Qdrant
      const existingPointIds = await this.getExistingVectorIds();
      this.logger.log('Retrieved existing vector IDs from Qdrant', {
        count: existingPointIds.size,
      });

      // Step 2: Process posts in batches
      let offset = 0;
      let hasMorePosts = true;

      while (hasMorePosts) {
        const posts = await this.postModel.findAll({
          offset,
          limit: this.batchSize,
          order: [['id', 'ASC']],
          attributes: [
            'id',
            'uuid',
            'content',
            'hash',
            'embedding',
            'source',
            'uri',
            'createdAt',
            'author_id',
            'author_name',
            'author_handle',
            'author_avatar',
            'media',
            'linkPreview',
            'original',
          ],
        });

        if (posts.length === 0) {
          hasMorePosts = false;
          break;
        }

        summary.scanned += posts.length;

        // Process each post in the current batch
        for (const post of posts) {
          const isInQdrant = existingPointIds.has(post.id);

          if (isInQdrant) {
            // Post already has vector in Qdrant, skip
            continue;
          }

          summary.missing++;

          try {
            // Ensure post has embedding
            let embedding = post.embedding;
            let embeddingUpdated = false;

            if (
              !embedding ||
              !Array.isArray(embedding) ||
              embedding.length === 0
            ) {
              // Fetch embedding from embed service
              embedding = await this.fetchEmbedding(post);
              if (embedding) {
                // Update database with new embedding
                await post.update({ embedding });
                embeddingUpdated = true;
                this.logger.log('Fetched and stored embedding for post', {
                  postId: post.id,
                  uuid: post.uuid,
                });
              } else {
                // Failed to get embedding, skip this post
                summary.skipped++;
                summary.items.push({
                  postId: post.id,
                  stored: false,
                  reason: 'Failed to fetch embedding',
                });
                continue;
              }
            }

            // Store vector in Qdrant using existing method
            await this.ingestService.storePostVector(post, embedding);

            // Optionally compute similar posts for reporting
            let similarCount = 0;
            try {
              const similarPosts =
                await this.ingestService.searchSimilarContent(embedding, 5);
              similarCount = similarPosts.length;
            } catch (error) {
              this.logger.warn('Failed to compute similar posts', {
                postId: post.id,
                error: error.message,
              });
            }

            summary.processed++;
            summary.items.push({
              postId: post.id,
              stored: true,
              similarCount,
            });

            this.logger.log('Successfully processed post', {
              postId: post.id,
              uuid: post.uuid,
              embeddingUpdated,
              similarCount,
            });
          } catch (error) {
            summary.skipped++;
            summary.items.push({
              postId: post.id,
              stored: false,
              reason: error.message,
            });

            this.logger.error('Failed to process post', '', {
              postId: post.id,
              uuid: post.uuid,
              error: error.message,
            });
          }
        }

        offset += this.batchSize;

        this.logger.log('Completed batch', {
          batchStart: offset - this.batchSize,
          batchSize: posts.length,
          scanned: summary.scanned,
          processed: summary.processed,
          skipped: summary.skipped,
        });
      }
    } catch (error) {
      this.logger.error('Backfill process failed', '', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }

    summary.duration_ms = Date.now() - startTime;

    this.logger.log('Completed posts backfill process', {
      scanned: summary.scanned,
      missing: summary.missing,
      processed: summary.processed,
      skipped: summary.skipped,
      durationMs: summary.duration_ms,
    });

    return summary;
  }

  /**
   * Fetches existing vector IDs from Qdrant collection
   */
  private async getExistingVectorIds(): Promise<Set<number>> {
    const existingIds = new Set<number>();
    let offset: string | number | undefined;

    try {
      while (true) {
        const scrollResult = await this.qdrantClient.scroll(
          this.collectionName,
          {
            limit: 10000, // Large batch size for efficiency
            with_payload: false,
            with_vector: false,
            offset,
          },
        );

        if (scrollResult.points.length === 0) {
          break;
        }

        for (const point of scrollResult.points) {
          existingIds.add(point.id as number);
        }

        const nextOffset = scrollResult.next_page_offset;
        offset =
          typeof nextOffset === 'string' || typeof nextOffset === 'number'
            ? nextOffset
            : undefined;
        if (!offset) {
          break;
        }
      }
    } catch (error) {
      this.logger.error('Failed to retrieve existing vector IDs', '', {
        error: error.message,
      });
      // Return empty set to be safe - will process all posts
      return new Set<number>();
    }

    return existingIds;
  }

  /**
   * Fetches embedding for a post from the embed service
   */
  private async fetchEmbedding(post: Post): Promise<number[] | null> {
    try {
      const payload = {
        id: post.id,
        source: post.source,
        uri: post.uri,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        relevance: 1.0, // Default relevance
        lang: 'en', // Default language
        author: {
          id: post.author_id || '',
          name: post.author_name || '',
          handle: post.author_handle || '',
          avatar: post.author_avatar || '',
        },
        media: post.media || null,
        linkPreview: post.linkPreview || '',
        hash: post.hash || '',
        original: post.original || '',
      };

      const response = await axios.post(this.embedEndpoint, payload, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (
        response.data &&
        response.data.embeddings &&
        Array.isArray(response.data.embeddings)
      ) {
        return response.data.embeddings;
      }

      this.logger.warn('Invalid embedding response format', {
        postId: post.id,
        responseData: response.data,
      });

      return null;
    } catch (error) {
      this.logger.error('Failed to fetch embedding from service', '', {
        postId: post.id,
        endpoint: this.embedEndpoint,
        error: error.message,
      });
      return null;
    }
  }
}
