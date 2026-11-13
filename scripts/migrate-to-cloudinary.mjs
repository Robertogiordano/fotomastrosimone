#!/usr/bin/env node
/**
 * One-off migration: upload repo photos to Cloudinary, tagged per gallery.
 *
 *   file/foto/img-0.jpg   … img-169.jpg  → tag "matrimoni"
 *   file/foto/img-170.jpg … img-188.jpg  → tag "bimbi"
 *   file/studio/imgLoc-*.jpg             → tag "studio"
 *
 * public_id    = fotomastrosimone/<file name without extension>
 * asset_folder = fotomastrosimone/<tag>
 * overwrite    = false (existing assets are never replaced)
 *
 * Usage (Node 20+, no npm dependencies):
 *   node scripts/migrate-to-cloudinary.mjs --dry-run
 *   CLOUDINARY_CLOUD_NAME=… CLOUDINARY_API_KEY=… CLOUDINARY_API_SECRET=… \
 *     node scripts/migrate-to-cloudinary.mjs
 *
 * Options:
 *   --dry-run          list what would be uploaded, no network calls, no credentials needed
 *   --concurrency=N    parallel uploads (default 3, max 6)
 *
 * Writes a summary to scripts/migrate-log.json (git-ignored).
 */

import { createHash } from 'node:crypto';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_FILE = path.join(ROOT, 'scripts', 'migrate-log.json');
const PUBLIC_ID_PREFIX = 'fotomastrosimone';
const MAX_BYTES = 10 * 1024 * 1024; // Cloudinary free plan image limit
const MAX_ATTEMPTS = 5;

// ---------- args ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const concArg = args.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = Math.min(6, Math.max(1, Number(concArg?.split('=')[1]) || 3));
const unknown = args.filter((a) => a !== '--dry-run' && !a.startsWith('--concurrency='));
if (unknown.length) {
  console.error(`Unknown option(s): ${unknown.join(' ')}`);
  process.exit(2);
}

// ---------- credentials ----------
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!DRY_RUN) {
  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`Missing environment variable(s): ${missing.join(', ')}`);
    console.error('Set them (Cloudinary console → Settings → API Keys) or run with --dry-run.');
    process.exit(1);
  }
}

// ---------- file mapping ----------
function tagFor(dir, name) {
  if (dir === 'studio') return /^imgLoc-\d+\.jpe?g$/i.test(name) ? 'studio' : null;
  const m = /^img-(\d+)\.jpe?g$/i.exec(name);
  if (!m) return null;
  const n = Number(m[1]);
  if (n >= 0 && n <= 169) return 'matrimoni';
  if (n >= 170 && n <= 188) return 'bimbi';
  return null;
}

async function collectFiles() {
  const jobs = [];
  const skipped = [];
  for (const dir of ['foto', 'studio']) {
    const abs = path.join(ROOT, 'file', dir);
    const names = (await readdir(abs)).filter((n) => !n.startsWith('.'));
    names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const name of names) {
      const tag = tagFor(dir, name);
      const rel = `file/${dir}/${name}`;
      if (!tag) {
        skipped.push({ file: rel, reason: 'no tag mapping' });
        continue;
      }
      const { size } = await stat(path.join(abs, name));
      if (size > MAX_BYTES) {
        skipped.push({ file: rel, reason: `too large (${(size / 1048576).toFixed(1)} MB > 10 MB)` });
        continue;
      }
      jobs.push({
        file: rel,
        abs: path.join(abs, name),
        size,
        tag,
        publicId: `${PUBLIC_ID_PREFIX}/${path.parse(name).name}`,
        assetFolder: `${PUBLIC_ID_PREFIX}/${tag}`,
      });
    }
  }
  return { jobs, skipped };
}

// ---------- Cloudinary helpers ----------
function sign(params) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + API_SECRET).digest('hex');
}

