/**
 * Constants for broken-link-checker-html
 */

/**
 * Default safe domains (social media, messaging apps)
 * These domains often block automated requests, so we skip them by default
 */
export const DEFAULT_SAFE_DOMAINS: readonly string[] = [
  // Facebook
  'facebook.com',
  'www.facebook.com',

  // Instagram
  'instagram.com',
  'www.instagram.com',

  // Twitter/X
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',

  // YouTube
  'youtube.com',
  'www.youtube.com',

  // LinkedIn
  'linkedin.com',
  'www.linkedin.com',

  // TikTok
  'tiktok.com',
  'www.tiktok.com',

  // Pinterest
  'pinterest.com',
  'www.pinterest.com',

  // WhatsApp
  'wa.me',
  'whatsapp.com',
  'www.whatsapp.com',

  // Telegram
  't.me',
  'telegram.org',

  // Discord
  'discord.com',
  'discord.gg',
] as const;

/**
 * Valid URL prefixes
 * URLs starting with these prefixes are considered valid (not broken hrefs)
 */
export const VALID_PREFIXES: readonly string[] = [
  'http://',
  'https://',
  '/',
  '#',
  'tel:',
  'mailto:',
  'javascript:',
  'data:',
] as const;

/**
 * Default options
 */
export const DEFAULT_OPTIONS = {
  timeout: 5000,
  concurrency: 50,
  method: 'auto' as const,
} as const;

/**
 * User agent for requests
 */
export const USER_AGENT = 'Mozilla/5.0 (compatible; BrokenLinkChecker/1.0)';
