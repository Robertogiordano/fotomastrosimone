#!/usr/bin/env node
// Sync YouTube playlist -> data/videos.json (used by the video carousel on the home page).
// Node 20+, zero npm dependencies, no API key: reads the public playlist RSS feed.
// Note: the feed lists at most 15 videos (YouTube limit).
//
// Usage:
//   node scripts/sync-videos.mjs
//   node scripts/sync-videos.mjs --fixture path/to/feed.xml

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = resolve(ROOT, 'data/galleries.config.json');
const OUT_PATH = resolve(ROOT, 'data/videos.json');

const args = process.argv.slice(2);
const fixtureIdx = args.indexOf('--fixture');
const fixture = fixtureIdx >= 0 ? args[fixtureIdx + 1] : null;

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

function parseFeed(xml) {
  const entries = xml.split('<entry>').slice(1);
  return entries
    .map((entry) => {
      const id = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(entry)?.[1];
      const title = /<title>([^<]*)<\/title>/.exec(entry)?.[1] ?? '';
      const published = /<published>([^<]+)<\/published>/.exec(entry)?.[1] ?? null;
      const description = /<media:description>([^<]*)<\/media:description>/.exec(entry)?.[1] ?? '';
      return id ? { id, title: decode(title), description: decode(description), published } : null;
    })
    .filter(Boolean);
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const playlistId = config.youtubePlaylist;
  if (!playlistId) throw new Error('Missing "youtubePlaylist" in data/galleries.config.json');

  let xml;
  if (fixture) {
    xml = await readFile(resolve(process.cwd(), fixture), 'utf8');
  } else {
    const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'fotomastrosimone-site-sync' } });
    if (!res.ok) throw new Error(`YouTube feed: HTTP ${res.status}`);
    xml = await res.text();
  }

  const videos = parseFeed(xml);
  if (!videos.length) {
    console.warn('Feed has no videos: keeping the existing data/videos.json.');
    return;
  }

  const data = { playlistId, videos };
  const next = JSON.stringify(data, null, 2) + '\n';
  let prev = null;
  try { prev = await readFile(OUT_PATH, 'utf8'); } catch { /* first run */ }
  if (prev === next) {
    console.log(`data/videos.json unchanged (${videos.length} videos)`);
    return;
  }
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, next);
  console.log(`data/videos.json written (${videos.length} videos)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
