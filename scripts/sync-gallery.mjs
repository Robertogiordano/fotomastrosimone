#!/usr/bin/env node
// Sync Cloudinary tagged images -> data/gallery.json + sitemap.xml
// Node 20+, zero npm dependencies.
//
// Usage:
//   CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... node scripts/sync-gallery.mjs
//   node scripts/sync-gallery.mjs --fixture scripts/fixtures/sample-response.json
//
// Options:
//   --fixture <file>   read a fake Admin API response instead of calling Cloudinary
//   --allow-empty      allow overwriting a non-empty gallery.json with zero images

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = resolve(ROOT, 'data/galleries.config.json');
const GALLERY_PATH = resolve(ROOT, 'data/gallery.json');
const SITEMAP_PATH = resolve(ROOT, 'sitemap.xml');
const SITEMAP_IMG_WIDTH = 2000;
const MAX_IMAGES_PER_URL = 1000;
const PAGE_SIZE = 500;

function parseArgs(argv) {
  const args = { fixture: null, allowEmpty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixture') args.fixture = argv[++i];
    else if (a.startsWith('--fixture=')) args.fixture = a.slice('--fixture='.length);
    else if (a === '--allow-empty') args.allowEmpty = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (args.fixture === undefined) throw new Error('--fixture requires a file path');
  return args;
}

// ---------- data sources ----------

function makeApiSource() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  const missing = [
    ['CLOUDINARY_CLOUD_NAME', cloud],
    ['CLOUDINARY_API_KEY', key],
    ['CLOUDINARY_API_SECRET', secret],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);
  const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');

  return {
    cloudName: cloud,
    async fetchTag(tag) {
      const out = [];
      let cursor = null;
      do {
        const url = new URL(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/resources/image/tags/${encodeURIComponent(tag)}`
        );
        url.searchParams.set('max_results', String(PAGE_SIZE));
        url.searchParams.set('context', 'true');
        if (cursor) url.searchParams.set('next_cursor', cursor);
        const res = await fetchWithRetry(url, { headers: { Authorization: auth } });
        const body = await res.json();
        out.push(...(body.resources ?? []));
        cursor = body.next_cursor || null;
      } while (cursor);
      return out;
    },
  };
}

async function fetchWithRetry(url, init, attempts = 3) {
  for (let i = 1; ; i++) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (i >= attempts) throw err;
      await sleep(1000 * i);
      continue;
    }
    if (res.ok) return res;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || i >= attempts) {
      const text = await res.text().catch(() => '');
      // never print the URL with credentials: auth is in a header, URL is safe
      throw new Error(`Cloudinary ${res.status} on ${url.pathname}: ${text.slice(0, 300)}`);
    }
    await sleep(1000 * i);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function makeFixtureSource(file) {
  const body = JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8'));
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || body.cloudName || 'demo',
    async fetchTag(tag) {
      // Accept either { "<tag>": {resources:[...]}, ... } or a single Admin API
      // response whose resources carry `tags`.
      if (body[tag]?.resources) return body[tag].resources;
      return (body.resources ?? []).filter((r) => Array.isArray(r.tags) && r.tags.includes(tag));
    },
  };
}

// ---------- transform ----------

function customContext(r) {
  const c = r.context;
  if (!c) return {};
  return c.custom ?? c; // Admin API returns { custom: {...} }; be lenient
}

function toImage(r, gallery) {
  const ctx = customContext(r);
  const alt =
    (typeof ctx.alt === 'string' && ctx.alt.trim()) ||
    (typeof ctx.caption === 'string' && ctx.caption.trim()) ||
    `${gallery.title} – Studio Fotografico Mastrosimone, Caltanissetta`;
  // fixed key order = stable output
  return {
    id: r.public_id,
    w: r.width,
    h: r.height,
    alt,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function byCreatedDesc(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // tie-break for determinism
}

async function buildGallery(config, source) {
  const galleries = [];
  for (const g of config.galleries) {
    const resources = await source.fetchTag(g.tag);
    const seen = new Set();
    const images = [];
    for (const r of resources) {
      if (!r?.public_id || seen.has(r.public_id)) continue;
      seen.add(r.public_id);
      images.push(toImage(r, g));
    }
    images.sort(byCreatedDesc);
    galleries.push({
      tag: g.tag,
      slug: g.slug,
      page: g.page,
      title: g.title,
      description: g.description,
      images,
    });
    console.log(`  ${g.tag}: ${images.length} image(s)`);
  }
  return { generatedAt: new Date().toISOString(), cloudName: source.cloudName, galleries };
}

// ---------- sitemap ----------

const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function buildSitemap(config, data) {
  const site = config.siteUrl.replace(/\/+$/, '');
  const allDates = data.galleries.flatMap((g) => g.images.map((i) => i.createdAt));
  const newest = (dates) => (dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null);
  const fallbackLastmod = (newest(allDates) ?? '2026-01-01T00:00:00.000Z').slice(0, 10);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];
  for (const p of config.pages) {
    const pageGalleries = data.galleries.filter((g) => g.page === p.path);
    const seen = new Set();
    const images = [];
    for (const g of pageGalleries) {
      for (const img of g.images) {
        if (seen.has(img.id)) continue;
        seen.add(img.id);
        images.push(img);
      }
    }
    images.sort(byCreatedDesc);
    const lastmod = (newest(images.map((i) => i.createdAt)) ?? fallbackLastmod).slice(0, 10);

    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(site + p.path)}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <priority>${Number(p.priority).toFixed(1)}</priority>`);
    for (const img of images.slice(0, MAX_IMAGES_PER_URL)) {
      const loc = `https://res.cloudinary.com/${data.cloudName}/image/upload/f_auto,q_auto,w_${SITEMAP_IMG_WIDTH}/${img.id}`;
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${xmlEscape(loc)}</image:loc>`);
      lines.push(`      <image:title>${xmlEscape(img.alt)}</image:title>`);
      lines.push('    </image:image>');
    }
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

// ---------- write helpers ----------

async function readIfExists(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

const withoutGeneratedAt = ({ generatedAt, ...rest }) => rest;

async function writeGallery(data, allowEmpty) {
  const prevText = await readIfExists(GALLERY_PATH);
  let prev = null;
  if (prevText) {
    try {
      prev = JSON.parse(prevText);
    } catch {
      prev = null;
    }
  }

  const total = data.galleries.reduce((n, g) => n + g.images.length, 0);
  const prevTotal = prev?.galleries?.reduce((n, g) => n + (g.images?.length ?? 0), 0) ?? 0;
  if (total === 0 && prevTotal > 0 && !allowEmpty) {
    throw new Error(
      `Refusing to replace ${prevTotal} image(s) with an empty gallery (use --allow-empty if intended).`
    );
  }

  if (prev && JSON.stringify(withoutGeneratedAt(prev)) === JSON.stringify(withoutGeneratedAt(data))) {
    console.log('data/gallery.json unchanged');
    return prev; // keep previous generatedAt
  }
  await mkdir(dirname(GALLERY_PATH), { recursive: true });
  await writeFile(GALLERY_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log(`data/gallery.json written (${total} image(s))`);
  return data;
}

async function writeIfChanged(path, content, label) {
  if ((await readIfExists(path)) === content) {
    console.log(`${label} unchanged`);
    return;
  }
  await writeFile(path, content);
  console.log(`${label} written`);
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const source = args.fixture ? await makeFixtureSource(args.fixture) : makeApiSource();
  console.log(`Syncing from ${args.fixture ? `fixture ${args.fixture}` : 'Cloudinary Admin API'}…`);

  const data = await buildGallery(config, source);
  await writeGallery(data, args.allowEmpty);
  await writeIfChanged(SITEMAP_PATH, buildSitemap(config, data), 'sitemap.xml');
}

main().catch((err) => {
  console.error(`sync-gallery failed: ${err.message}`);
  process.exit(1);
});
