import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { NotificationsService } from 'src/core/notifications/notifications.service';
import { Logger } from 'src/decorators/logger.decorator';
import {
  ClusterRequestDto,
  ClusterResponseDto,
  EventsListResponseDto,
} from 'src/dto';
import { Event, Match, Post } from 'src/models';
import { JSONLogger } from 'src/utils/logger';
import { nanoid } from 'src/utils/nanoid';

/**
 * Service responsible for managing events and clustering operations.
 *
 * The `EventsService` handles:
 * - Processing cluster data and creating/updating events
 * - Managing post-event associations through the Match model
 * - Retrieving events with their associated posts
 * - Sending notifications for event creation and updates
 *
 * Dependencies:
 * - `Event`, `Post`, and `Match` models for database operations
 * - `NotificationsService` for sending event notifications
 *
 * @remarks
 * This service is focused on event management and clustering operations,
 * providing a clean separation from post management functionality.
 */
@Injectable()
export class EventsService {
  @Logger(EventsService.name)
  private readonly logger!: JSONLogger;

  constructor(
    @InjectModel(Event)
    private eventModel: typeof Event,
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(Match)
    private matchModel: typeof Match,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Processes a cluster of posts and creates or associates them with an event.
   * If more than 2 posts in the group, checks for existing events and creates one if needed.
   *
   * @param clusterData - The cluster data containing posts and metadata
   * @returns A response with event information and association status
   */
  async processCluster(
    clusterData: ClusterRequestDto,
  ): Promise<ClusterResponseDto> {
    const { group } = clusterData;

    // Only process if there are more than 2 posts
    if (group.size <= 2) {
      this.logger.log(
        'Skipping cluster processing - insufficient posts for event creation',
        {
          groupId: group.group_id,
          postsCount: group.size,
          reason:
            'Clusters with 2 or fewer posts do not require event association',
        },
      );

      return {
        event_id: 0,
        event_uuid: '',
        title: 'No event created',
        summary: `Cluster with ${group.size} posts - insufficient for event creation`,
        posts_associated: 0,
        status: 'existing' as const,
      };
    }

    try {
      // Find posts by their IDs
      const posts = await this.postModel.findAll({
        where: {
          id: {
            [Op.in]: group.posts.map((p) => p.id),
          },
        },
        include: [
          {
            model: Match,
            include: [Event],
          },
        ],
      });

      if (posts.length === 0) {
        throw new Error('No posts found with the provided IDs');
      }

      // Check if any post already has an event associated
      let existingEvent: Event | null = null;
      for (const post of posts) {
        if (post.matches && post.matches.length > 0) {
          existingEvent = post.matches[0].event;
          break;
        }
      }

      let event: Event;
      let status: 'created' | 'existing';

      if (existingEvent) {
        // Use existing event
        event = existingEvent;
        status = 'existing';
        this.logger.log('Found existing event for cluster', {
          eventId: event.id,
          eventUuid: event.uuid,
          groupId: group.group_id,
        });
      } else {
        // Create new event
        const title =
          posts[0].content ||
          `${group.primary_topic}: ${group.primary_entities.slice(0, 3).join(', ')}`;
        const summary = `Cluster of ${group.size} posts about ${group.primary_topic} with average similarity ${group.avg_similarity.toFixed(3)}`;

        event = await this.eventModel.create({
          uuid: nanoid(),
          title,
          summary,
          status: 'open',
        } as any);

        status = 'created';
        this.logger.log('Created new event for cluster', {
          eventId: event.id,
          eventUuid: event.uuid,
          title,
          groupId: group.group_id,
        });

        // Send notification for new event
        try {
          await this.notificationsService.sendEventNotification({
            id: event.id.toString(),
            uuid: event.uuid,
            title: event.title,
            summary: event.summary,
            posts_count: posts.length,
            status: 'created',
          });
        } catch (error) {
          this.logger.error('Failed to send event creation notification', '', {
            eventId: event.id,
            eventUuid: event.uuid,
            error: error.message,
          });
        }
      }

      // Associate all posts with the event (skip if already associated)
      let postsAssociated = 0;
      for (const post of posts) {
        // Check if post is already associated with this event
        const existingMatch = await this.matchModel.findOne({
          where: {
            event_id: event.id,
            post_id: post.id,
          },
        });

        if (!existingMatch) {
          await this.matchModel.create({
            event_id: event.id,
            post_id: post.id,
            match_score: group.avg_similarity,
            added_by: 'cluster_system',
          } as any);
          postsAssociated++;
        }
      }

      this.logger.log('Cluster processing completed', {
        eventId: event.id,
        eventUuid: event.uuid,
        totalPosts: posts.length,
        postsAssociated,
        status,
        groupId: group.group_id,
      });

      // Send notification for event update if posts were associated with existing event
      if (status === 'existing' && postsAssociated > 0) {
        try {
          await this.notificationsService.sendEventNotification({
            id: event.id.toString(),
            uuid: event.uuid,
            title: event.title,
            summary: event.summary,
            posts_count: posts.length,
            status: 'updated',
          });
        } catch (error) {
          this.logger.error('Failed to send event update notification', '', {
            eventId: event.id,
            eventUuid: event.uuid,
            error: error.message,
          });
        }
      }

      return {
        event_id: event.id,
        event_uuid: event.uuid,
        title: event.title,
        summary: event.summary,
        posts_associated: postsAssociated,
        status,
      };
    } catch (error) {
      this.logger.error('Failed to process cluster', '', {
        error: error.message,
        groupId: group.group_id,
        postsCount: group.posts.length,
      });
      throw error;
    }
  }

  /**
   * Retrieves all events with their associated posts.
   * Returns events ordered by creation date (most recent first).
   *
   * @param limit - Maximum number of events to return (default: 50)
   * @returns A response containing events with their posts
   */
  async getEvents(limit: number = 50): Promise<EventsListResponseDto> {
    try {
      const events = await this.eventModel.findAll({
        order: [['created_at', 'DESC']],
        limit: Math.min(limit, 100), // Cap at 100 events
        include: [
          {
            model: Post,
            through: {
              attributes: ['match_score', 'added_by', 'added_at'],
            },
            attributes: [
              'id',
              'uuid',
              'content',
              'source',
              'uri',
              'hash',
              'author_name',
              'author_handle',
              'createdAt',
              'relevance',
            ],
          },
        ],
      });

      const eventsData = events.map((event) => ({
        id: event.id,
        uuid: event.uuid,
        title: event.title,
        summary: event.summary,
        status: event.status,
        created_at: event.created_at.toISOString(),
        updated_at: event.updated_at.toISOString(),
        posts_count: event.posts ? event.posts.length : 0,
        posts: event.posts
          ? event.posts.map((post) => ({
              id: post.id,
              uuid: post.uuid,
              content: post.content || '',
              source: post.source || '',
              uri: post.uri || '',
              hash: post.hash || '',
              author_name: post.author_name || '',
              author_handle: post.author_handle || '',
              createdAt: post.createdAt.toISOString(),
              relevance: post.relevance,
              match_score: (post as any).Match?.match_score || 0,
            }))
          : [],
      }));

      this.logger.log('Retrieved events with posts', {
        eventsCount: eventsData.length,
        totalPosts: eventsData.reduce(
          (sum, event) => sum + event.posts_count,
          0,
        ),
        limit,
      });

      return {
        events: eventsData,
        total: eventsData.length,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve events', '', {
        error: error.message,
        limit,
      });
      throw error;
    }
  }

