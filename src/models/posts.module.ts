import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post, Category, Tagging } from './index';
import { NotificationsService } from '../core/notifications/notifications.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Post, Category, Tagging]),
  ],
  controllers: [PostsController],
  providers: [PostsService, NotificationsService],
  exports: [PostsService],
})
export class PostsModule {} 