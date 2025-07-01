# Content Ingestion API Documentation

This document describes the Content Ingestion API endpoints for the monitoring service. The service provides source-agnostic content ingestion and retrieval capabilities.

## Endpoints

### GET /posts

Retrieves the 30 most recent ingested content items, optionally filtered by categories.

#### Query Parameters

- `categories` (optional): Comma-separated list of category slugs to filter content

#### Examples

```bash
# Get all recent ingested content
GET /posts

# Get content from specific categories
GET /posts?categories=breaking,tech

# Get content from a single category
GET /posts?categories=politics
```

#### Response Format

```json
[
  {
    "id": "content-uuid-here",
    "content": "Content text here...",
    "author": "John Doe",
    "source": "twitter",
    "posted_at": "2025-01-15T10:30:00.000Z",
    "categories": ["breaking", "tech"]
  },
  {
    "id": "another-content-uuid",
    "content": "Another content text...",
    "author": "Jane Smith",
    "source": "bluesky",
    "posted_at": "2025-01-15T09:15:00.000Z",
    "categories": ["politics"]
  }
]
```

#### Response Details

- **Limit**: Maximum 30 content items returned
- **Ordering**: Content is sorted by `posted_at` in descending order (newest first)
- **Filtering**: If categories are specified, only content tagged with **any** of the specified categories are returned
- **Categories**: Each content item includes an array of category slugs it's tagged with
- **Source**: Each item includes the original source platform (e.g., twitter, bluesky, etc.)

## Service Methods

### PostsService

#### `getIngestsByCategories(categorySlugs: string[]): Promise<IngestResponseDto[]>`

Retrieves ingested content filtered by category slugs.

**Parameters:**
- `categorySlugs`: Array of category slugs to filter by. If empty, returns all content.

**Returns:**
- Array of ingested content with their associated category slugs

#### `notifyNewIngest(contentId: string): Promise<void>`

Loads ingested content and its categories, then broadcasts a notification via SSE.

**Parameters:**
- `contentId`: The ID of the content to notify about

**Broadcast Payload:**
```json
{
  "id": "content-id",
  "content": "content text",
  "source": "twitter",
  "posted_at": "2025-06-26T18:00:00Z",
  "categories": ["breaking", "politics"]
}
```

## Database Queries

The service uses Sequelize to perform the following operations:

1. **Content Retrieval**: Fetches ingested content with their associated categories using JOINs
2. **Category Filtering**: Uses `Op.in` operator to filter by multiple category slugs
3. **Ordering**: Orders by `posted_at` DESC to get most recent content first
4. **Limiting**: Limits results to 30 content items
5. **Attribute Selection**: Only selects required fields for performance

## Error Handling

- **Content Not Found**: If `notifyNewIngest` is called with a non-existent content ID, it throws an error
- **Invalid Categories**: Empty or invalid category slugs are handled gracefully
- **Database Errors**: Sequelize errors are propagated up the call stack

## Usage Examples

### In a Controller

```typescript
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async getPosts(@Query() query: GetIngestsQueryDto): Promise<IngestResponseDto[]> {
    const categories = query.categories
      ?.split(',')
      .map((cat) => cat.trim()) || [];

    return await this.postsService.getIngestsByCategories(categories);
  }
}
```

### In a Service

```typescript
@Injectable()
export class SomeService {
  constructor(private readonly postsService: PostsService) {}

  async handleNewIngest(contentId: string) {
    // Notify all connected clients about the new content
    await this.postsService.notifyNewIngest(contentId);
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