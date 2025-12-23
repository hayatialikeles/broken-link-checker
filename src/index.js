/**
 * @lobsterlead/broken-link-checker
 * Fast broken link detection for HTML content
 */

// Default safe domains (social media, messaging apps)
const DEFAULT_SAFE_DOMAINS = [
  'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com',
  'twitter.com', 'www.twitter.com',
  'x.com', 'www.x.com',
  'youtube.com', 'www.youtube.com',
  'linkedin.com', 'www.linkedin.com',
  'tiktok.com', 'www.tiktok.com',
  'pinterest.com', 'www.pinterest.com',
  'wa.me', 'whatsapp.com', 'www.whatsapp.com',
  't.me', 'telegram.org',
  'discord.com', 'discord.gg',
];

// Valid URL prefixes
const VALID_PREFIXES = ['http://', 'https://', '/', '#', 'tel:', 'mailto:', 'javascript:', 'data:'];

/**
 * Check if a domain is in the safe list
 * @param {string} url - URL to check
 * @param {string[]} safeDomains - List of safe domains
 * @returns {boolean}
 */
function isSafeDomain(url, safeDomains = DEFAULT_SAFE_DOMAINS) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return safeDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

/**
 * Extract all URLs from HTML content
 * @param {string} html - HTML content to parse
 * @returns {{ links: Array, images: Array, invalidLinks: Array }}
 */
function extractUrls(html) {
  const links = [];
  const images = [];
  const invalidLinks = [];

  // Extract <a href="..."> links
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
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
 * Check if a single URL is broken
 * @param {string} url - URL to check
 * @param {Object} options - Options
 * @param {number} options.timeout - Request timeout in ms (default: 5000)
 * @param {string[]} options.safeDomains - List of safe domains to skip
 * @param {string} options.method - HTTP method: 'HEAD', 'GET', or 'auto' (default: 'auto')
 * @returns {Promise<boolean>} - true if broken, false if OK
 */
async function checkUrl(url, options = {}) {
  const { timeout = 5000, safeDomains = DEFAULT_SAFE_DOMAINS, method = 'auto' } = options;

  // Skip safe domains
  if (isSafeDomain(url, safeDomains)) {
    return false;
  }

  const makeRequest = async (httpMethod) => {
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

      // If HEAD returns 405 (Method Not Allowed) or fails, try GET
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
 * @param {Array<{url: string}>} urls - URLs to check
 * @param {Object} options - Options
 * @param {number} options.concurrency - Max parallel requests (default: 50)
 * @param {number} options.timeout - Request timeout in ms (default: 5000)
 * @param {string[]} options.safeDomains - List of safe domains to skip
 * @returns {Promise<Array<{url: string, isBroken: boolean}>>}
 */
async function checkUrlsBatch(urls, options = {}) {
  const { concurrency = 50, timeout = 5000, safeDomains = DEFAULT_SAFE_DOMAINS } = options;

  const results = [];

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
 * Remove broken links from HTML content
 * @param {string} html - HTML content
 * @param {Array<{url: string}>} brokenLinks - Broken links to remove
 * @param {Array<{url: string}>} brokenImages - Broken images to remove
 * @param {Array<{url: string}>} invalidLinks - Invalid links to remove
 * @returns {string} - Cleaned HTML
 */
function cleanBrokenUrls(html, brokenLinks = [], brokenImages = [], invalidLinks = []) {
  let cleaned = html;

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
 * Find all broken links in HTML content
 * @param {string} html - HTML content to check
 * @param {Object} options - Options
 * @param {number} options.concurrency - Max parallel requests (default: 50)
 * @param {number} options.timeout - Request timeout in ms (default: 5000)
 * @param {string[]} options.safeDomains - List of safe domains to skip
 * @returns {Promise<{brokenLinks: Array, brokenImages: Array, invalidLinks: Array, stats: Object}>}
 */
async function findBrokenLinks(html, options = {}) {
  const { links, images, invalidLinks } = extractUrls(html);

  const allUrls = [
    ...links.map(l => ({ ...l, type: 'link' })),
    ...images.map(i => ({ ...i, type: 'image' }))
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
    }
  };
}

/**
 * Check and clean broken links from HTML content
 * @param {string} html - HTML content to check and clean
 * @param {Object} options - Options
 * @returns {Promise<{html: string, brokenLinks: Array, brokenImages: Array, invalidLinks: Array, stats: Object}>}
 */
async function checkAndClean(html, options = {}) {
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
    }
  };
}

/**
 * Fetch a live page and check all its links
 * @param {string} pageUrl - URL of the page to check
 * @param {Object} options - Options
 * @param {number} options.timeout - Request timeout in ms (default: 5000)
 * @param {number} options.concurrency - Max parallel requests (default: 50)
 * @param {string[]} options.safeDomains - List of safe domains to skip
 * @returns {Promise<{pageUrl: string, html: string, brokenLinks: Array, brokenImages: Array, invalidLinks: Array, stats: Object}>}
 */
async function checkPage(pageUrl, options = {}) {
  const { timeout = 10000 } = options;

  // Fetch the page HTML
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let html;
  try {
    const resp = await fetch(pageUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrokenLinkChecker/1.0)',
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
    throw new Error(`Failed to fetch page: ${err.message}`);
  }

  // Check all links in the fetched HTML
  const result = await findBrokenLinks(html, options);

  return {
    pageUrl,
    html,
    ...result,
  };
}

// Export all functions
export {
  // Main functions
  findBrokenLinks,
  checkAndClean,
  checkPage,

  // Utility functions
  extractUrls,
  checkUrl,
  checkUrlsBatch,
  cleanBrokenUrls,
  isSafeDomain,

  // Constants
  DEFAULT_SAFE_DOMAINS,
  VALID_PREFIXES,
};

// Default export
export default {
  findBrokenLinks,
  checkAndClean,
  checkPage,
  extractUrls,
  checkUrl,
  checkUrlsBatch,
  cleanBrokenUrls,
  isSafeDomain,
  DEFAULT_SAFE_DOMAINS,
  VALID_PREFIXES,
};
