import {
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from '@google/generative-ai';

/**
 * The user agent used for making requests.
 */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

/**
 * The model used for generating text.
 */
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const GEMINI_SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: 'HARM_CATEGORY_CIVIC_INTEGRITY' as HarmCategory,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export { GEMINI_MODEL, GEMINI_SAFETY_SETTINGS, USER_AGENT };