class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${body?.error?.message ?? JSON.stringify(body)?.slice(0, 200)}`);
    this.status = status;
  }
}

const isRetryable = (err) =>
  !(err instanceof HttpError) || err.status === 429 || err.status === 420 || err.status >= 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
      const delay = Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 500;
      console.warn(`  ↻ ${label}: ${err.message} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

/** Admin API lookup: true if the public_id already exists. */
async function exists(publicId) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/upload/${publicId
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (res.status === 404) return false;
  if (res.ok) return true;
  throw new HttpError(res.status, await readJson(res));
}

async function upload(job) {
  const params = {
    asset_folder: job.assetFolder,
    overwrite: 'false',
    public_id: job.publicId,
    tags: job.tag,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', API_KEY);
  form.append('signature', sign(params));
  form.append('file', await openAsBlob(job.abs, { type: 'image/jpeg' }), path.basename(job.abs));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const body = await readJson(res);
  if (!res.ok) throw new HttpError(res.status, body);
  return body;
}

// ---------- runner ----------
async function processJob(job) {
  if (DRY_RUN) return { status: 'would-upload' };
  if (await withRetry(`${job.file} (check)`, () => exists(job.publicId))) {
    return { status: 'skipped-existing' };
  }
  const res = await withRetry(job.file, () => upload(job));
  // With overwrite=false Cloudinary answers 200 + existing:true if it was already there.
  if (res.existing) return { status: 'skipped-existing' };
  return { status: 'uploaded', url: res.secure_url, bytes: res.bytes };
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await worker(items[i]);
      } catch (err) {
        results[i] = { status: 'failed', error: err.message };
      }
      done++;
      const r = results[i];
      const icon = { uploaded: '✓', 'skipped-existing': '=', failed: '✗', 'would-upload': '·' }[r.status];
      console.log(
        `${icon} [${String(done).padStart(3)}/${items.length}] ${items[i].tag.padEnd(9)} ${items[i].file} → ${items[i].publicId}` +
          (r.status === 'failed' ? `  (${r.error})` : r.status === 'skipped-existing' ? '  (already on Cloudinary)' : '')
      );
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const { jobs, skipped } = await collectFiles();
  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}${jobs.length} file(s) to process` +
      (DRY_RUN ? '' : ` on cloud "${CLOUD}" with concurrency ${CONCURRENCY}`) +
      '\n'
  );
  for (const s of skipped) console.warn(`! skipped ${s.file}: ${s.reason}`);

  const startedAt = new Date().toISOString();
  const results = await runPool(jobs, DRY_RUN ? 1 : CONCURRENCY, processJob);

  const byTag = {};
  const totals = { uploaded: 0, 'skipped-existing': 0, failed: 0, 'would-upload': 0 };
  jobs.forEach((job, i) => {
    const s = results[i].status;
    byTag[job.tag] ??= { total: 0, uploaded: 0, 'skipped-existing': 0, failed: 0, 'would-upload': 0 };
    byTag[job.tag].total++;
    byTag[job.tag][s]++;
    totals[s]++;
  });

  const log = {
    dryRun: DRY_RUN,
    cloudName: CLOUD ?? null,
    startedAt,
    finishedAt: new Date().toISOString(),
    totals: { files: jobs.length, ...totals, skippedLocal: skipped.length },
    byTag,
    skippedLocal: skipped,
    files: jobs.map((job, i) => ({
      file: job.file,
      tag: job.tag,
      publicId: job.publicId,
      assetFolder: job.assetFolder,
      bytes: job.size,
      ...results[i],
    })),
  };
  await writeFile(LOG_FILE, JSON.stringify(log, null, 2) + '\n');

  console.log('\nSummary by tag:');
  console.table(byTag);
  console.log(`Log written to ${path.relative(ROOT, LOG_FILE)}`);
  if (totals.failed) {
    console.error(`${totals.failed} upload(s) failed — re-run the script: completed files are skipped.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
