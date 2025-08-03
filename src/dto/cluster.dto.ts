import {
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ClusterPostDto {
  @IsNumber()
  id: number;

  @IsString()
  hash: string;

  @IsString()
  content: string;
}

export class ClusterGroupDto {
  @IsNumber()
  group_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClusterPostDto)
  posts: ClusterPostDto[];

  @IsNumber()
  size: number;

  @IsString()
  primary_topic: string;

  @IsArray()
  @IsString({ each: true })
  primary_entities: string[];

  @IsNumber()
  avg_similarity: number;
}

export class ClusterRequestDto {
  @IsNumber()
  total_posts: number;

  @IsNumber()
  total_groups: number;

  @ValidateNested()
  @Type(() => ClusterGroupDto)
  group: ClusterGroupDto;

  @IsNumber()
  processing_time: number;

  @IsOptional()
  debug_info?: any;
}

export class ClusterResponseDto {
  @IsNumber()
  event_id: number;

  @IsString()
  event_uuid: string;

  @IsString()
  title: string;

  @IsString()
  summary: string;

  @IsNumber()
  posts_associated: number;

  @IsString()
  status: 'created' | 'existing';
}
