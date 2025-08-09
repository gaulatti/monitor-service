# Posts Backfill Endpoint

## Usage

Once the server is running, you can trigger the backfill process by making a POST request to the new endpoint:

```bash
curl -X POST http://localhost:3000/posts/backfill \
  -H "Content-Type: application/json"
```

## Response Format

The endpoint returns a comprehensive JSON summary:

```json
{
  "scanned": 1500,
  "missing": 120,
  "processed": 115,
  "skipped": 5,
  "duration_ms": 45000,
  "items": [
    {
      "postId": 123,
      "stored": true,
      "similarCount": 3
    },
    {
      "postId": 124,
      "stored": false,
      "reason": "Failed to fetch embedding"
    }
  ]
}
```

## Response Fields

- `scanned`: Total number of posts examined
- `missing`: Number of posts that didn't have vectors in Qdrant
- `processed`: Number of posts successfully processed and stored
- `skipped`: Number of posts that failed processing
- `duration_ms`: Total processing time in milliseconds
- `items`: Array with details for each processed post
  - `postId`: The database ID of the post
  - `stored`: Whether the vector was successfully stored
  - `reason`: Error message if storage failed (optional)
  - `similarCount`: Number of similar posts found (optional)

## Features

- **No Limit**: Processes ALL posts missing from Qdrant
- **Batch Processing**: Handles posts in batches of 500 to avoid memory issues
- **Reuses Existing Code**: Uses `IngestService.storePostVector` and `searchSimilarContent`
- **Embedding Management**: Fetches embeddings from embed service when missing
- **Database Updates**: Stores new embeddings in the Post model
- **Error Handling**: Continues processing even if individual posts fail
- **Comprehensive Logging**: Detailed logs for monitoring and debugging

## Implementation Notes

- Endpoint is marked as `@Public()` - no authentication required
- Uses hardcoded embed service endpoint: `http://192.168.0.99:8000/embed`
- Batch size is set to 500 posts for optimal performance
- Qdrant collection name is `posts_vectors`
- Embedding dimension is 384 (same as existing implementation)