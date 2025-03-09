import { Test, TestingModule } from '@nestjs/testing';
import { BlueskyService } from './bluesky.service';

describe('BlueskyService', () => {
  let service: BlueskyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlueskyService],
    }).compile();

    service = module.get<BlueskyService>(BlueskyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
