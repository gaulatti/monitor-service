import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import { DedupRequestDto, GetIngestsQueryDto, PostResponseDto } from 'src/dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @Public()
  async getPosts(
    @Query() query: GetIngestsQueryDto,
  ): Promise<PostResponseDto[]> {
    const categories =
      query.categories?.split(',').map((cat) => cat.trim()) || [];

    return await this.postsService.getPostsByCategories(categories);
  }

  @Post('dedup')
  @Public()
  async dedup(@Body() body: DedupRequestDto) {
    return await this.postsService.dedupPosts(body);
  }
}
