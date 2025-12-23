/**
 * URL checking functionality
 */

import type {
  CheckUrlOptions,
  BatchCheckOptions,
  CheckedUrl,
  TypedUrlItem,
  FindBrokenLinksResult,
  CheckPageResult,
} from '../types/index.js';
import { DEFAULT_SAFE_DOMAINS, DEFAULT_OPTIONS, USER_AGENT } from '../constants/index.js';
import { extractUrls } from './extractor.js';

/**
 * Check if a domain is in the safe list
 * @param url - URL to check
 * @param safeDomains - List of safe domains
 * @returns true if domain is safe, false otherwise
 */
export function isSafeDomain(
  url: string,
  safeDomains: readonly string[] = DEFAULT_SAFE_DOMAINS
): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return safeDomains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Check if a single URL is broken
 * @param url - URL to check
 * @param options - Check options
 * @returns true if broken, false if OK
 */
export async function checkUrl(
  url: string,
  options: CheckUrlOptions = {}
): Promise<boolean> {
  const {
    timeout = DEFAULT_OPTIONS.timeout,
    safeDomains = DEFAULT_SAFE_DOMAINS,
    method = DEFAULT_OPTIONS.method,
  } = options;

  // Skip safe domains
  if (isSafeDomain(url, safeDomains)) {
    return false;
  }

  const makeRequest = async (httpMethod: string): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const resp = await fetch(url, {
        method: httpMethod,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return resp;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    // If method is 'auto', try HEAD first, fallback to GET
    if (method === 'auto' || method === 'HEAD') {
      const resp = await makeRequest('HEAD');

      // If HEAD returns 405 (Method Not Allowed), try GET
      if (resp.status === 405 && method === 'auto') {
        const getResp = await makeRequest('GET');
        return getResp.status >= 400;
      }

      return resp.status >= 400;
    } else {
      // Use GET directly
      const resp = await makeRequest('GET');
      return resp.status >= 400;
    }
  } catch {
    // If HEAD failed with network error, try GET as fallback
    if (method === 'auto') {
      try {
        const resp = await makeRequest('GET');
        return resp.status >= 400;
      } catch {
        return true; // Both failed = broken
      }
    }
    // Network error, timeout, or abort = broken
    return true;
  }
}

/**
 * Check multiple URLs in parallel
 * @param urls - URLs to check
 * @param options - Check options
 * @returns Array of URLs with their broken status
 */
export async function checkUrlsBatch(
  urls: TypedUrlItem[],
  options: BatchCheckOptions = {}
): Promise<CheckedUrl[]> {
  const {
    concurrency = DEFAULT_OPTIONS.concurrency,
    timeout = DEFAULT_OPTIONS.timeout,
    safeDomains = DEFAULT_SAFE_DOMAINS,
  } = options;

  const results: CheckedUrl[] = [];

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const isBroken = await checkUrl(item.url, { timeout, safeDomains });
        return { ...item, isBroken };
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({ ...batch[j], isBroken: true });
      }
    }
  }

  return results;
}

/**
 * Find all broken links in HTML content
 * @param html - HTML content to check
 * @param options - Check options
 * @returns Object containing broken links, images, invalid links, and stats
 */
export async function findBrokenLinks(
  html: string,
  options: BatchCheckOptions = {}
): Promise<FindBrokenLinksResult> {
  const { links, images, invalidLinks } = extractUrls(html);

  const allUrls: TypedUrlItem[] = [
    ...links.map(l => ({ ...l, type: 'link' as const })),
    ...images.map(i => ({ ...i, type: 'image' as const })),
  ];

  const results = await checkUrlsBatch(allUrls, options);

  const brokenLinks = results.filter(r => r.isBroken && r.type === 'link');
  const brokenImages = results.filter(r => r.isBroken && r.type === 'image');

  return {
    brokenLinks,
    brokenImages,
    invalidLinks,
    stats: {
      totalLinks: links.length,
      totalImages: images.length,
      totalInvalidLinks: invalidLinks.length,
      brokenLinksCount: brokenLinks.length,
      brokenImagesCount: brokenImages.length,
    },
  };
}

/**
 * Fetch a live page and check all its links
 * @param pageUrl - URL of the page to check
 * @param options - Check options
 * @returns Object containing page URL, HTML, broken items, and stats
 */
export async function checkPage(
  pageUrl: string,
  options: BatchCheckOptions = {}
): Promise<CheckPageResult> {
  const { timeout = 10000 } = options;

  // Fetch the page HTML
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let html: string;
  try {
    const resp = await fetch(pageUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    html = await resp.text();
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Failed to fetch page: ${(err as Error).message}`);
  }

  // Check all links in the fetched HTML
  const result = await findBrokenLinks(html, options);

  return {
    pageUrl,
    html,
    ...result,
  };
}
