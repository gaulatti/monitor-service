import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import { IngestResponseDto, PostsService } from './posts.service';

export interface GetIngestsQueryDto {
  categories?: string;
}

export interface DedupRequestDto {
  input: string[];
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

  @Post('dedup')
  @Public()
  async dedup(@Body() body: any) {
    return await this.postsService.dedupPosts(body);
  }
}
