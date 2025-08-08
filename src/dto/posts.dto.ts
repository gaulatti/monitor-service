/**
 * Represents the response data structure for a post.
 *
 * @property id - Unique identifier for the post.
 * @property content - The textual content of the post.
 * @property author - The name or identifier of the post's author.
 * @property source - The source platform or origin of the post.
 * @property uri - The URI linking to the post.
 * @property posted_at - The ISO string timestamp when the post was published.
 * @property relevance - A numeric score indicating the relevance of the post.
 * @property lang - The language code of the post's content.
 * @property hash - A unique hash representing the post.
 * @property author_id - Unique identifier for the author.
 * @property author_name - The display name of the author.
 * @property author_handle - The handle or username of the author.
 * @property author_avatar - URL to the author's avatar image.
 * @property media - Array of URLs to media associated with the post.
 * @property linkPreview - URL or data for a link preview associated with the post.
 * @property original - (Optional) The original content or source, if applicable.
 * @property received_at - The ISO string timestamp when the post was received by the system.
 * @property categories - Array of categories or tags associated with the post.
 */
export interface PostResponseDto {
  id: string;
  content: string;
  author: string;
  source: string;
  uri: string;
  posted_at: string;
  relevance: number;
  lang: string;
  hash: string;
  author_id: string;
  author_name: string;
  author_handle: string;
  author_avatar: string;
  media: string[];
  linkPreview: string;
  original?: string;
  received_at: string;
  categories: string[];
}

/**
 * Data Transfer Object for querying posts.
 *
 * @property categories - (Optional) A comma-separated list of category identifiers to filter the posts.
 * @property limit - (Optional) Maximum number of posts to return (default: 50, max: 50).
 * @property before - (Optional) ISO 8601 timestamp; return posts with posted_at < before.
 */
export interface GetPostsQueryDto {
  categories?: string;
  limit?: number;
  before?: string;
}

/**
 * Data Transfer Object for similarity search queries.
 *
 * @property embedding - The embedding vector to search for similar content.
 * @property limit - (Optional) Maximum number of similar posts to return (default: 10).
 */
export interface SimilaritySearchQueryDto {
  embedding: number[];
  limit?: number;
}

/**
 * Data Transfer Object for similarity search results.
 *
 * @property postId - The unique identifier of the similar post.
 * @property score - The similarity score (0.0 to 1.0).
 * @property content - (Optional) Snippet of the similar post content.
 */
export interface SimilaritySearchResultDto {
  postId: string;
  score: number;
  content?: string;
}

/**
 * Data Transfer Object for deduplication requests.
 *
 * @property input - An array of strings to be deduplicated.
 */
export interface DedupRequestDto {
  input: string[];
}
