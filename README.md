# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mitsukikun/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mitsukikun/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Radar-2 — a token launch radar for make.fun's token-radar-01 bounty. It reads the sealed snapshot, learns a per-category valuation multiple from the snapshot's own live-token protocols (median market-cap / TVL by category), and ranks every pre-token protocol by an implied value = TVL × category multiple × 7-day growth × maturity × multi-chain factor. The board covers 203 rows — the 40-protocol watchlist plus 163 early finds — with a risk score and a seven-step farm plan per protocol. The dashboard is sortable and filterable, with a detail view that recomputes each row's implied value from its own multipliers. Node 22, TypeScript, standard library only; two runs are byte-identical.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=3fk7ms5j&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