  /**
   * Retrieves a single event by UUID with its associated posts.
   *
   * @param uuid - The UUID of the event to retrieve
   * @returns The event with its posts or null if not found
   */
  async getEventByUuid(uuid: string): Promise<any> {
    try {
      const event = await this.eventModel.findOne({
        where: { uuid },
        include: [
          {
            model: Post,
            through: {
              attributes: ['match_score', 'added_by', 'added_at'],
            },
            attributes: [
              'id',
              'uuid',
              'content',
              'source',
              'uri',
              'hash',
              'author_name',
              'author_handle',
              'createdAt',
              'relevance',
            ],
          },
        ],
      });

      if (!event) {
        return null;
      }

      return {
        id: event.id,
        uuid: event.uuid,
        title: event.title,
        summary: event.summary,
        status: event.status,
        created_at: event.created_at.toISOString(),
        updated_at: event.updated_at.toISOString(),
        posts_count: event.posts ? event.posts.length : 0,
        posts: event.posts
          ? event.posts.map((post) => ({
              id: post.id,
              uuid: post.uuid,
              content: post.content || '',
              source: post.source || '',
              uri: post.uri || '',
              hash: post.hash || '',
              author_name: post.author_name || '',
              author_handle: post.author_handle || '',
              createdAt: post.createdAt.toISOString(),
              relevance: post.relevance,
              match_score: (post as any).Match?.match_score || 0,
            }))
          : [],
      };
    } catch (error) {
      this.logger.error('Failed to retrieve event by UUID', '', {
        uuid,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Updates an event's status (open, archived, dismissed).
   *
   * @param uuid - The UUID of the event to update
   * @param status - The new status for the event
   * @returns The updated event or null if not found
   */
  async updateEventStatus(
    uuid: string,
    status: 'open' | 'archived' | 'dismissed',
  ): Promise<any> {
    try {
      const event = await this.eventModel.findOne({ where: { uuid } });
      
      if (!event) {
        return null;
      }

      await event.update({ status });

      this.logger.log('Event status updated', {
        eventId: event.id,
        eventUuid: event.uuid,
        oldStatus: event.status,
        newStatus: status,
      });

      return {
        id: event.id,
        uuid: event.uuid,
        title: event.title,
        summary: event.summary,
        status: event.status,
        created_at: event.created_at.toISOString(),
        updated_at: event.updated_at.toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to update event status', '', {
        uuid,
        status,
        error: error.message,
      });
      throw error;
    }
  }
}
