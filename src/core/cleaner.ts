/**
 * HTML cleaning functionality
 */

import type { BatchCheckOptions, CheckAndCleanResult } from '../types/index.js';
import { findBrokenLinks } from './checker.js';

/**
 * Escape special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove broken links from HTML content
 * @param html - HTML content
 * @param brokenLinks - Broken links to remove
 * @param brokenImages - Broken images to remove
 * @param invalidLinks - Invalid links to remove
 * @returns Cleaned HTML
 */
export function cleanBrokenUrls(
  html: string,
  brokenLinks: Array<{ url: string }> = [],
  brokenImages: Array<{ url: string }> = [],
  invalidLinks: Array<{ url: string }> = []
): string {
  let cleaned = html;

  // Remove broken links (keep inner content)
  for (const link of [...brokenLinks, ...invalidLinks]) {
    const aTagRegex = new RegExp(
      `<a[^>]*href=["']${escapeRegex(link.url)}["'][^>]*>(.*?)</a>`,
      'gi'
    );
    cleaned = cleaned.replace(aTagRegex, '$1');
  }

  // Remove broken images
  for (const img of brokenImages) {
    const imgTagRegex = new RegExp(
      `<img[^>]*src=["']${escapeRegex(img.url)}["'][^>]*>`,
      'gi'
    );
    cleaned = cleaned.replace(imgTagRegex, '');
  }

  return cleaned;
}

/**
 * Check and clean broken links from HTML content
 * @param html - HTML content to check and clean
 * @param options - Check options
 * @returns Object containing cleaned HTML, broken items, and stats
 */
export async function checkAndClean(
  html: string,
  options: BatchCheckOptions = {}
): Promise<CheckAndCleanResult> {
  const { brokenLinks, brokenImages, invalidLinks, stats } = await findBrokenLinks(html, options);

  const cleanedHtml = cleanBrokenUrls(html, brokenLinks, brokenImages, invalidLinks);

  return {
    html: cleanedHtml,
    brokenLinks,
    brokenImages,
    invalidLinks,
    stats: {
      ...stats,
      cleaned: brokenLinks.length + brokenImages.length + invalidLinks.length,
    },
  };
}
