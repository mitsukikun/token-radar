// Token radar, model radar-2.
//
// Reads /input/snapshot.json, ranks every rankable pre-token protocol by implied value, and
// writes the entry's /output: board.json, data.js, dashboard/, screenshots/ and dossier.json.
// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
//
//   node main.ts --input /input/snapshot.json
//   MAKEFUN_OUTPUT_DIR=/output node main.ts
//
// Node runs this TypeScript as it is (erasable syntax only, no enums or parameter properties).

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { parseSnapshot, buildBoard, buildRadar, boardIssue, dataScript, MODEL_VERSION } from './lib/model.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };

/** A run's paths: the input snapshot, and where the entry's output goes. */
interface Options {
  input: string;
  output: string;
}

/** The `--input` and `--output-dir` flags, or `MAKEFUN_OUTPUT_DIR`, or the defaults. */
function parseOptions(argv: string[]): Options {
  const inputFlag = argv.indexOf('--input');
  const outputFlag = argv.indexOf('--output-dir');
  const input = inputFlag === -1 ? '/input/snapshot.json' : argv[inputFlag + 1]!;
  const output = outputFlag === -1 ? (process.env.MAKEFUN_OUTPUT_DIR ?? '/output') : argv[outputFlag + 1]!;
  if (input === undefined || output === undefined) throw new Error('main.ts: a flag is missing its value');
  return { input, output };
}

/** A directory, created if it does not exist yet. */
function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/** The entry's output: the board, the data script, the dashboard, the screenshots, the dossier. */
function run(options: Options): void {
  const snapshot = parseSnapshot(readFileSync(options.input, 'utf-8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`main.ts: the board is not one the gate will take: ${issue}`);

  const out = resolve(options.output);
  ensureDir(out);
  writeFileSync(join(out, 'board.json'), `${JSON.stringify(board, null, 1)}\n`);
  writeFileSync(join(out, 'data.js'), dataScript(radar));

  const dashboardOut = join(out, 'dashboard');
  ensureDir(dashboardOut);
  cpSync(join(REPO_ROOT, 'dashboard'), dashboardOut, { recursive: true });

  const shotsOut = join(out, 'screenshots');
  ensureDir(shotsOut);
  // A re-run must not carry a stale screenshot: clear the output's screenshots first.
  for (const name of readdirSync(shotsOut)) rmSync(join(shotsOut, name), { force: true });
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (existsSync(shotsDir)) {
    for (const name of readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort()) {
      cpSync(join(shotsDir, name), join(shotsOut, name));
    }
  }
  const shots = readdirSync(shotsOut).filter((n) => !n.startsWith('.'));
  if (shots.length === 0) throw new Error('main.ts: screenshots/ holds no image: the first is the cover');

  writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: DASHBOARD_CAPS }));

  const top = board[0]!;
  const low = board[board.length - 1]!;
  process.stdout.write(
    [
      `token radar (${MODEL_VERSION}): ${board.length} rows (${radar.early_size} early, ${radar.watchlist_size} watchlist), ${radar.live_size} live, ${radar.set_aside_size} set aside, as of ${snapshot.as_of}`,
      `  implied value: top $${top.implied_value_usd.toLocaleString('en-US')} (${top.name}), lowest $${low.implied_value_usd.toLocaleString('en-US')} (${low.name})`,
      `  wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${readdirSync(dashboardOut).length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}`,
    ].join('\n') + '\n',
  );
}

run(parseOptions(process.argv.slice(2)));
