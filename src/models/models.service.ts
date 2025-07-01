import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Post, Category, Event, Match, Draft } from './index';

@Injectable()
export class ModelsService {
  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(Category)
    private categoryModel: typeof Category,
    @InjectModel(Event)
    private eventModel: typeof Event,
    @InjectModel(Match)
    private matchModel: typeof Match,
    @InjectModel(Draft)
    private draftModel: typeof Draft,
  ) {}

  // Post methods
  async createPost(postData: any): Promise<Post> {
    return this.postModel.create(postData);
  }

  async findAllPosts(): Promise<Post[]> {
    return this.postModel.findAll({
      include: ['categories', 'matches'],
    });
  }

  async findPostById(id: string): Promise<Post | null> {
    return this.postModel.findByPk(id, {
      include: ['categories', 'matches'],
    });
  }

  // Category methods
  async createCategory(categoryData: any): Promise<Category> {
    return this.categoryModel.create(categoryData);
  }

  async findAllCategories(): Promise<Category[]> {
    return this.categoryModel.findAll({
      include: ['posts'],
    });
  }

  // Event methods
  async createEvent(eventData: any): Promise<Event> {
    return this.eventModel.create(eventData);
  }

  async findAllEvents(): Promise<Event[]> {
    return this.eventModel.findAll({
      include: ['posts', 'drafts'],
    });
  }

  async findEventById(id: string): Promise<Event | null> {
    return this.eventModel.findByPk(id, {
      include: ['posts', 'drafts'],
    });
  }

  // Match methods
  async createMatch(matchData: any): Promise<Match> {
    return this.matchModel.create(matchData);
  }

  async findMatchesByEvent(eventId: string): Promise<Match[]> {
    return this.matchModel.findAll({
      where: { event_id: eventId },
      include: ['post', 'event'],
    });
  }

  // Draft methods
  async createDraft(draftData: any): Promise<Draft> {
    return this.draftModel.create(draftData);
  }

  async findDraftsByEvent(eventId: string): Promise<Draft[]> {
    return this.draftModel.findAll({
      where: { event_id: eventId },
      include: ['event'],
    });
  }

  // Complex queries
  async findPostsByCategory(categorySlug: string): Promise<Post[]> {
    return this.postModel.findAll({
      include: [
        {
          model: Category,
          where: { slug: categorySlug },
          through: { attributes: [] },
        },
      ],
    });
  }

  async findEventsByStatus(
    status: 'open' | 'archived' | 'dismissed',
  ): Promise<Event[]> {
    return this.eventModel.findAll({
      where: { status },
      include: ['posts', 'drafts'],
    });
  }

  async findPostsWithHighMatchScore(minScore: number): Promise<Post[]> {
    return this.postModel.findAll({
      include: [
        {
          model: Match,
          where: {
            match_score: {
              [Op.gte]: minScore,
            },
          },
          include: ['event'],
        },
      ],
    });
  }
}
