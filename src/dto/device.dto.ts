import {
  IsString,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Device information DTO for device registration
 */
export class DeviceInfoDto {
  @IsUUID()
  deviceId: string;

  @IsString()
  model: string;

  @IsString()
  systemVersion: string;

  @IsString()
  appVersion: string;

  @IsString()
  buildNumber: string;

  @IsString()
  bundleId: string;

  @IsString()
  timeZone: string;

  @IsString()
  language: string;
}

/**
 * User preferences DTO for device registration
 */
export class PreferencesDto {
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @IsBoolean()
  quietHours: boolean;
}

/**
 * Device registration DTO
 */
export class RegisterDeviceDto {
  @IsString()
  deviceToken: string;

  @IsString()
  platform: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  relevanceThreshold: number;

  @IsBoolean()
  isActive: boolean;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo: DeviceInfoDto;

  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences: PreferencesDto;

  @IsDateString()
  registeredAt: string;
}

/**
 * Device update DTO
 */
export class UpdateDeviceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  relevanceThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsDateString()
  lastUpdated: string;
}

/**
 * Mark post as read DTO
 */
export class MarkPostReadDto {
  @IsString()
  postId: string;

  @IsDateString()
  readAt: string;
}

/**
 * Device registration response DTO
 */
export interface DeviceRegistrationResponseDto {
  id: string;
  status: string;
}

/**
 * Analytics event DTO
 */
export class AnalyticsEventDto {
  @IsString()
  deviceToken: string;

  @IsString()
  event: string;

  @IsDateString()
  timestamp: string;

  @IsString()
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsNumber()
  relevance?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsNumber()
  count?: number;

  // Optional device information for better auto-registration
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
