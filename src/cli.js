#!/usr/bin/env node
/**
 * broken-link-checker-html CLI
 * Check URLs or HTML files for broken links
 */

import fs from 'fs';
import path from 'path';
import { findBrokenLinks, checkUrl, checkPage, extractUrls } from './index.js';

const VERSION = '1.0.0';

function printHelp() {
  console.log(`
broken-link-checker-html v${VERSION}

Usage:
  broken-link-checker [options] <url|file>

Options:
  -u, --url <url>         Check if a single URL is broken
  -p, --page <url>        Fetch a live page and check all its links
  -f, --file <path>       Check HTML file for broken links
  -t, --timeout <ms>      Request timeout (default: 5000)
  -c, --concurrency <n>   Max parallel requests (default: 50)
  -m, --method <method>   HTTP method: HEAD, GET, or auto (default: auto)
  -o, --output <path>     Output results to JSON file
  -q, --quiet             Only output errors
  --no-invalid            Don't check for invalid hrefs
  --no-live               Extract URLs only, don't check if broken
  --extract-only          Same as --no-live
  --json                  Output as JSON
  -h, --help              Show this help
  -v, --version           Show version

Examples:
  broken-link-checker -u https://example.com/page     # Check single URL
  broken-link-checker -p https://example.com/page     # Check all links on page
  broken-link-checker -f index.html                   # Check local HTML file
  broken-link-checker -f index.html --extract-only    # Extract URLs without checking
  broken-link-checker -p https://example.com --json   # Output as JSON
`);
}

function parseArgs(args) {
  const options = {
    url: null,
    page: null,
    file: null,
    timeout: 5000,
    concurrency: 50,
    method: 'auto',
    output: null,
    quiet: false,
    json: false,
    checkInvalid: true,
    liveCheck: true,  // Canlı URL kontrolü (varsayılan: açık)
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '-u':
      case '--url':
        options.url = next;
        i++;
        break;
      case '-p':
      case '--page':
        options.page = next;
        i++;
        break;
      case '-f':
      case '--file':
        options.file = next;
        i++;
        break;
      case '-t':
      case '--timeout':
        options.timeout = parseInt(next);
        i++;
        break;
      case '-c':
      case '--concurrency':
        options.concurrency = parseInt(next);
        i++;
        break;
      case '-m':
      case '--method':
        options.method = next.toUpperCase();
        i++;
        break;
      case '-o':
      case '--output':
        options.output = next;
        i++;
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--no-invalid':
        options.checkInvalid = false;
        break;
      case '--no-live':
      case '--extract-only':
        options.liveCheck = false;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      case '-v':
      case '--version':
        console.log(VERSION);
        process.exit(0);
      default:
        // Positional argument - could be URL or file
        if (!arg.startsWith('-')) {
          if (arg.startsWith('http')) {
            options.page = arg; // Default to page check for URLs
          } else {
            options.file = arg;
          }
        }
    }
  }

  return options;
}

async function checkSingleUrl(url, options) {
  const { quiet, json, timeout, method } = options;

  if (!quiet) console.log(`Checking: ${url} (method: ${method})`);

  const isBroken = await checkUrl(url, { timeout, method });

  if (json) {
    console.log(JSON.stringify({ url, broken: isBroken }));
  } else {
    if (isBroken) {
      console.log(`❌ BROKEN: ${url}`);
      process.exit(1);
    } else {
      console.log(`✅ OK: ${url}`);
      process.exit(0);
    }
  }
}

async function checkLivePage(pageUrl, options) {
  const { quiet, json, output, timeout, concurrency, checkInvalid } = options;

  if (!quiet) {
    console.log(`Fetching: ${pageUrl}`);
    console.log(`Timeout: ${timeout}ms | Concurrency: ${concurrency}`);
    console.log('');
  }

  const result = await checkPage(pageUrl, { timeout, concurrency });

  const { brokenLinks, brokenImages, invalidLinks, stats } = result;

  // Build output
  const outputData = {
    pageUrl,
    stats,
    brokenLinks: brokenLinks.map(l => l.url),
    brokenImages: brokenImages.map(i => i.url),
    invalidLinks: checkInvalid ? invalidLinks.map(l => l.url) : [],
  };

  if (json) {
    console.log(JSON.stringify(outputData, null, 2));
  } else {
    // Print stats
    console.log(`Found: ${stats.totalLinks} links, ${stats.totalImages} images, ${stats.totalInvalidLinks} invalid hrefs`);
    console.log('');

    // Print broken links
    if (brokenLinks.length > 0) {
      console.log('❌ Broken Links:');
      brokenLinks.forEach(l => console.log(`   ${l.url}`));
      console.log('');
    }

    // Print broken images
    if (brokenImages.length > 0) {
      console.log('❌ Broken Images:');
      brokenImages.forEach(i => console.log(`   ${i.url}`));
      console.log('');
    }

    // Print invalid hrefs
    if (checkInvalid && invalidLinks.length > 0) {
      console.log('⚠️  Invalid HREFs:');
      invalidLinks.forEach(l => console.log(`   "${l.url}"`));
      console.log('');
    }

    // Summary
    const totalBroken = brokenLinks.length + brokenImages.length + (checkInvalid ? invalidLinks.length : 0);
    if (totalBroken === 0) {
      console.log('✅ No broken links found!');
    } else {
      console.log(`Total issues: ${totalBroken}`);
    }
  }

  // Save to file if requested
  if (output) {
    fs.writeFileSync(output, JSON.stringify(outputData, null, 2));
    if (!quiet && !json) {
      console.log(`\nResults saved to: ${output}`);
    }
  }

  // Exit with error if broken links found
  const totalBroken = brokenLinks.length + brokenImages.length + (checkInvalid ? invalidLinks.length : 0);
  process.exit(totalBroken > 0 ? 1 : 0);
}

