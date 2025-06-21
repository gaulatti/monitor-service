import { Body, Controller, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service';

class SendMessageDto {
  message: string;
}

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('post')
  async postToTelegram(@Body() dto: SendMessageDto) {
    await this.telegramService.sendMessage(dto.message);
    return { success: true };
  }
}
