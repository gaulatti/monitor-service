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
 * @property tags - Array of tag strings associated with the content.
 * @property score - Overall content score (nullable).
 * @property scores - Array of classification scores.
 * @property categories - Array of category strings.
 * @property labels - Array of label strings from classification.
 * @property _vote - Voting and classification metadata.
 * @property embeddings - Array of embedding vectors for semantic search.
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
  tags: string[];
  score: number | null;
  scores: number[];
  categories: string[];
  labels: string[];
  _vote: {
    text: string;
    language_detection: {
      languages: string[];
      probabilities: number[];
    };
    content_classification: {
      label: string;
      score: number;
      full_result: {
        sequence: string;
        labels: string[];
        scores: number[];
      };
    };
    translation: {
      original_text: string;
      translated_text: string;
      source_language: string;
      target_language: string;
      confidence_score: number | null;
    };
    label: string;
    score: number;
    full: {
      sequence: string;
      labels: string[];
      scores: number[];
    };
  };
  embeddings: number[];
}
