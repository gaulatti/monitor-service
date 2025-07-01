import { Test, TestingModule } from '@nestjs/testing';
import { PostIngestionController } from './post-ingestion.controller';

describe('PostIngestionController', () => {
  let controller: PostIngestionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostIngestionController],
    }).compile();

    controller = module.get<PostIngestionController>(PostIngestionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});