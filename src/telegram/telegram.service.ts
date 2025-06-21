import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigInteger } from 'big-integer';
import * as input from 'input';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private client: TelegramClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    await this.initializeClient();
  }

  private async initializeClient() {
    const apiIdStr = this.configService.get<string>('TELEGRAM_API_ID');
    if (!apiIdStr) throw new Error('TELEGRAM_API_ID must be set');
    const apiId = parseInt(apiIdStr, 10);
    if (isNaN(apiId)) throw new Error('TELEGRAM_API_ID must be a valid number');

    const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');
    if (!apiHash) throw new Error('TELEGRAM_API_HASH must be set');

    const sessionString = this.configService.get<string>('TELEGRAM_SESSION');
    const stringSession = new StringSession(sessionString || '');
    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    await this.client.connect();

    if (!sessionString) {
      await this.client.start({
        phoneNumber: async () =>
          await input.text('Please enter your phone number: '),
        password: async () => await input.text('Please enter your password: '),
        phoneCode: async () =>
          await input.text('Please enter the code you received: '),
        onError: (err) => this.logger.error(err),
      });
      const savedSession = this.client.session.save();
      this.logger.log('Save this session string for future use:');
      this.logger.log(savedSession);
    }
  }

  private async sendMediaToBot(
    botToken: string,
    chatId: string,
    message: any,
    formattedText: string,
  ) {
    try {
      if (message.photo) {
        const photo = message.photo[message.photo.length - 1];
        this.logger.debug('Processing photo:', {
          photoId: photo.id,
          size: photo.size,
          type: photo.type,
        });

        const buffer = await this.client.downloadMedia(photo, {
          progressCallback: (downloaded: BigInteger) => {
            this.logger.debug(
              `Downloading photo: ${Math.round(downloaded.toJSNumber() * 100)}%`,
            );
          },
        });

        if (!buffer) {
          throw new Error('Failed to download photo');
        }

        this.logger.debug('Photo downloaded successfully', {
          bufferSize: buffer.length,
        });

        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('caption', formattedText);
        formData.append('parse_mode', 'HTML');
        formData.append('photo', new Blob([buffer]), 'photo.jpg');

        await this.httpService.axiosRef.post(
          `https://api.telegram.org/bot${botToken}/sendPhoto`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );
      } else if (message.video) {
        this.logger.debug('Processing video:', {
          videoId: message.video.id,
          size: message.video.size,
          mimeType: message.video.mimeType,
          duration: message.video.duration,
        });

        try {
          const buffer = await this.client.downloadMedia(message.video, {
            progressCallback: (downloaded: BigInteger) => {
              this.logger.debug(
                `Downloading video: ${Math.round(downloaded.toJSNumber() * 100)}%`,
              );
            },
          });

          if (!buffer) {
            throw new Error('Failed to download video');
          }

          this.logger.debug('Video downloaded successfully', {
            bufferSize: buffer.length,
          });

          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append('caption', formattedText);
          formData.append('parse_mode', 'HTML');
          formData.append('video', new Blob([buffer]), 'video.mp4');

          this.logger.debug('Sending video to bot...');
          const response = await this.httpService.axiosRef.post(
            `https://api.telegram.org/bot${botToken}/sendVideo`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
            },
          );

          this.logger.debug('Video sent successfully', {
            status: response.status,
            statusText: response.statusText,
          });
        } catch (downloadError) {
          this.logger.error('Video download/upload failed:', {
            error:
              downloadError instanceof Error
                ? downloadError.message
                : 'Unknown error',
            stack:
              downloadError instanceof Error ? downloadError.stack : undefined,
          });
          throw downloadError;
        }
      } else {
        await this.httpService.axiosRef.post(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            chat_id: chatId,
            text: formattedText,
            parse_mode: 'HTML',
          },
        );
      }
    } catch (error) {
      this.logger.error('Failed to send media to bot:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        mediaType: message.photo ? 'photo' : message.video ? 'video' : 'text',
      });

      // Fallback to text-only message
      await this.httpService.axiosRef.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: formattedText,
          parse_mode: 'HTML',
        },
      );
    }
  }

  async sendMessage(message: string) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');
    if (!botToken || !chatId)
      throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set');

    try {
      await this.httpService.axiosRef.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        },
      );
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }
}
