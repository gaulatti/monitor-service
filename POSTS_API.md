# Posts API Documentation

This document describes the Posts API endpoints for the monitoring service.

## Endpoints

### GET /posts

Retrieves the 30 most recent posts, optionally filtered by categories.

#### Query Parameters

- `categories` (optional): Comma-separated list of category slugs to filter posts

#### Examples

```bash
# Get all recent posts
GET /posts

# Get posts from specific categories
GET /posts?categories=breaking,tech

# Get posts from a single category
GET /posts?categories=politics
```

#### Response Format

```json
[
  {
    "id": "post-uuid-here",
    "content": "Post content here...",
    "author": "John Doe",
    "source": "twitter",
    "posted_at": "2025-01-15T10:30:00.000Z",
    "categories": ["breaking", "tech"]
  },
  {
    "id": "another-post-uuid",
    "content": "Another post content...",
    "author": "Jane Smith",
    "source": "twitter",
    "posted_at": "2025-01-15T09:15:00.000Z",
    "categories": ["politics"]
  }
]
```

#### Response Details

- **Limit**: Maximum 30 posts returned
- **Ordering**: Posts are sorted by `posted_at` in descending order (newest first)
- **Filtering**: If categories are specified, only posts tagged with **any** of the specified categories are returned
- **Categories**: Each post includes an array of category slugs it's tagged with

## Service Methods

### PostsService

#### `getPostsByCategories(categorySlugs: string[]): Promise<PostResponseDto[]>`

Retrieves posts filtered by category slugs.

**Parameters:**
- `categorySlugs`: Array of category slugs to filter by. If empty, returns all posts.

**Returns:**
- Array of posts with their associated category slugs

#### `notifyNewPost(postId: string): Promise<void>`

Loads a post and its categories, then broadcasts a notification via SSE.

**Parameters:**
- `postId`: The ID of the post to notify about

**Broadcast Payload:**
```json
{
  "id": "post-id",
  "content": "post content",
  "source": "twitter",
  "posted_at": "2025-06-26T18:00:00Z",
  "categories": ["breaking", "politics"]
}
```

## Database Queries

The service uses Sequelize to perform the following operations:

1. **Post Retrieval**: Fetches posts with their associated categories using JOINs
2. **Category Filtering**: Uses `Op.in` operator to filter by multiple category slugs
3. **Ordering**: Orders by `posted_at` DESC to get most recent posts first
4. **Limiting**: Limits results to 30 posts
5. **Attribute Selection**: Only selects required fields for performance

## Error Handling

- **Post Not Found**: If `notifyNewPost` is called with a non-existent post ID, it throws an error
- **Invalid Categories**: Empty or invalid category slugs are handled gracefully
- **Database Errors**: Sequelize errors are propagated up the call stack

## Usage Examples

### In a Controller

```typescript
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async getPosts(@Query() query: GetPostsQueryDto): Promise<PostResponseDto[]> {
    const categories = query.categories
      ?.split(',')
      .map((cat) => cat.trim()) || [];

    return await this.postsService.getPostsByCategories(categories);
  }
}
```

### In a Service

```typescript
@Injectable()
export class SomeService {
  constructor(private readonly postsService: PostsService) {}

  async handleNewPost(postId: string) {
    // Notify all connected clients about the new post
    await this.postsService.notifyNewPost(postId);
  }
}
```

## Testing

Run the tests with:

```bash
npm test src/models/posts.controller.spec.ts
```

The tests cover:
- Controller instantiation
- Category filtering functionality
- Empty category parameter handling
- Service method calls 