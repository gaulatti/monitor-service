import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { NotificationsService } from 'src/core/notifications/notifications.service';
import { Category, Post, Tagging } from 'src/models';

export interface PostResponseDto {
  id: string;
  content: string;
  author: string;
  source: string;
  posted_at: Date;
  categories: string[];
}

export interface NotificationPayload {
  id: string;
  content: string;
  source: string;
  posted_at: string;
  categories: string[];
}

export interface BlueskyPostData {
  id: string;
  source: string;
  uri: string;
  content: string;
  createdAt: string;
  relevance: number;
  lang: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
  };
  tags: string[];
  media: string[];
  linkPreview: string;
  score: number | null;
  scores: any[];
  categories: string[];
  labels: string[];
  original?: string;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(Category)
    private categoryModel: typeof Category,
    @InjectModel(Tagging)
    private taggingModel: typeof Tagging,
    private notificationsService: NotificationsService,
  ) {}

  async saveBlueskyPost(postData: BlueskyPostData): Promise<Post> {
    const categorySlugs = postData.categories || [];
    const categories: Category[] = [];

    for (const slug of categorySlugs) {
      const [category] = await this.categoryModel.findOrCreate({
        where: { slug },
        defaults: {
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
        } as any,
      });
      categories.push(category);
    }

    const [post] = await this.postModel.findOrCreate({
      where: { id: postData.id },
      defaults: {
        id: postData.id,
        source: postData.source,
        uri: postData.uri,
        content: postData.content,
        createdAt: new Date(postData.createdAt),
        relevance: postData.relevance,
        lang: postData.lang,
        author_id: postData.author.id,
        author_name: postData.author.name,
        author_handle: postData.author.handle,
        author_avatar: postData.author.avatar,
        tags: postData.tags,
        media: postData.media,
        linkPreview: postData.linkPreview,
        scores: postData.scores,
        categories: postData.categories,
        labels: postData.labels,
        original: postData.original,
        // Legacy fields for backward compatibility
        author: postData.author.name,
        posted_at: new Date(postData.createdAt),
        received_at: new Date(),
      } as any,
    });

    // Associate categories with the post
    if (categories.length > 0) {
      await post.$set('categories_relation', categories);
    }

    return post;
  }

  async getPostsByCategories(
    categorySlugs: string[],
  ): Promise<PostResponseDto[]> {
    const whereClause =
      categorySlugs.length > 0
        ? {
            '$categories_relation.slug$': {
              [Op.in]: categorySlugs,
            },
          }
        : {};

    const posts = await this.postModel.findAll({
      where: whereClause,
      include: [
        {
          model: Category,
          through: { attributes: [] }, // Exclude join table attributes
          attributes: ['slug'],
        },
      ],
      order: [['posted_at', 'DESC']],
      limit: 30,
      attributes: ['id', 'content', 'author', 'source', 'posted_at'],
    });

    return posts.map((post) => ({
      id: post.id,
      content: post.content,
      author: post.author,
      source: post.source,
      posted_at: post.posted_at,
      categories:
        post.categories_relation?.map((category) => category.slug) || [],
    }));
  }

  async notifyNewPost(postId: string): Promise<void> {
    const post = await this.postModel.findByPk(postId, {
      include: [
        {
          model: Category,
          through: { attributes: [] },
          attributes: ['slug'],
        },
      ],
      attributes: ['id', 'content', 'source', 'posted_at'],
    });

    if (!post) {
      throw new Error(`Post with ID ${postId} not found`);
    }

    const payload: NotificationPayload = {
      id: post.id,
      content: post.content,
      source: post.source,
      posted_at: post.posted_at.toISOString(),
      categories:
        post.categories_relation?.map((category) => category.slug) || [],
    };

    this.notificationsService.broadcast(payload);
  }
}
