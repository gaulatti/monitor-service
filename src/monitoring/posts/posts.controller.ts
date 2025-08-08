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

    // Validate and set limit (default 50, max 50, min 1)
    const limit = query.limit !== undefined && query.limit !== null
      ? Math.min(Math.max(1, query.limit), 50)
      : 50;

    // Parse before timestamp if provided
    let before: Date | undefined;
    if (query.before) {
      before = new Date(query.before);
      if (isNaN(before.getTime())) {
        before = undefined; // Invalid timestamp, ignore
      }
    }

    return await this.postsService.getPosts({
      categorySlugs: categories,
      limit,
      before,
    });
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

  @Get('vectors')
  @Public()
  async listVectors(@Query('limit') limit?: number): Promise<{
    vectors: Array<{
      id: number;
      postId?: string;
      mysqlId?: number;
      content?: string;
      source?: string;
      createdAt?: string;
      hash?: string;
      vector?: number[];
    }>;
    total: number;
    collectionInfo: {
      status: string;
      pointsCount: number;
      vectorSize: number;
      distance: string;
    };
  }> {
    return await this.ingestService.listVectors(
      limit && limit > 0 && limit <= 100 ? limit : 20,
    );
  }

  @Post('dedup')
  @Public()
  async dedup(@Body() body: DedupRequestDto) {
    return await this.postsService.dedupPosts(body);
  }
}
