# Content Ingestion API Documentation

This document describes the Content Ingestion API endpoints for the monitoring service. The service provides source-agnostic content ingestion, retrieval, and vector similarity search capabilities.

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

### GET /posts/similar

Finds posts with similar content using vector similarity search powered by Qdrant.

#### Query Parameters

- `query` (required): The text to search for similar content
- `limit` (optional): Maximum number of similar posts to return (default: 10, max: 50)

#### Examples

```bash
# Find posts similar to a specific text
GET /posts/similar?query=artificial%20intelligence%20developments

# Limit results to 5 similar posts
GET /posts/similar?query=climate%20change&limit=5

# Search for posts about technology
GET /posts/similar?query=new%20technology%20innovations&limit=20
```

#### Response Format

```json
[
  {
    "postId": "post-uuid-here",
    "score": 0.95,
    "content": "Snippet of similar content..."
  },
  {
    "postId": "another-post-uuid",
    "score": 0.87,
    "content": "Another similar content snippet..."
  }
]
```

#### Response Details

- **Score**: Similarity score between 0.0 and 1.0 (higher = more similar)
- **Content**: Truncated snippet of the similar post content (up to 500 characters)
- **Ordering**: Results are ordered by similarity score in descending order
- **Vector Database**: Uses Qdrant for efficient vector similarity search
- **Graceful Degradation**: Returns empty array if vector database is unavailable

### GET /posts/vector-health

Checks the health and availability of the vector similarity search system.

#### Examples

```bash
# Check vector database health
GET /posts/vector-health
```

#### Response Format

```json
{
  "healthy": true,
  "message": "Vector database is accessible and functioning"
}
```

Or when unhealthy:

```json
{
  "healthy": false,
  "message": "Vector database is not accessible or not functioning properly"
}
```

## Vector Similarity Features

The service includes advanced vector similarity search capabilities that allow finding semantically similar content across all ingested posts.

### How It Works

1. **Embedding Generation**: Each post's content is converted to a 384-dimensional vector embedding
2. **Vector Storage**: Embeddings are stored in Qdrant vector database for efficient similarity search
3. **Duplicate Detection**: New posts are automatically checked against existing posts for similarity
4. **Search**: Users can search for content similar to any given text query

### Vector Database Configuration

The vector database can be configured using environment variables:

- `QDRANT_URL`: URL for the Qdrant vector database (default: `http://localhost:6333`)

### Similarity Threshold

- **Duplicate Detection**: Posts with similarity score ≥ 0.85 are flagged as potential duplicates
- **Search Results**: All similarity scores are returned, allowing clients to filter as needed

### Performance Considerations

- **Health Checks**: Vector operations include health checks for graceful degradation
- **Error Handling**: Service continues to function even if vector database is unavailable
- **Embedding Strategy**: Currently uses hash-based embeddings (recommended to replace with proper ML embeddings in production)

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