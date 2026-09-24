const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadEnv } = require('./env');
const { PATHS, ensureDir, readJson, writeJson } = require('./state');

const API_BASE = 'https://api.unsplash.com';
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

let remainingRequests = null;

function getAccessKey() {
  const key = loadEnv().UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY missing from .env.local');
  return key;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Queries biased toward a single specimen rather than a styled room or a shop shelf.
 * All strategies contribute to the shortlist; search text is not species evidence.
 */
function buildQueries(plant) {
  const scientific = plant.scientificName;
  const common = plant.name;
  return [
    scientific,
    `${common} potted plant`,
    `${scientific} whole plant`,
    `${common} isolated`,
  ];
}

function cacheFile(query, perPage) {
  return path.join(PATHS.searchCache, `${crypto.createHash('sha256').update(`v2:${perPage}:${query}`).digest('hex')}.json`);
}

function imageUrl(raw) {
  const url = new URL(raw);
  for (const [key, value] of Object.entries({ w: '1200', fit: 'max', fm: 'jpg', q: '80' })) url.searchParams.set(key, value);
  return url.toString();
}

async function searchPhotos(query, perPage = 12) {
  const cached = readJson(cacheFile(query, perPage));
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.results;

  const url = `${API_BASE}/search/photos?query=${encodeURIComponent(query)}`
    + `&per_page=${perPage}&content_filter=high`;

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${getAccessKey()}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(30000),
  });

  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining !== null) remainingRequests = Number(remaining);

  if (response.status === 429 || (response.status === 403 && remaining === '0')) {
    throw Object.assign(new Error('Unsplash rate limit reached (demo apps get 50 requests/hour). Re-run later; cached results are kept.'), { rateLimited: true });
  }
  if (!response.ok) {
    throw new Error(`Unsplash search failed: HTTP ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const results = (body.results || []).map((photo) => ({
    unsplashId: photo.id,
    description: photo.description || photo.alt_description || '',
    width: photo.width,
    height: photo.height,
    downloadUrl: imageUrl(photo.urls.raw),
    downloadLocation: photo.links.download_location,
    pageUrl: photo.links.html,
    photographer: photo.user.name,
    photographerUrl: photo.user.links.html,
    query,
  }));

  ensureDir(PATHS.searchCache);
  writeJson(cacheFile(query, perPage), { fetchedAt: Date.now(), query, results });
  return results;
}

async function downloadPhoto(candidate, destination) {
  const response = await fetch(candidate.downloadUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  ensureDir(path.dirname(destination));
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('Download did not contain a JPEG');
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, destination);
  return destination;
}

/** Unsplash API terms require pinging download_location when a photo is actually used. */
async function reportDownload(candidate) {
  try {
    const response = await fetch(candidate.downloadLocation, {
      headers: { Authorization: `Client-ID ${getAccessKey()}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(30000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const getRemainingRequests = () => remainingRequests;

module.exports = { buildQueries, searchPhotos, downloadPhoto, reportDownload, getRemainingRequests, sleep, imageUrl };
