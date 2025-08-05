import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import {
  ClusterRequestDto,
  ClusterResponseDto,
  EventsListResponseDto,
} from 'src/dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Public()
  async getEvents(
    @Query('limit') limit?: number,
  ): Promise<EventsListResponseDto> {
    const parsedLimit = limit && limit > 0 && limit <= 100 ? limit : 50;
    return await this.eventsService.getEvents(parsedLimit);
  }

  @Get(':uuid')
  @Public()
  async getEventByUuid(@Param('uuid') uuid: string): Promise<any> {
    const event = await this.eventsService.getEventByUuid(uuid);
    if (!event) {
      throw new Error('Event not found');
    }
    return event;
  }

  @Post('cluster')
  @Public()
  async processCluster(
    @Body() { input }: { input: ClusterRequestDto },
  ): Promise<ClusterResponseDto> {
    return await this.eventsService.processCluster(input);
  }

  @Put(':uuid/status')
  @Public()
  async updateEventStatus(
    @Param('uuid') uuid: string,
    @Body() { status }: { status: 'open' | 'archived' | 'dismissed' },
  ): Promise<any> {
    const event = await this.eventsService.updateEventStatus(uuid, status);
    if (!event) {
      throw new Error('Event not found');
    }
    return event;
  }
}
