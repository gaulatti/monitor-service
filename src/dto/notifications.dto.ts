/**
 * Represents the payload structure for a notification.
 *
 * @property id - Unique identifier for the notification.
 * @property content - The main content or message of the notification.
 * @property source - The origin or source of the notification.
 * @property uri - The URI associated with the notification.
 * @property relevance - A numeric value indicating the relevance or importance of the notification.
 * @property lang - The language code of the notification content.
 * @property hash - A hash value for deduplication or integrity checks.
 * @property author - The author's unique identifier or reference.
 * @property author_id - The unique ID of the author.
 * @property author_name - The display name of the author.
 * @property author_handle - The handle or username of the author.
 * @property author_avatar - URL to the author's avatar image.
 * @property media - An array of media URLs associated with the notification.
 * @property linkPreview - A URL or data for a link preview.
 * @property original - (Optional) The original content or reference, if applicable.
 * @property posted_at - ISO timestamp when the notification was posted.
 * @property received_at - ISO timestamp when the notification was received.
 * @property categories - An array of category strings classifying the notification.
 */
export interface NotificationPayload {
  id: string;
  content: string;
  source: string;
  uri: string;
  relevance: number;
  lang: string;
  hash: string;
  author: string;
  author_id: string;
  author_name: string;
  author_handle: string;
  author_avatar: string;
  media: string[];
  linkPreview: string;
  original?: string;
  posted_at: string;
  received_at: string;
  categories: string[];
  type: 'POST' | 'EVENT';
}
