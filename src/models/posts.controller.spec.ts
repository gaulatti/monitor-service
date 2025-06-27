import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

describe('PostsController', () => {
  let controller: PostsController;
  let service: PostsService;

  const mockPostsService = {
    getPostsByCategories: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    controller = module.get<PostsController>(PostsController);
    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPosts', () => {
    it('should return posts filtered by categories', async () => {
      const mockPosts = [
        {
          id: '1',
          content: 'Test post',
          author: 'Test Author',
          source: 'twitter',
          posted_at: new Date(),
          categories: ['breaking', 'tech'],
        },
      ];

      mockPostsService.getPostsByCategories.mockResolvedValue(mockPosts);

      const result = await controller.getPosts({ categories: 'breaking,tech' });

      expect(service.getPostsByCategories).toHaveBeenCalledWith(['breaking', 'tech']);
      expect(result).toEqual(mockPosts);
    });

    it('should handle empty categories parameter', async () => {
      const mockPosts = [];
      mockPostsService.getPostsByCategories.mockResolvedValue(mockPosts);

      const result = await controller.getPosts({});

      expect(service.getPostsByCategories).toHaveBeenCalledWith([]);
      expect(result).toEqual(mockPosts);
    });
  });
}); 