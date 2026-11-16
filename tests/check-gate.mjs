// Gate checker for the token-radar-01 entry.
//
// Verifies, against one /output directory, every condition the bounty gate checks:
//   - dashboard files (index.html + at least one .css + one .js, at most 400 files / 4 MiB,
//     no http(s) addresses in attributes, CSS or JS imports)
//   - board.json (100-4,000 rows, ranks exactly 1..N, implied values non-increasing with rank,
//     not all equal, every watchlist slug covered, farm steps 3-12 strings of 20-600 chars)
//   - screenshots (3-4, PNG or JPEG, at most 512 KiB each, long side at most 1440,
//     short side at least 800)
//   - dossier.json is byte-identical to what the vendored buildDossier writes from this /output
//   - data.js recomputes: every row's implied value equals TVL x the four multipliers, and
//     its farm steps are byte-identical to board.json's
//
// Pure Node stdlib. Usage:
//   node tests/check-gate.mjs /tmp/radar-out /tmp/kit-radar/token-radar-01-kit/input/snapshot.json

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const outDir = process.argv[2] ?? '/tmp/radar-out';
const snapshotPath = process.argv[3];
const failures = [];
const notes = [];
const fail = (m) => failures.push(m);
const note = (m) => notes.push(m);

function pngSize(buf) {
  if (buf.length < 33 || buf.readUInt32BE(12) !== 0x49484452) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) return null;
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}

// ---- dashboard files ----
const dashDir = join(outDir, 'dashboard');
const dashFiles = readdirSync(dashDir).filter((n) => !n.startsWith('.'));
if (!dashFiles.includes('index.html')) fail('dashboard: no index.html');
if (!dashFiles.some((n) => n.endsWith('.css'))) fail('dashboard: no .css file');
if (!dashFiles.some((n) => n.endsWith('.js'))) fail('dashboard: no .js file');
if (dashFiles.length > 400) fail(`dashboard: ${dashFiles.length} files, over the 400 cap`);
let dashBytes = 0;
for (const name of dashFiles) {
  const st = statSync(join(dashDir, name));
  if (!st.isFile()) continue;
  dashBytes += st.size;
  const text = readFileSync(join(dashDir, name), 'utf-8');
  if (/https?:\/\//.test(text)) fail(`dashboard/${name}: carries an http(s) address`);
}
if (dashBytes > 4 * 1024 * 1024) fail(`dashboard: ${dashBytes} bytes, over the 4 MiB cap`);
note(`dashboard: ${dashFiles.length} files, ${dashBytes} bytes (text cap 65,536: ${dashBytes <= 65536 ? 'fits' : 'OVER'})`);
if (dashBytes > 65536) fail('dashboard source exceeds the 65,536-byte dossier text cap');

// ---- board.json ----
const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf-8'));
if (!Array.isArray(board)) fail('board.json is not an array');
if (board.length < 100 || board.length > 4000) fail(`board.json holds ${board.length} rows`);
const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) { fail(`board.json: rank ${i + 1} is ${ranks[i]}`); break; }
for (let i = 1; i < board.length; i++) {
  if (board[i].implied_value_usd > board[i - 1].implied_value_usd) { fail(`board.json: row ${i + 1} outranks row ${i} on implied value`); break; }
}
if (board.length >= 2 && board[0].implied_value_usd === board[board.length - 1].implied_value_usd) fail('board.json: every row shares one implied value');
for (const r of board) {
  if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) { fail(`board.json: ${r.slug} has implied value ${r.implied_value_usd}`); break; }
  if (r.farm_steps.length < 3 || r.farm_steps.length > 12) { fail(`board.json: ${r.slug} has ${r.farm_steps.length} farm steps`); break; }
  for (const s of r.farm_steps) {
    if (s.length < 20 || s.length > 600) { fail(`board.json: ${r.slug} has a farm step of ${s.length} characters`); break; }
  }
}
note(`board.json: ${board.length} rows, implied $${board[0]?.implied_value_usd.toLocaleString('en-US')} down to $${board[board.length - 1]?.implied_value_usd.toLocaleString('en-US')}`);

if (snapshotPath) {
  const snap = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snap.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) fail(`board.json misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`);
  note(`watchlist: ${snap.watchlist.length - missing.length}/${snap.watchlist.length} covered`);
  const preToken = snap.protocols.filter((p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null);
  note(`snapshot: ${snap.protocols.length} protocols, ${preToken.length} pre-token, ${snap.watchlist.length} on the watchlist`);
}

// ---- data.js recompute + farm-step identity ----
const dataText = readFileSync(join(outDir, 'data.js'), 'utf-8');
if (!dataText.startsWith('window.RADAR=')) fail('data.js does not start with window.RADAR=');
const radar = JSON.parse(dataText.slice('window.RADAR='.length).replace(/;\s*$/, ''));
const boardBySlug = new Map(board.map((r) => [r.slug, r]));
let mismatches = 0;
for (const r of radar.rows) {
  const again = Math.max(1, Math.round(r.tvl_usd * r.category_multiple * r.growth_multiplier * r.maturity_multiplier * r.chain_multiplier));
  if (again !== r.implied_value_usd) mismatches++;
  const b = boardBySlug.get(r.slug);
  if (!b || JSON.stringify(b.farm_steps) !== JSON.stringify(r.farm_steps)) mismatches++;
}
if (mismatches > 0) fail(`data.js: ${mismatches} rows fail the recompute / farm-step identity check`);
note(`data.js: ${radar.rows.length} rows, ${radar.live.length} live, ${radar.set_aside.length} set aside, recompute matches board.json`);

// ---- screenshots ----
const shotDir = join(outDir, 'screenshots');
const shots = readdirSync(shotDir).filter((n) => !n.startsWith('.')).sort();
if (shots.length < 3 || shots.length > 4) fail(`screenshots: ${shots.length} images, the gate wants 3-4`);
for (const name of shots) {
  const buf = readFileSync(join(shotDir, name));
  if (buf.length > 524288) fail(`screenshots/${name}: ${buf.length} bytes, over 512 KiB`);
  const size = pngSize(buf) ?? jpegSize(buf);
  if (size === null) { fail(`screenshots/${name}: neither a PNG nor a JPEG`); continue; }
  const long = Math.max(size.w, size.h);
  const short = Math.min(size.w, size.h);
  if (long > 1440) fail(`screenshots/${name}: long side ${long}, over 1440`);
  if (short < 800) fail(`screenshots/${name}: short side ${short}, under 800`);
  note(`screenshots/${name}: ${size.w}x${size.h}, ${buf.length} bytes`);
}

// ---- dossier.json ----
const dossier = readFileSync(join(outDir, 'dossier.json'));
const rebuilt = buildDossier(outDir, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } });
if (!dossier.equals(Buffer.from(rebuilt))) fail('dossier.json is not byte-identical to buildDossier output');
note(`dossier.json: ${dossier.length} bytes, byte-identical to buildDossier output`);

console.log(notes.map((n) => `  ok  ${n}`).join('\n'));
if (failures.length > 0) {
  console.log(failures.map((f) => `FAIL  ${f}`).join('\n'));
  process.exit(1);
}
console.log(`GATE: all checks passed (${notes.length} notes, 0 failures)`);
