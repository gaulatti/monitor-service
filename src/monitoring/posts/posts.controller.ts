import { Controller, Get, Query } from '@nestjs/common';
import { PostsService, IngestResponseDto } from './posts.service';
import { Public } from 'src/decorators/public.decorator';

export interface GetIngestsQueryDto {
  categories?: string;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @Public()
  async getPosts(
    @Query() query: GetIngestsQueryDto,
  ): Promise<IngestResponseDto[]> {
    const categories =
      query.categories?.split(',').map((cat) => cat.trim()) || [];

    return await this.postsService.getIngestsByCategories(categories);
  }
}
