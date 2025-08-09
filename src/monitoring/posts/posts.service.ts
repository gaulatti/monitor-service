import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Logger } from 'src/decorators/logger.decorator';
import { PostResponseDto, IncomingPostDto } from 'src/dto';
import { Category, Post, Tagging } from 'src/models';
import { JSONLogger } from 'src/utils/logger';

/**
 * Service responsible for managing and retrieving posts, handling post-category relationships,
 * and deduplicating posts based on their hashes.
 *
 * @remarks
 * This service interacts with the database models for posts, categories, and taggings.
 * It provides methods to:
 * - Retrieve posts filtered by categories and creation time.
 * - Check for duplicate posts based on their hashes.
 *
 * @example
 * ```typescript
 * const posts = await postsService.getPostsByCategories(['news', 'tech']);
 * const duplicates = await postsService.dedupPosts({ input: [postObject1, postObject2] });
 * ```
 *
 * @see Post
 * @see Category
 * @see Tagging
 */
@Injectable()
export class PostsService {
  @Logger(PostsService.name)
  private readonly logger!: JSONLogger;

  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(Category)
    private categoryModel: typeof Category,
    @InjectModel(Tagging)
    private taggingModel: typeof Tagging,
  ) {}

  /**
   * Retrieves posts with cursor-based pagination and category filtering.
   *
   * @param params - Object containing filtering and pagination parameters
   * @param params.categorySlugs - Array of category slugs to filter by. If empty, no category filtering is applied.
   * @param params.limit - Maximum number of posts to return
   * @param params.before - Optional timestamp cursor; returns posts with posted_at < before
   * @returns A promise that resolves to an array of `PostResponseDto` objects, ordered by posted_at DESC.
   */
  async getPosts(params: {
    categorySlugs: string[];
    limit: number;
    before?: Date;
  }): Promise<PostResponseDto[]> {
    const { categorySlugs, limit, before } = params;

    const whereClause = {
      ...(before && {
        posted_at: {
          [Op.lt]: before,
        },
      }),
      ...(categorySlugs.length > 0 && {
        '$categories_relation.slug$': {
          [Op.in]: categorySlugs,
        },
      }),
    };

    const posts = await this.postModel.findAll({
      where: whereClause,
      include: [
        {
          model: Category,
          through: { attributes: [] },
          attributes: ['slug'],
        },
      ],
      order: [['posted_at', 'DESC']],
      limit,
      attributes: [
        'uuid',
        'content',
        'author',
        'source',
        'uri',
        'posted_at',
        'relevance',
        'lang',
        'hash',
        'author_id',
        'author_name',
        'author_handle',
        'author_avatar',
        'media',
        'linkPreview',
        'original',
        'received_at',
      ],
    });

    return posts.map((post) => ({
      id: post.uuid,
      content: post.content,
      author: post.author,
      source: post.source,
      uri: post.uri,
      posted_at: post.posted_at.toISOString(),
      relevance: post.relevance,
      lang: post.lang,
      hash: post.hash,
      author_id: post.author_id,
      author_name: post.author_name,
      author_handle: post.author_handle,
      author_avatar: post.author_avatar,
      media: post.media,
      linkPreview: post.linkPreview,
      original: post.original,
      received_at: post.received_at.toISOString(),
      categories:
        post.categories_relation?.map((category) => category.slug) || [],
    }));
  }

  /**
   * Retrieves posts filtered by the provided category slugs, with a default limit of 50.
   * This method is kept for backward compatibility and delegates to getPosts.
   *
   * @param categorySlugs - An array of category slugs to filter the posts by. If empty, no category filtering is applied.
   * @returns A promise that resolves to an array of `PostResponseDto` objects, each representing a post and its associated categories.
   *
   * The returned posts are ordered by posted_at in descending order.
   */
  async getPostsByCategories(
    categorySlugs: string[],
  ): Promise<PostResponseDto[]> {
    return await this.getPosts({
      categorySlugs,
      limit: 50,
    });
  }

  /**
   * Checks which of the provided post objects already exist in the database by their hash.
   *
   * @param body - An object containing an array of post objects to check for duplicates.
   * @returns A promise that resolves to an array of hashes that already exist in the database.
   */
  async dedupPosts(body: { input: IncomingPostDto[] }): Promise<string[]> {
    const { input: posts } = body;

    if (!posts || !Array.isArray(posts)) {
      return [];
    }

    // Extract hashes from the post objects
    const hashes = posts.map((post) => post.hash).filter((hash) => hash);

    if (hashes.length === 0) {
      return [];
    }

    /**
     * Find existing posts by hashes.
     */
    const existingPosts = await this.postModel.findAll({
      where: {
        hash: {
          [Op.in]: hashes,
        },
      },
      attributes: ['hash'],
    });

    /**
     * Extract hashes from existing posts to return.
     */
    return existingPosts.map((post) => post.hash);
  }
}
