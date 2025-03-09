import { Test, TestingModule } from '@nestjs/testing';
import { BlueskyController } from './bluesky.controller';

describe('BlueskyController', () => {
  let controller: BlueskyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlueskyController],
    }).compile();

    controller = module.get<BlueskyController>(BlueskyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
