import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  extractUrls,
  isSafeDomain,
  cleanBrokenUrls,
  DEFAULT_SAFE_DOMAINS,
  VALID_PREFIXES,
} from '../dist/index.js';

describe('extractUrls', () => {
  test('extracts HTTP links', () => {
    const html = '<a href="https://example.com/page">Link</a>';
    const { links, images, invalidLinks } = extractUrls(html);

    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].url, 'https://example.com/page');
    assert.strictEqual(images.length, 0);
    assert.strictEqual(invalidLinks.length, 0);
  });

  test('extracts images', () => {
    const html = '<img src="https://example.com/image.jpg" />';
    const { links, images, invalidLinks } = extractUrls(html);

    assert.strictEqual(links.length, 0);
    assert.strictEqual(images.length, 1);
    assert.strictEqual(images[0].url, 'https://example.com/image.jpg');
  });

  test('detects invalid hrefs', () => {
    const html = '<a href="click here">Click Here</a>';
    const { links, images, invalidLinks } = extractUrls(html);

    assert.strictEqual(links.length, 0);
    assert.strictEqual(invalidLinks.length, 1);
    assert.strictEqual(invalidLinks[0].url, 'click here');
    assert.strictEqual(invalidLinks[0].reason, 'invalid_href');
  });

  test('ignores relative URLs', () => {
    const html = `
      <a href="/page">Relative</a>
      <a href="#section">Anchor</a>
      <a href="tel:+1234567890">Phone</a>
      <a href="mailto:test@example.com">Email</a>
    `;
    const { links, invalidLinks } = extractUrls(html);

    assert.strictEqual(links.length, 0);
    assert.strictEqual(invalidLinks.length, 0);
  });

  test('extracts multiple URLs', () => {
    const html = `
      <a href="https://example.com/1">Link 1</a>
      <a href="https://example.com/2">Link 2</a>
      <img src="https://example.com/img1.jpg" />
      <img src="https://example.com/img2.jpg" />
      <a href="invalid link">Invalid</a>
    `;
    const { links, images, invalidLinks } = extractUrls(html);

    assert.strictEqual(links.length, 2);
    assert.strictEqual(images.length, 2);
    assert.strictEqual(invalidLinks.length, 1);
  });
});

describe('isSafeDomain', () => {
  test('returns true for safe domains', () => {
    assert.strictEqual(isSafeDomain('https://facebook.com/page'), true);
    assert.strictEqual(isSafeDomain('https://www.instagram.com/user'), true);
    assert.strictEqual(isSafeDomain('https://twitter.com/status'), true);
    assert.strictEqual(isSafeDomain('https://wa.me/1234567890'), true);
  });

  test('returns false for non-safe domains', () => {
    assert.strictEqual(isSafeDomain('https://example.com'), false);
    assert.strictEqual(isSafeDomain('https://google.com'), false);
    assert.strictEqual(isSafeDomain('https://my-site.com'), false);
  });

  test('returns false for invalid URLs', () => {
    assert.strictEqual(isSafeDomain('not a url'), false);
    assert.strictEqual(isSafeDomain(''), false);
  });

  test('supports custom safe domains', () => {
    const customDomains = ['custom.com'];
    assert.strictEqual(isSafeDomain('https://custom.com/page', customDomains), true);
    assert.strictEqual(isSafeDomain('https://facebook.com/page', customDomains), false);
  });
});

describe('cleanBrokenUrls', () => {
  test('removes broken links but keeps content', () => {
    const html = '<p>Before <a href="https://broken.com">Link Text</a> After</p>';
    const brokenLinks = [{ url: 'https://broken.com' }];

    const cleaned = cleanBrokenUrls(html, brokenLinks, [], []);

    assert.strictEqual(cleaned, '<p>Before Link Text After</p>');
  });

  test('removes broken images', () => {
    const html = '<p>Before <img src="https://broken.com/img.jpg" /> After</p>';
    const brokenImages = [{ url: 'https://broken.com/img.jpg' }];

    const cleaned = cleanBrokenUrls(html, [], brokenImages, []);

    assert.strictEqual(cleaned, '<p>Before  After</p>');
  });

  test('removes invalid hrefs', () => {
    const html = '<p>Before <a href="click here">Link Text</a> After</p>';
    const invalidLinks = [{ url: 'click here' }];

    const cleaned = cleanBrokenUrls(html, [], [], invalidLinks);

    assert.strictEqual(cleaned, '<p>Before Link Text After</p>');
  });

  test('handles special regex characters in URLs', () => {
    const html = '<a href="https://example.com/page?id=1&name=test">Link</a>';
    const brokenLinks = [{ url: 'https://example.com/page?id=1&name=test' }];

    const cleaned = cleanBrokenUrls(html, brokenLinks, [], []);

    assert.strictEqual(cleaned, 'Link');
  });
});

