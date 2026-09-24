const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PATHS, ensureDir, readJson, writeJson } = require('./state');

const API_BASE = 'https://commons.wikimedia.org/w/api.php';
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
// Wikimedia asks API clients to identify themselves; no key is required.
const USER_AGENT = 'PlanteriorImageAgent/1.0 (https://planterior.app; plant library curation)';
// Commons serves thumbnails at standard widths; 1280 is one of them.
const THUMB_WIDTH = 1280;

// Commons hosts free licenses only, but some (GFDL-only, unusual templates) are awkward
// to honour in an app. Accept public domain, CC0 and CC BY / CC BY-SA.
const ALLOWED_LICENSE = /^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]\d|attribution$)/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Commons files are catalogued by botanical name, so identity-bearing queries come first.
 * The category query catches files whose titles omit the binomial.
 */
function buildQueries(plant) {
  const scientific = plant.scientificName;
  return [
    `"${scientific}" filetype:bitmap`,
    `incategory:"${scientific}" filetype:bitmap`,
    `"${plant.name}" filetype:bitmap`,
  ];
}

function cacheFile(query) {
  return path.join(PATHS.searchCache, `${crypto.createHash('sha256').update(`wikimedia:v1:${query}`).digest('hex')}.json`);
}

function toCandidate(page, query) {
  const info = page.imageinfo?.[0];
  if (!info || info.mime !== 'image/jpeg') return null;
  const meta = info.extmetadata || {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!ALLOWED_LICENSE.test(license)) return null;
  const title = page.title.replace(/^File:/, '');
  return {
    source: 'wikimedia',
    sourceId: `wm-${page.pageid}`,
    title,
    description: `${title} ${stripHtml(meta.ImageDescription?.value)}`.slice(0, 300),
    width: info.width,
    height: info.height,
    downloadUrl: info.thumburl || info.url,
    pageUrl: info.descriptionurl,
    photographer: stripHtml(meta.Artist?.value).slice(0, 120) || 'Unknown author',
    photographerUrl: info.descriptionurl,
    license,
    licenseUrl: meta.LicenseUrl?.value || null,
    attributionRequired: meta.AttributionRequired?.value !== 'false',
    query,
  };
}

async function searchFiles(query, limit = 20) {
  const cached = readJson(cacheFile(query));
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.results;

  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2',
    generator: 'search', gsrnamespace: '6', gsrlimit: String(limit), gsrsearch: query,
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|AttributionRequired|ImageDescription',
  });
  const response = await fetch(`${API_BASE}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Wikimedia search failed: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`Wikimedia search failed: ${body.error.info || body.error.code}`);

  const pages = (body.query?.pages || []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const results = pages.map((page) => toCandidate(page, query)).filter(Boolean);
  ensureDir(PATHS.searchCache);
  writeJson(cacheFile(query), { fetchedAt: Date.now(), query, results });
  return results;
}

async function downloadFile(candidate, destination) {
  const response = await fetch(candidate.downloadUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  ensureDir(path.dirname(destination));
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('Download did not contain a JPEG');
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, destination);
  return destination;
}

module.exports = { ALLOWED_LICENSE, buildQueries, searchFiles, downloadFile, toCandidate, stripHtml, sleep };
