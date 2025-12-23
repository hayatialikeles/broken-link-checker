/**
 * Type definitions for broken-link-checker-html
 */

/** Basic URL item extracted from HTML */
export interface UrlItem {
  url: string;
  fullMatch: string;
}

/** Invalid link with reason */
export interface InvalidLink extends UrlItem {
  reason: 'invalid_href';
}

/** URL after being checked for broken status */
export interface CheckedUrl extends UrlItem {
  isBroken: boolean;
  type: 'link' | 'image';
}

/** Result of extracting URLs from HTML */
export interface ExtractResult {
  links: UrlItem[];
  images: UrlItem[];
  invalidLinks: InvalidLink[];
}

/** Options for checking a single URL */
export interface CheckUrlOptions {
  /** Request timeout in ms (default: 5000) */
  timeout?: number;
  /** List of safe domains to skip */
  safeDomains?: readonly string[];
  /** HTTP method: 'HEAD', 'GET', or 'auto' (default: 'auto') */
  method?: 'HEAD' | 'GET' | 'auto';
}

/** Options for batch checking URLs */
export interface BatchCheckOptions extends CheckUrlOptions {
  /** Max parallel requests (default: 50) */
  concurrency?: number;
}

/** Statistics from checking HTML */
export interface CheckStats {
  totalLinks: number;
  totalImages: number;
  totalInvalidLinks: number;
  brokenLinksCount: number;
  brokenImagesCount: number;
}

/** Result of finding broken links */
export interface FindBrokenLinksResult {
  brokenLinks: CheckedUrl[];
  brokenImages: CheckedUrl[];
  invalidLinks: InvalidLink[];
  stats: CheckStats;
}

/** Result of checking and cleaning HTML */
export interface CheckAndCleanResult extends FindBrokenLinksResult {
  html: string;
  stats: CheckStats & {
    cleaned: number;
  };
}

/** Result of checking a live page */
export interface CheckPageResult extends FindBrokenLinksResult {
  pageUrl: string;
  html: string;
}

/** Internal type for URL with type annotation */
export interface TypedUrlItem extends UrlItem {
  type: 'link' | 'image';
}
