/**
 * broken-link-checker-html
 * Fast broken link detection for HTML content
 */

// Re-export types
export type {
  UrlItem,
  InvalidLink,
  CheckedUrl,
  ExtractResult,
  CheckUrlOptions,
  BatchCheckOptions,
  CheckStats,
  FindBrokenLinksResult,
  CheckAndCleanResult,
  CheckPageResult,
} from './types/index.js';

// Re-export constants
export {
  DEFAULT_SAFE_DOMAINS,
  VALID_PREFIXES,
  DEFAULT_OPTIONS,
  USER_AGENT,
} from './constants/index.js';

// Re-export core functions
export {
  // Extractor
  extractUrls,
  extractUniqueUrls,

  // Checker
  isSafeDomain,
  checkUrl,
  checkUrlsBatch,
  findBrokenLinks,
  checkPage,

  // Cleaner
  cleanBrokenUrls,
  checkAndClean,
} from './core/index.js';

// Default export
import {
  extractUrls,
  extractUniqueUrls,
  isSafeDomain,
  checkUrl,
  checkUrlsBatch,
  findBrokenLinks,
  checkPage,
  cleanBrokenUrls,
  checkAndClean,
} from './core/index.js';

import {
  DEFAULT_SAFE_DOMAINS,
  VALID_PREFIXES,
  DEFAULT_OPTIONS,
  USER_AGENT,
} from './constants/index.js';

export default {
  // Main functions
  findBrokenLinks,
  checkAndClean,
  checkPage,

  // Utility functions
  extractUrls,
  extractUniqueUrls,
  checkUrl,
  checkUrlsBatch,
  cleanBrokenUrls,
  isSafeDomain,

  // Constants
  DEFAULT_SAFE_DOMAINS,
  VALID_PREFIXES,
  DEFAULT_OPTIONS,
  USER_AGENT,
};
