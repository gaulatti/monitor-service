import { Controller, Get, Query } from '@nestjs/common';
import { PostsService } from './posts.service';

export interface GetPostsQueryDto {
  categories?: string;
}

export interface PostResponseDto {
  id: string;
  content: string;
  author: string;
  source: string;
  posted_at: Date;
  categories: string[];
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async getPosts(@Query() query: GetPostsQueryDto): Promise<PostResponseDto[]> {
    const categories = query.categories
      ?.split(',')
      .map((cat) => cat.trim()) || [];

    return await this.postsService.getPostsByCategories(categories);
  }
} 