import { Test, TestingModule } from '@nestjs/testing';
import { PostIngestionService } from './post-ingestion.service';

describe('PostIngestionService', () => {
  let service: PostIngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostIngestionService],
    }).compile();

    service = module.get<PostIngestionService>(PostIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
