# Test evidence — token-radar-01 entry (model radar-2)

Run 2026-11-16 ~14:00 WIB, Node v24.22.1, snapshot `/tmp/kit-radar/token-radar-01-kit/input/snapshot.json`
(as of 2026-11-14, 758 protocols, 342 pre-token, watchlist 40).

## Build

```
MAKEFUN_OUTPUT_DIR=/tmp/radar-out node main.ts --input /tmp/kit-radar/token-radar-01-kit/input/snapshot.json
token radar (radar-2): 203 rows (163 early, 40 watchlist), 40 live, 86 set aside, as of 2026-11-14
  implied value: top $500,199,573 (Steakhouse Financial), lowest $475,765 (Nucleus)
  wrote /tmp/radar-out/board.json, /tmp/radar-out/data.js, /tmp/radar-out/dashboard (3 files),
  /tmp/radar-out/screenshots (3 images) and /tmp/radar-out/dossier.json
```

## Determinism

Two runs to separate directories, `diff -rq` over the whole output: **byte-identical**.

## Gate check (`node tests/check-gate.mjs /tmp/radar-out <snapshot>`)

```
  ok  dashboard: 3 files, 30829 bytes (text cap 65,536: fits)
  ok  board.json: 203 rows, implied $500,199,573 down to $475,765
  ok  watchlist: 40/40 covered
  ok  snapshot: 758 protocols, 342 pre-token, 40 on the watchlist
  ok  data.js: 203 rows, 40 live, 86 set aside, recompute matches board.json
  ok  screenshots/1-board.png: 1440x900, 181770 bytes
  ok  screenshots/2-detail.png: 1440x900, 255702 bytes
  ok  screenshots/3-filtered.png: 1440x900, 165225 bytes
  ok  dossier.json: 836198 bytes, byte-identical to buildDossier output
GATE: all checks passed (9 notes, 0 failures)
```

The checker also verifies: ranks exactly 1..N, implied values non-increasing with rank, not all
equal, farm steps 3–12 strings of 20–600 characters (all 7 steps, 129–232 chars), no http(s)
addresses in any dashboard file, screenshots 3–4 PNG/JPEG at most 512 KiB with long side at most
1440 and short side at least 800, and every data.js row's implied value recomputed from its four
multipliers equals board.json's value (0 mismatches) with farm steps byte-identical to board.json.

## Screenshots

Taken with headless Chromium (Playwright cache) at 1440×900, `--allow-file-access-from-files`,
from the built dashboard in `/tmp/radar-out/dashboard`:

- `1-board.png` — the default board (203 rows, Steakhouse Financial #1).
- `2-detail.png` — `#p=steakhouse-financial`, the detail panel with the model breakdown, the
  recompute check ("matches the board value"), the risk reasons and the seven-step farm plan.
- `3-filtered.png` — `#category=Lending`, 16 of 203 protocols match.

All three were viewed and render correctly. The system Chromium at
`/opt/meta-chromium/chrome` refuses to start in this VM ("Hatch WebGL domain policy is required
for browser startup"); the Playwright Chromium was used instead.

## Notes

- The first build exposed a real model problem: the top of the board was WBTC, Coinbase Bridge
  and other wrapped-asset products. The set-aside rule (Bridge, Canonical Bridge, Liquid Staking,
  Liquid Restaking, Restaked BTC) was added in `lib/model.ts` because their TVL is the asset
  itself and the receipt token already exists. The watchlist names no protocol in those
  categories, so coverage is unaffected; the 86 set-aside protocols are listed in the dashboard.
- The first screenshot run caught a real bug: `dashboard/index.html` loaded `data.js` instead of
  `../data.js`, so the board rendered empty. Fixed; screenshots were retaken from the fixed build.
- A re-run once carried a stale 1×1 placeholder screenshot in the output directory; `main.ts`
  now clears the output's `screenshots/` before copying.

## Bundle (dry-run only, 2026-11-16 ~14:00 WIB)

```
cd /tmp/kit-radar/token-radar-01-kit
node cli/makefun.mjs bundle --repo ~/workspace/makefun/token-radar-01-entry \
  --out /tmp/radar-bundle-dry.tar.gz \
  --session ~/agents/agent-632f484d-edf7-4cc0-a37e-4fb4f8f8b5ad/sessions/632f484d-edf7-4cc0-a37e-4fb4f8f8b5ad.jsonl \
  --no-discover --harness muse-app --provider ipnext --model ipnext/avocado-5.17-v2 \
  --effort default --mcp none \
  --notes "Token launch radar, model radar-2: 203-row board, dashboard, screenshots, gate tests" \
  --dry-run
```

Result: the session is collected (78 turns, 282 lines kept, 122 earlier records left out as
before the repository was first named), the instruction file `~/AGENTS.md` is collected, and
redaction strips 11 email addresses, 107 home paths, 14 usernames and 15 credentials. No bundle
was written: the CLI refuses without three things that only the top-level agent can supply —
(1) the user's opening prompt (this session opens with a summary; the parent session holds it),
(2) `--harness-version`, and (3) `--muse-usage` rows (0 attached: a subagent's rows are written
only once its run completes, and the CLI says the top-level agent must run the SELECT with its
own agent_id and each subagent's, then bundle and submit). The entry's git commit for the bundle
is `06a340a`.
