import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Logger } from 'src/decorators/logger.decorator';
import { JSONLogger } from 'src/utils/logger';

/**
 * Available collection types in the Qdrant database.
 */
export type QdrantCollectionType = 'posts_vectors' | 'earthquakes';

/**
 * Configuration for a Qdrant collection.
 */
export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Dot' | 'Euclid';
}

/**
 * Service responsible for managing Qdrant vector database operations.
 *
 * This service handles:
 * - Initializing multiple Qdrant collections on module startup
 * - Providing centralized Qdrant configuration
 * - Managing collection lifecycle for different data types
 */
@Injectable()
export class QdrantService implements OnModuleInit {
  /**
   * Logger instance for logging messages.
   */
  @Logger(QdrantService.name)
  private readonly logger!: JSONLogger;

  /**
   * Collection configurations for different data types.
   */
  private readonly collections: QdrantCollectionType[] = [
    'posts_vectors',
    'earthquakes',
  ];

  /**
   * Default collection configuration.
   */
  private readonly defaultConfig: Omit<CollectionConfig, 'name'> = {
    vectorSize: 384,
    distance: 'Cosine',
  };

  constructor(
    @Inject(QdrantClient)
    private readonly qdrantClient: QdrantClient,
  ) {}

  /**
   * Initialize Qdrant collections when the module starts.
   */
  async onModuleInit(): Promise<void> {
    await this.initializeAllCollections();
  }

  /**
   * Gets the collection name for posts vectors.
   */
  getCollectionName(type: QdrantCollectionType = 'posts_vectors'): string {
    return type;
  }

  /**
   * Gets the Qdrant client instance.
   */
  getClient(): QdrantClient {
    return this.qdrantClient;
  }

  /**
   * Gets the collection configuration for a specific type.
   */
  getCollectionConfig(type: QdrantCollectionType): CollectionConfig {
    return {
      name: type,
      ...this.defaultConfig,
    };
  }

  /**
   * Searches for similar vectors in a specific collection.
   */
  async search(
    collectionType: QdrantCollectionType,
    vector: number[],
    limit: number = 5,
    withPayload: boolean = true,
    withVector: boolean = false,
  ) {
    const collectionName = this.getCollectionName(collectionType);
    return this.qdrantClient.search(collectionName, {
      vector,
      limit,
      with_payload: withPayload,
      with_vector: withVector,
    });
  }

  /**
   * Upserts points into a specific collection.
   */
  async upsert(
    collectionType: QdrantCollectionType,
    points: Array<{
      id: number | string;
      vector: number[];
      payload?: Record<string, any>;
    }>,
  ) {
    const collectionName = this.getCollectionName(collectionType);
    return this.qdrantClient.upsert(collectionName, { points });
  }

  /**
   * Scrolls through points in a specific collection.
   */
  async scroll(
    collectionType: QdrantCollectionType,
    options: {
      limit?: number;
      with_payload?: boolean;
      with_vector?: boolean;
      offset?: string | number;
    } = {},
  ) {
    const collectionName = this.getCollectionName(collectionType);
    return this.qdrantClient.scroll(collectionName, options);
  }

  /**
   * Gets collection information.
   */
  async getCollectionInfo(collectionType: QdrantCollectionType) {
    const collectionName = this.getCollectionName(collectionType);
    return this.qdrantClient.getCollection(collectionName);
  }

  /**
   * Initializes all Qdrant collections.
   */
  private async initializeAllCollections(): Promise<void> {
    for (const collectionType of this.collections) {
      await this.initializeCollection(collectionType);
    }
  }

  /**
   * Initializes a specific Qdrant collection.
   */
  private async initializeCollection(
    type: QdrantCollectionType,
  ): Promise<void> {
    const config = this.getCollectionConfig(type);
    
    try {
      this.logger.log('Initializing Qdrant collection', {
        type,
        collectionName: config.name,
        vectorSize: config.vectorSize,
      });

      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === config.name,
      );

      if (!collectionExists) {
        this.logger.log('Creating new Qdrant collection', {
          type,
          collectionName: config.name,
          vectorSize: config.vectorSize,
          distance: config.distance,
        });

        await this.qdrantClient.createCollection(config.name, {
          vectors: {
            size: config.vectorSize,
            distance: config.distance,
          },
        });
        this.logger.log(`Created Qdrant collection: ${config.name} (${type})`);
      } else {
        this.logger.log('Qdrant collection already exists', {
          type,
          collectionName: config.name,
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant collection', '', {
        type,
        collectionName: config.name,
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
