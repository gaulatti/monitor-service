import {
  Controller,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthorizationGuard } from 'src/authorization/authorization.guard';
import {
  RegisterDeviceDto,
  UpdateDeviceDto,
  MarkPostReadDto,
  AnalyticsEventDto,
  DeviceRegistrationResponseDto,
} from 'src/dto';
import { DeviceService } from './device.service';
import { JSONLogger } from 'src/utils/logger';
import { Logger } from 'src/decorators/logger.decorator';
import { Public } from 'src/decorators/public.decorator';

/**
 * Controller for device management and push notification endpoints
 */
@Controller()
@UseGuards(AuthorizationGuard)
export class DeviceController {
  @Logger(DeviceController.name)
  private readonly logger!: JSONLogger;

  constructor(private readonly deviceService: DeviceService) {}

  /**
   * Register a new device for push notifications
   * POST /devices
   */
  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @Public()
  async registerDevice(
    @Body() deviceData: RegisterDeviceDto,
  ): Promise<DeviceRegistrationResponseDto> {
    const maskedToken = this.maskDeviceToken(deviceData.deviceToken);

    this.logger.log('Device registration request received', {
      maskedDeviceToken: maskedToken,
      platform: deviceData.platform,
      relevanceThreshold: deviceData.relevanceThreshold,
      isActive: deviceData.isActive,
      deviceModel: deviceData.deviceInfo.model,
      appVersion: deviceData.deviceInfo.appVersion,
      categoriesCount: deviceData.preferences.categories.length,
      endpoint: 'POST /devices',
    });

    const result = await this.deviceService.registerDevice(deviceData);

    this.logger.log('Device registration response sent', {
      maskedDeviceToken: maskedToken,
      deviceId: result.id,
      status: result.status,
      endpoint: 'POST /devices',
    });

    this.logger.log(
      `Device registration completed: ${deviceData.deviceToken} -> ${result.id}`,
    );

    return result;
  }

  /**
   * Update device settings (relevance threshold, active status)
   * PUT /devices/:deviceToken
   */
  @Put('devices/:deviceToken')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  async updateDevice(
    @Param('deviceToken') deviceToken: string,
    @Body() updateData: UpdateDeviceDto,
  ): Promise<void> {
    const maskedToken = this.maskDeviceToken(deviceToken);

    this.logger.log('Device update request received', {
      maskedDeviceToken: maskedToken,
      relevanceThreshold: updateData.relevanceThreshold,
      isActive: updateData.isActive,
      hasLastUpdated: !!updateData.lastUpdated,
      endpoint: 'PUT /devices/:deviceToken',
    });

    await this.deviceService.updateDevice(deviceToken, updateData);

    this.logger.log('Device update completed', {
      maskedDeviceToken: maskedToken,
      endpoint: 'PUT /devices/:deviceToken',
    });
  }

  /**
   * Mark a post as read for a specific device
   * POST /devices/:deviceToken/read
   */
  @Post('devices/:deviceToken/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  async markPostAsRead(
    @Param('deviceToken') deviceToken: string,
    @Body() markReadData: MarkPostReadDto,
  ): Promise<void> {
    const maskedToken = this.maskDeviceToken(deviceToken);

    this.logger.log('Mark post as read request received', {
      maskedDeviceToken: maskedToken,
      postId: markReadData.postId,
      readAt: markReadData.readAt,
      endpoint: 'POST /devices/:deviceToken/read',
    });

    await this.deviceService.markPostAsRead(deviceToken, markReadData);

    this.logger.log('Post marked as read successfully', {
      maskedDeviceToken: maskedToken,
      postId: markReadData.postId,
      endpoint: 'POST /devices/:deviceToken/read',
    });
  }

  /**
   * Record analytics event for device usage tracking
   * POST /analytics
   */
  @Post('analytics')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  async recordAnalyticsEvent(
    @Body() eventData: AnalyticsEventDto,
  ): Promise<void> {
    const maskedToken = this.maskDeviceToken(eventData.deviceToken);

    this.logger.log('Analytics event received', {
      maskedDeviceToken: maskedToken,
      event: eventData.event,
      platform: eventData.platform,
      postId: eventData.postId,
      hasRelevance: eventData.relevance !== undefined,
      hasCategories: !!eventData.categories,
      hasCount: eventData.count !== undefined,
      endpoint: 'POST /analytics',
    });

    await this.deviceService.recordAnalyticsEvent(eventData);

    this.logger.log('Analytics event processed', {
      maskedDeviceToken: maskedToken,
      event: eventData.event,
      endpoint: 'POST /analytics',
    });
  }

  /**
   * Mask device token for logging (show first 8 and last 4 characters)
   */
  private maskDeviceToken(token: string): string {
    if (!token || token.length < 12) {
      return '***masked***';
    }
    return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
  }
}