describe('constants', () => {
  test('DEFAULT_SAFE_DOMAINS contains expected domains', () => {
    assert.ok(DEFAULT_SAFE_DOMAINS.includes('facebook.com'));
    assert.ok(DEFAULT_SAFE_DOMAINS.includes('instagram.com'));
    assert.ok(DEFAULT_SAFE_DOMAINS.includes('twitter.com'));
    assert.ok(DEFAULT_SAFE_DOMAINS.includes('youtube.com'));
  });

  test('VALID_PREFIXES contains expected prefixes', () => {
    assert.ok(VALID_PREFIXES.includes('http://'));
    assert.ok(VALID_PREFIXES.includes('https://'));
    assert.ok(VALID_PREFIXES.includes('/'));
    assert.ok(VALID_PREFIXES.includes('#'));
    assert.ok(VALID_PREFIXES.includes('mailto:'));
    assert.ok(VALID_PREFIXES.includes('tel:'));
  });
});

// ============================================
// EDGE CASE TESTS
// ============================================

describe('extractUrls - Edge Cases', () => {
  test('handles empty HTML', () => {
    const { links, images, invalidLinks } = extractUrls('');
    assert.strictEqual(links.length, 0);
    assert.strictEqual(images.length, 0);
    assert.strictEqual(invalidLinks.length, 0);
  });

  test('handles HTML with no links or images', () => {
    const html = '<html><body><p>Just text</p></body></html>';
    const { links, images, invalidLinks } = extractUrls(html);
    assert.strictEqual(links.length, 0);
    assert.strictEqual(images.length, 0);
    assert.strictEqual(invalidLinks.length, 0);
  });

  test('handles empty href attribute', () => {
    const html = '<a href="">Empty</a>';
    const { links, invalidLinks } = extractUrls(html);
    assert.strictEqual(links.length, 0);
    assert.strictEqual(invalidLinks.length, 0); // Empty is not invalid, just ignored
  });

  test('handles whitespace-only href', () => {
    const html = '<a href="   ">Whitespace</a>';
    const { links, invalidLinks } = extractUrls(html);
    assert.strictEqual(links.length, 0);
    assert.strictEqual(invalidLinks.length, 0); // Trimmed to empty
  });

  test('handles URLs with special characters', () => {
    const html = '<a href="https://example.com/page?foo=bar&baz=qux#section">Link</a>';
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].url, 'https://example.com/page?foo=bar&baz=qux#section');
  });

  test('handles URLs with encoded characters', () => {
    const html = '<a href="https://example.com/path%20with%20spaces">Link</a>';
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].url, 'https://example.com/path%20with%20spaces');
  });

  test('handles Unicode URLs', () => {
    const html = '<a href="https://example.com/путь">Russian</a>';
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].url, 'https://example.com/путь');
  });

  test('handles Turkish characters in invalid hrefs', () => {
    const html = '<a href="kırık link">Turkish</a>';
    const { invalidLinks } = extractUrls(html);
    assert.strictEqual(invalidLinks.length, 1);
    assert.strictEqual(invalidLinks[0].url, 'kırık link');
  });

  test('handles single quotes in href', () => {
    const html = "<a href='https://example.com'>Single quotes</a>";
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
  });

  test('handles mixed quote styles', () => {
    const html = `
      <a href="https://example.com/1">Double</a>
      <a href='https://example.com/2'>Single</a>
    `;
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 2);
  });

  test('handles links with extra attributes', () => {
    const html = '<a class="btn" href="https://example.com" target="_blank" rel="noopener">Link</a>';
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].url, 'https://example.com');
  });

  test('handles self-closing img tags', () => {
    const html = '<img src="https://example.com/img.jpg"/>';
    const { images } = extractUrls(html);
    assert.strictEqual(images.length, 1);
  });

  test('handles img without self-closing', () => {
    const html = '<img src="https://example.com/img.jpg">';
    const { images } = extractUrls(html);
    assert.strictEqual(images.length, 1);
  });

  test('handles data: URLs (should ignore)', () => {
    const html = '<a href="data:text/html,<h1>Test</h1>">Data URL</a>';
    const { links, invalidLinks } = extractUrls(html);
    assert.strictEqual(links.length, 0);
    assert.strictEqual(invalidLinks.length, 0);
  });

  test('handles javascript: URLs (should ignore)', () => {
    const html = '<a href="javascript:void(0)">JS Link</a>';
    const { links, invalidLinks } = extractUrls(html);
    assert.strictEqual(links.length, 0);
    assert.strictEqual(invalidLinks.length, 0);
  });

  test('handles multiple spaces in invalid href', () => {
    const html = '<a href="click   here   now">Spaces</a>';
    const { invalidLinks } = extractUrls(html);
    assert.strictEqual(invalidLinks.length, 1);
    assert.strictEqual(invalidLinks[0].url, 'click   here   now');
  });

  test('handles newlines in HTML', () => {
    const html = `<a
      href="https://example.com"
      class="link"
    >Link</a>`;
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
  });

  test('handles duplicate URLs', () => {
    const html = `
      <a href="https://example.com">Link 1</a>
      <a href="https://example.com">Link 2</a>
    `;
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 2); // Both should be extracted
  });

  test('handles very long URLs', () => {
    const longPath = 'a'.repeat(2000);
    const html = `<a href="https://example.com/${longPath}">Long</a>`;
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
    assert.ok(links[0].url.length > 2000);
  });

  test('handles HTTP (not HTTPS) URLs', () => {
    const html = '<a href="http://example.com">HTTP</a>';
    const { links } = extractUrls(html);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].url, 'http://example.com');
  });

  test('case insensitive prefix detection', () => {
    const html = `
      <a href="HTTP://example.com">HTTP</a>
      <a href="HTTPS://example.com">HTTPS</a>
      <a href="MAILTO:test@test.com">Mail</a>
    `;
    const { links, invalidLinks } = extractUrls(html);
    // HTTP/HTTPS should be extracted, MAILTO should be ignored
    assert.strictEqual(links.length, 2);
    assert.strictEqual(invalidLinks.length, 0);
  });
});

