/**
 * Data Transfer Object representing an ingested content item.
 *
 * @property id - Unique identifier for the ingested item.
 * @property source - The source system or platform of the content.
 * @property uri - The URI or location of the original content.
 * @property content - The main textual content.
 * @property createdAt - ISO string representing when the content was created.
 * @property relevance - Numeric score indicating the relevance of the content.
 * @property lang - Language code of the content (e.g., 'en', 'es').
 * @property hash - Hash value for deduplication or integrity checks.
 * @property author - Information about the content's author.
 * @property author.id - Unique identifier for the author.
 * @property author.name - Display name of the author.
 * @property author.handle - Username or handle of the author.
 * @property author.avatar - URL to the author's avatar image.
 * @property media - Array of URLs to associated media files.
 * @property linkPreview - URL or data for a link preview.
 * @property original - (Optional) Original content or reference, if applicable.
 */
export interface IngestDto {
  id: string;
  source: string;
  uri: string;
  content: string;
  createdAt: string;
  relevance: number;
  lang: string;
  hash: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
  };
  media: string[];
  linkPreview: string;
  original?: string;
}
