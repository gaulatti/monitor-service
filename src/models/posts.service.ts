import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Post, Category, Tagging } from './index';
import { NotificationsService } from '../core/notifications/notifications.service';

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

  async getPostsByCategories(categorySlugs: string[]): Promise<PostResponseDto[]> {
    const whereClause = categorySlugs.length > 0 
      ? {
          '$categories.slug$': {
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
      categories: post.categories?.map((category) => category.slug) || [],
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
      categories: post.categories?.map((category) => category.slug) || [],
    };

    this.notificationsService.broadcast(payload);
  }
} 