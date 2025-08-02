import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import {
  DedupRequestDto,
  GetIngestsQueryDto,
  PostResponseDto,
  SimilaritySearchQueryDto,
  SimilaritySearchResultDto,
} from 'src/dto';
import { IngestService } from '../ingest/ingest.service';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly ingestService: IngestService,
  ) {}

  @Get()
  @Public()
  async getPosts(
    @Query() query: GetIngestsQueryDto,
  ): Promise<PostResponseDto[]> {
    const categories =
      query.categories?.split(',').map((cat) => cat.trim()) || [];

    return await this.postsService.getPostsByCategories(categories);
  }

  @Post('similar')
  @Public()
  async findSimilarPosts(
    @Body() query: SimilaritySearchQueryDto,
  ): Promise<SimilaritySearchResultDto[]> {
    if (!query.embedding || query.embedding.length === 0) {
      return [];
    }

    const limit =
      query.limit && query.limit > 0 && query.limit <= 50 ? query.limit : 10;

    return await this.ingestService.searchSimilarContent(
      query.embedding,
      limit,
    );
  }

  @Get('vector-health')
  @Public()
  async checkVectorHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Try to search with a simple test embedding (384 dimensions with small values)
      const testEmbedding = new Array(384).fill(0.1);
      await this.ingestService.searchSimilarContent(testEmbedding, 1);
      return {
        healthy: true,
        message: 'Vector search service is accessible and functioning',
      };
    } catch {
      return {
        healthy: false,
        message:
          'Vector search service is not accessible or not functioning properly',
      };
    }
  }

  @Post('dedup')
  @Public()
  async dedup(@Body() body: DedupRequestDto) {
    return await this.postsService.dedupPosts(body);
  }
}
