import { Controller, Get, Query } from '@nestjs/common';
import { PostsService, IngestResponseDto } from './posts.service';

export interface GetIngestsQueryDto {
  categories?: string;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async getPosts(
    @Query() query: GetIngestsQueryDto,
  ): Promise<IngestResponseDto[]> {
    const categories =
      query.categories?.split(',').map((cat) => cat.trim()) || [];

    return await this.postsService.getIngestsByCategories(categories);
  }
}
