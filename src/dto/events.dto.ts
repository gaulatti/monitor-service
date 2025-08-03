import {
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EventPostDto {
  @IsNumber()
  id: number;

  @IsString()
  uuid: string;

  @IsString()
  content: string;

  @IsString()
  source: string;

  @IsString()
  uri: string;

  @IsString()
  hash: string;

  @IsString()
  author_name: string;

  @IsString()
  author_handle: string;

  @IsDateString()
  createdAt: string;

  @IsNumber()
  relevance: number;

  @IsNumber()
  match_score: number;
}

export class EventResponseDto {
  @IsNumber()
  id: number;

  @IsString()
  uuid: string;

  @IsString()
  title: string;

  @IsString()
  summary: string;

  @IsString()
  status: 'open' | 'archived' | 'dismissed';

  @IsDateString()
  created_at: string;

  @IsDateString()
  updated_at: string;

  @IsNumber()
  posts_count: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventPostDto)
  posts: EventPostDto[];
}

export class EventsListResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventResponseDto)
  events: EventResponseDto[];

  @IsNumber()
  total: number;
}