describe('isSafeDomain - Edge Cases', () => {
  test('handles subdomains of safe domains', () => {
    assert.strictEqual(isSafeDomain('https://m.facebook.com/page'), true);
    assert.strictEqual(isSafeDomain('https://api.twitter.com/status'), true);
    assert.strictEqual(isSafeDomain('https://business.instagram.com'), true);
  });

  test('handles URLs with ports', () => {
    assert.strictEqual(isSafeDomain('https://facebook.com:443/page'), true);
    assert.strictEqual(isSafeDomain('https://example.com:8080/page'), false);
  });

  test('handles URLs with auth', () => {
    assert.strictEqual(isSafeDomain('https://user:pass@facebook.com/page'), true);
  });

  test('handles empty string', () => {
    assert.strictEqual(isSafeDomain(''), false);
  });

  test('handles null-like values', () => {
    assert.strictEqual(isSafeDomain('null'), false);
    assert.strictEqual(isSafeDomain('undefined'), false);
  });

  test('handles similar but not safe domains', () => {
    assert.strictEqual(isSafeDomain('https://facebookk.com'), false);
    assert.strictEqual(isSafeDomain('https://facebook.com.evil.com'), false);
    assert.strictEqual(isSafeDomain('https://notfacebook.com'), false);
  });
});

describe('cleanBrokenUrls - Edge Cases', () => {
  test('handles empty arrays', () => {
    const html = '<a href="https://example.com">Link</a>';
    const cleaned = cleanBrokenUrls(html, [], [], []);
    assert.strictEqual(cleaned, html);
  });

  test('handles multiple broken links', () => {
    const html = '<a href="https://broken1.com">1</a> <a href="https://broken2.com">2</a>';
    const brokenLinks = [
      { url: 'https://broken1.com' },
      { url: 'https://broken2.com' }
    ];
    const cleaned = cleanBrokenUrls(html, brokenLinks, [], []);
    assert.strictEqual(cleaned, '1 2');
  });

  test('handles nested elements in links', () => {
    const html = '<a href="https://broken.com"><span>Nested</span></a>';
    const brokenLinks = [{ url: 'https://broken.com' }];
    const cleaned = cleanBrokenUrls(html, brokenLinks, [], []);
    assert.strictEqual(cleaned, '<span>Nested</span>');
  });

  test('handles URLs with parentheses', () => {
    const html = '<a href="https://example.com/page_(1)">Link</a>';
    const brokenLinks = [{ url: 'https://example.com/page_(1)' }];
    const cleaned = cleanBrokenUrls(html, brokenLinks, [], []);
    assert.strictEqual(cleaned, 'Link');
  });

  test('handles URLs with brackets', () => {
    const html = '<a href="https://example.com/page[1]">Link</a>';
    const brokenLinks = [{ url: 'https://example.com/page[1]' }];
    const cleaned = cleanBrokenUrls(html, brokenLinks, [], []);
    assert.strictEqual(cleaned, 'Link');
  });

  test('preserves other links when cleaning broken ones', () => {
    const html = '<a href="https://good.com">Good</a> <a href="https://broken.com">Bad</a>';
    const brokenLinks = [{ url: 'https://broken.com' }];
    const cleaned = cleanBrokenUrls(html, brokenLinks, [], []);
    assert.strictEqual(cleaned, '<a href="https://good.com">Good</a> Bad');
  });

  test('handles image with multiple attributes', () => {
    const html = '<img src="https://broken.com/img.jpg" alt="Test" width="100" />';
    const brokenImages = [{ url: 'https://broken.com/img.jpg' }];
    const cleaned = cleanBrokenUrls(html, [], brokenImages, []);
    assert.strictEqual(cleaned, '');
  });

  test('handles mixed broken and invalid links', () => {
    const html = '<a href="https://broken.com">Broken</a> <a href="invalid text">Invalid</a>';
    const brokenLinks = [{ url: 'https://broken.com' }];
    const invalidLinks = [{ url: 'invalid text' }];
    const cleaned = cleanBrokenUrls(html, brokenLinks, [], invalidLinks);
    assert.strictEqual(cleaned, 'Broken Invalid');
  });
});