async function checkHtmlFile(filePath, options) {
  const { quiet, json, output, timeout, concurrency, checkInvalid, liveCheck } = options;

  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }

  const html = fs.readFileSync(absolutePath, 'utf-8');

  if (!quiet) {
    console.log(`Checking: ${absolutePath}`);
    console.log(`Live check: ${liveCheck ? 'ON' : 'OFF'} | Timeout: ${timeout}ms | Concurrency: ${concurrency}`);
    console.log('');
  }

  let brokenLinks = [];
  let brokenImages = [];
  let invalidLinks = [];
  let stats = {};

  if (liveCheck) {
    // Canlı kontrol: URL'leri çıkar ve HTTP ile kontrol et
    const result = await findBrokenLinks(html, { timeout, concurrency });
    brokenLinks = result.brokenLinks;
    brokenImages = result.brokenImages;
    invalidLinks = result.invalidLinks;
    stats = result.stats;
  } else {
    // Sadece çıkar: HTTP kontrolü yapma
    const extracted = extractUrls(html);
    invalidLinks = extracted.invalidLinks;
    stats = {
      totalLinks: extracted.links.length,
      totalImages: extracted.images.length,
      totalInvalidLinks: extracted.invalidLinks.length,
      brokenLinksCount: 0,
      brokenImagesCount: 0,
    };
    // Extract only modunda tüm linkleri göster
    brokenLinks = extracted.links;
    brokenImages = extracted.images;
  }

  // Build output
  const outputData = {
    file: absolutePath,
    mode: liveCheck ? 'live' : 'extract',
    stats,
    ...(liveCheck ? {
      brokenLinks: brokenLinks.map(l => l.url),
      brokenImages: brokenImages.map(i => i.url),
    } : {
      links: brokenLinks.map(l => l.url),
      images: brokenImages.map(i => i.url),
    }),
    invalidLinks: checkInvalid ? invalidLinks.map(l => l.url) : [],
  };

  if (json) {
    console.log(JSON.stringify(outputData, null, 2));
  } else {
    // Print stats
    console.log(`Found: ${stats.totalLinks} links, ${stats.totalImages} images, ${stats.totalInvalidLinks} invalid hrefs`);
    console.log('');

    if (liveCheck) {
      // Live mode: show broken items
      if (brokenLinks.length > 0) {
        console.log('❌ Broken Links:');
        brokenLinks.forEach(l => console.log(`   ${l.url}`));
        console.log('');
      }

      if (brokenImages.length > 0) {
        console.log('❌ Broken Images:');
        brokenImages.forEach(i => console.log(`   ${i.url}`));
        console.log('');
      }
    } else {
      // Extract mode: show all items
      if (brokenLinks.length > 0) {
        console.log('🔗 All Links:');
        brokenLinks.forEach(l => console.log(`   ${l.url}`));
        console.log('');
      }

      if (brokenImages.length > 0) {
        console.log('🖼️  All Images:');
        brokenImages.forEach(i => console.log(`   ${i.url}`));
        console.log('');
      }
    }

    // Print invalid hrefs
    if (checkInvalid && invalidLinks.length > 0) {
      console.log('⚠️  Invalid HREFs:');
      invalidLinks.forEach(l => console.log(`   "${l.url}"`));
      console.log('');
    }

    // Summary
    if (liveCheck) {
      const totalBroken = brokenLinks.length + brokenImages.length + (checkInvalid ? invalidLinks.length : 0);
      if (totalBroken === 0) {
        console.log('✅ No broken links found!');
      } else {
        console.log(`Total issues: ${totalBroken}`);
      }
    } else {
      console.log(`Total extracted: ${brokenLinks.length} links, ${brokenImages.length} images`);
    }
  }

  // Save to file if requested
  if (output) {
    fs.writeFileSync(output, JSON.stringify(outputData, null, 2));
    if (!quiet && !json) {
      console.log(`\nResults saved to: ${output}`);
    }
  }

  // Exit code
  if (liveCheck) {
    const totalBroken = brokenLinks.length + brokenImages.length + (checkInvalid ? invalidLinks.length : 0);
    process.exit(totalBroken > 0 ? 1 : 0);
  } else {
    // Extract mode always succeeds
    process.exit(0);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (options.url) {
    await checkSingleUrl(options.url, options);
  } else if (options.page) {
    await checkLivePage(options.page, options);
  } else if (options.file) {
    await checkHtmlFile(options.file, options);
  } else {
    console.error('Error: Please provide a URL (-u), page (-p), or file (-f) to check');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
