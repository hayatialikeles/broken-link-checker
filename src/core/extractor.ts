/**
 * URL extraction from HTML content
 */

import type { UrlItem, InvalidLink, ExtractResult } from '../types/index.js';
import { VALID_PREFIXES } from '../constants/index.js';

/**
 * Extract all URLs from HTML content
 * @param html - HTML content to parse
 * @returns Object containing links, images, and invalid links
 */
export function extractUrls(html: string): ExtractResult {
  const links: UrlItem[] = [];
  const images: UrlItem[] = [];
  const invalidLinks: InvalidLink[] = [];

  // Extract <a href="..."> links
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1].trim();
    const urlLower = url.toLowerCase();
    const hasValidPrefix = VALID_PREFIXES.some(prefix => urlLower.startsWith(prefix));

    if (urlLower.startsWith('http')) {
      links.push({ url, fullMatch: match[0] });
    } else if (!hasValidPrefix && url.length > 0) {
      // Invalid href (plain text, spaces, etc.)
      invalidLinks.push({ url, fullMatch: match[0], reason: 'invalid_href' });
    }
  }

  // Extract <img src="..."> images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1].trim();
    if (url.toLowerCase().startsWith('http')) {
      images.push({ url, fullMatch: match[0] });
    }
  }

  return { links, images, invalidLinks };
}

/**
 * Extract unique URLs (deduplicated)
 * @param html - HTML content to parse
 * @returns Object containing unique links, images, and invalid links
 */
export function extractUniqueUrls(html: string): ExtractResult {
  const result = extractUrls(html);

  const seenLinks = new Set<string>();
  const seenImages = new Set<string>();
  const seenInvalid = new Set<string>();

  return {
    links: result.links.filter(l => {
      if (seenLinks.has(l.url)) return false;
      seenLinks.add(l.url);
      return true;
    }),
    images: result.images.filter(i => {
      if (seenImages.has(i.url)) return false;
      seenImages.add(i.url);
      return true;
    }),
    invalidLinks: result.invalidLinks.filter(l => {
      if (seenInvalid.has(l.url)) return false;
      seenInvalid.add(l.url);
      return true;
    }),
  };
}
