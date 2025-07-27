import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { NotificationsService } from 'src/core/notifications/notifications.service';
import { NotificationPayload, PostResponseDto } from 'src/dto';
import { Category, Post, Tagging } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { Logger } from 'src/decorators/logger.decorator';

/**
 * Service responsible for managing and retrieving posts, handling post-category relationships,
 * broadcasting notifications for new ingested posts, and deduplicating posts based on their hashes.
 *
 * @remarks
 * This service interacts with the database models for posts, categories, and taggings.
 * It provides methods to:
 * - Retrieve posts filtered by categories and creation time.
 * - Notify subscribers about new ingested posts.
 * - Check for duplicate posts based on their hashes.
 *
 * @example
 * ```typescript
 * const posts = await postsService.getPostsByCategories(['news', 'tech']);
 * postsService.notifyNewIngest(post, categories);
 * const duplicates = await postsService.dedupPosts({ input: ['hash1', 'hash2'] });
 * ```
 *
 * @see Post
 * @see Category
 * @see Tagging
 * @see NotificationsService
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
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Retrieves posts created within the last three hours, filtered by the provided category slugs.
   *
   * @param categorySlugs - An array of category slugs to filter the posts by. If empty, no category filtering is applied.
   * @returns A promise that resolves to an array of `PostResponseDto` objects, each representing a post and its associated categories.
   *
   * The returned posts are ordered by creation date in descending order.
   */
  async getPostsByCategories(
    categorySlugs: string[],
  ): Promise<PostResponseDto[]> {
    const halfDayAgo = new Date(Date.now() - 60 * 60 * 1000 * 6);

    const whereClause = {
      createdAt: {
        [Op.gte]: halfDayAgo,
      },
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
      order: [['createdAt', 'DESC']],
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
   * Notifies subscribers about a newly ingested post by broadcasting a notification payload
   * to SSE clients and sending push notifications to relevant devices based on their
   * relevance thresholds.
   *
   * @param post - The post object containing details about the ingested post.
   * @param categories - An array of categories associated with the post.
   */
  async notifyNewIngest(post: Post, categories: Category[]): Promise<void> {
    const startTime = Date.now();
    
    this.logger.log('Starting new post notification', {
      postId: post.uuid,
      postHash: post.hash,
      source: post.source,
      relevance: post.relevance,
      language: post.lang,
      categories: categories.map((cat) => cat.slug),
      categoriesCount: categories.length,
      contentLength: post.content.length,
      author: post.author || 'Unknown',
      postedAt: post.posted_at.toISOString(),
    });

    const payload: NotificationPayload = {
      id: post.uuid,
      content: post.content,
      source: post.source,
      uri: post.uri,
      relevance: post.relevance,
      lang: post.lang,
      hash: post.hash,
      author: post.author,
      author_id: post.author_id,
      author_name: post.author_name,
      author_handle: post.author_handle,
      author_avatar: post.author_avatar,
      media: post.media,
      linkPreview: post.linkPreview,
      original: post.original,
      posted_at: post.posted_at.toISOString(),
      received_at: post.received_at.toISOString(),
      categories: categories.map((category) => category.slug),
    };

    this.logger.log('Notification payload prepared', {
      postId: post.uuid,
      payloadSize: JSON.stringify(payload).length,
      hasMedia: !!post.media,
      hasLinkPreview: !!post.linkPreview,
    });

    // Broadcast to SSE clients (existing functionality)
    this.notificationsService.broadcast(payload);

    this.logger.log('SSE broadcast completed', {
      postId: post.uuid,
      timestamp: new Date().toISOString(),
    });

    // Send push notifications to devices based on relevance threshold
    try {
      const postNotificationData = {
        id: post.uuid,
        title: this.extractTitle(post.content),
        content: post.content,
        relevance: post.relevance,
        categories: categories.map((category) => category.slug),
        url: post.uri,
        publishedAt: post.posted_at.toISOString(),
      };

      this.logger.log('Sending push notifications', {
        postId: post.uuid,
        title: postNotificationData.title,
        relevance: post.relevance,
        categories: postNotificationData.categories,
        titleLength: postNotificationData.title.length,
      });

      await this.notificationsService.sendPostNotification(
        postNotificationData,
      );

      const duration = Date.now() - startTime;
      this.logger.log('Post notification completed successfully', {
        postId: post.uuid,
        totalDurationMs: duration,
        source: post.source,
        relevance: post.relevance,
        categoriesCount: categories.length,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to send push notifications for new post', '', {
        postId: post.uuid,
        source: post.source,
        relevance: post.relevance,
        error: error.message,
        stack: error.stack,
        durationMs: duration,
      });
    }
  }

  /**
   * Checks which of the provided post hashes already exist in the database.
   *
   * @param body - An object containing an array of post hashes to check for duplicates.
   * @returns A promise that resolves to an array of hashes that already exist in the database.
   */
  async dedupPosts(body: { input: string[] }): Promise<string[]> {
    const { input: hashes } = body;

    if (!hashes || !Array.isArray(hashes)) {
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

  /**
   * Extracts a title from post content for push notifications.
   * Takes the first line or sentence of content, up to 60 characters.
   *
   * @param content - The post content to extract a title from.
   * @returns A title string suitable for push notifications.
   */
  private extractTitle(content: string): string {
    if (!content) {
      return 'New Post';
    }

    // Remove HTML tags and extra whitespace
    const cleanContent = content
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Take first sentence or line, limited to 60 characters
    const firstSentence = cleanContent.split(/[.!?]\s+/)[0];
    const firstLine = cleanContent.split('\n')[0];
    
    // Use the shorter of first sentence or first line
    const title =
      firstSentence.length <= firstLine.length ? firstSentence : firstLine;
    
    // Truncate to 60 characters for push notification limits
    return title.length > 60 ? `${title.substring(0, 60)}...` : title;
  }
}
