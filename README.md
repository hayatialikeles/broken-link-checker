# broken-link-checker-html

Fast broken link detection for HTML content. Detects broken URLs, broken images, and invalid href values.

[![npm version](https://badge.fury.io/js/broken-link-checker-html.svg)](https://www.npmjs.com/package/broken-link-checker-html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Fast parallel checking** - Check multiple URLs concurrently
- **Live page checking** - Fetch a URL and check all its links
- **HEAD + GET fallback** - Tries HEAD first, falls back to GET for better compatibility
- **Invalid href detection** - Finds malformed links like `href="click here"` instead of proper URLs
- **Safe domain whitelist** - Skip social media domains that often block automated requests
- **HTML cleaning** - Remove broken links while preserving content
- **Zero dependencies** - Uses native `fetch` API (Node.js 18+)
- **CLI & API** - Use from command line or as a library

## Installation

```bash
npm install broken-link-checker-html
```

Or use directly with npx:

```bash
npx broken-link-checker-html -f index.html
```

## CLI Usage

### Check a live page (fetch and scan all links)

```bash
broken-link-checker -p https://example.com/page
# or simply
broken-link-checker https://example.com/page
```

### Check if a single URL is broken

```bash
broken-link-checker -u https://example.com/page
```

### Check a local HTML file

```bash
broken-link-checker -f index.html
```

### Options

```
-u, --url <url>         Check if a single URL is broken
-p, --page <url>        Fetch a live page and check all its links
-f, --file <path>       Check HTML file for broken links
-t, --timeout <ms>      Request timeout (default: 5000)
-c, --concurrency <n>   Max parallel requests (default: 50)
-m, --method <method>   HTTP method: HEAD, GET, or auto (default: auto)
-o, --output <path>     Output results to JSON file
-q, --quiet             Only output errors
--no-invalid            Don't check for invalid hrefs
--json                  Output as JSON
-h, --help              Show help
-v, --version           Show version
```

### Examples

```bash
# Check all links on a live page
broken-link-checker -p https://example.com/blog

# Check with GET method only (some servers don't support HEAD)
broken-link-checker -p https://example.com -m GET

# Check HTML file and save results
broken-link-checker -f page.html -o results.json

# Output as JSON for piping
broken-link-checker -p https://example.com --json | jq '.brokenLinks'

# Check URL quietly (for CI/CD)
broken-link-checker -u https://example.com -q
```

## API Usage

### Find Broken Links

```javascript
import { findBrokenLinks } from 'broken-link-checker-html';

const html = `
  <html>
    <body>
      <a href="https://example.com/valid">Valid Link</a>
      <a href="https://example.com/broken-page">Broken Link</a>
      <a href="click here">Invalid HREF</a>
      <img src="https://example.com/missing.jpg" />
    </body>
  </html>
`;

const result = await findBrokenLinks(html, {
  timeout: 5000,
  concurrency: 50,
});

console.log(result);
// {
//   brokenLinks: [{ url: 'https://example.com/broken-page', ... }],
//   brokenImages: [{ url: 'https://example.com/missing.jpg', ... }],
//   invalidLinks: [{ url: 'click here', reason: 'invalid_href', ... }],
//   stats: {
//     totalLinks: 2,
//     totalImages: 1,
//     totalInvalidLinks: 1,
//     brokenLinksCount: 1,
//     brokenImagesCount: 1,
//   }
// }
```

### Check and Clean HTML

```javascript
import { checkAndClean } from 'broken-link-checker-html';

const result = await checkAndClean(html);

console.log(result.html);
// HTML with broken links removed (content preserved)

console.log(result.stats.cleaned);
// Number of items cleaned
```

### Check a Live Page

```javascript
import { checkPage } from 'broken-link-checker-html';

// Fetch page and check all its links
const result = await checkPage('https://example.com/blog', {
  timeout: 10000,
  concurrency: 50,
});

console.log(result.pageUrl);        // 'https://example.com/blog'
console.log(result.brokenLinks);    // Array of broken links
console.log(result.invalidLinks);   // Array of invalid hrefs
console.log(result.stats);          // Statistics
```

### Check a Single URL

```javascript
import { checkUrl } from 'broken-link-checker-html';

const isBroken = await checkUrl('https://example.com/page');
console.log(isBroken); // true or false

// With options
const isBroken2 = await checkUrl('https://example.com/page', {
  timeout: 5000,
  method: 'GET',  // 'HEAD', 'GET', or 'auto' (default)
});
```

### Extract URLs from HTML

```javascript
import { extractUrls } from 'broken-link-checker-html';

const { links, images, invalidLinks } = extractUrls(html);

console.log(links);
// [{ url: 'https://...', fullMatch: '<a href="...">...' }]

console.log(invalidLinks);
// [{ url: 'click here', fullMatch: '<a href="click here">...', reason: 'invalid_href' }]
```

### Custom Safe Domains

```javascript
import { findBrokenLinks, DEFAULT_SAFE_DOMAINS } from 'broken-link-checker-html';

// Add custom domains to skip
const customSafeDomains = [
  ...DEFAULT_SAFE_DOMAINS,
  'internal-tool.company.com',
  'cdn.example.com',
];

const result = await findBrokenLinks(html, {
  safeDomains: customSafeDomains,
});
```

## What is "Invalid HREF"?

Invalid HREFs are malformed link attributes that don't follow standard URL formats:

```html
<!-- Invalid: Plain text instead of URL -->
<a href="click here">Click Here</a>

<!-- Invalid: Spaces without encoding -->
<a href="my page">My Page</a>

<!-- Valid formats -->
<a href="https://example.com">Absolute URL</a>
<a href="/page">Root-relative</a>
<a href="#section">Anchor</a>
<a href="tel:+1234567890">Phone</a>
<a href="mailto:info@example.com">Email</a>
```

When a browser encounters `href="click here"`, it resolves it as a relative URL:
```
https://example.com/current-path/click%20here → 404 Not Found
```

This tool detects these invalid patterns before they cause 404 errors.

## Default Safe Domains

The following domains are skipped by default (they often block automated requests):

- facebook.com, instagram.com, twitter.com, x.com
- youtube.com, linkedin.com, tiktok.com, pinterest.com
- wa.me, whatsapp.com, t.me, telegram.org
- discord.com, discord.gg

## Requirements

- Node.js 18+ (uses native `fetch`)

## License

MIT License - see [LICENSE](LICENSE) file.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Built with ❤️ by [Hayati Ali Keles](https://github.com/hayatialikeles)
