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
    this.logger.log(
      `Registering device: ${deviceData.deviceToken} (platform: ${deviceData.platform})`,
    );

    const result = await this.deviceService.registerDevice(deviceData);

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
    this.logger.log(`Updating device settings: ${deviceToken}`);

    await this.deviceService.updateDevice(deviceToken, updateData);

    this.logger.log(`Device settings updated: ${deviceToken}`);
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
    this.logger.log(
      `Marking post as read: ${markReadData.postId} for device ${deviceToken}`,
    );

    await this.deviceService.markPostAsRead(deviceToken, markReadData);

    this.logger.log(
      `Post marked as read: ${markReadData.postId} for device ${deviceToken}`,
    );
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
    this.logger.log(
      `Recording analytics event: ${eventData.event} for device ${eventData.deviceToken}`,
    );

    await this.deviceService.recordAnalyticsEvent(eventData);

    this.logger.log(
      `Analytics event recorded: ${eventData.event} for device ${eventData.deviceToken}`,
    );
  }
}
