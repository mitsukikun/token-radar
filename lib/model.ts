// Radar-2: a token launch radar scored from the snapshot's own figures.
//
// The board ranks every rankable pre-token protocol in the snapshot (the watchlist is the floor,
// never the ceiling) by an implied value that comes from four things the snapshot records:
//
//   1. Category comps: the median market-cap-per-TVL of the live-token protocols in the same
//      category. A lending protocol is priced like lending protocols that already trade, not like
//      a bridge. Categories with fewer than three live comps fall back to the global median.
//      The multiple is clamped to [0.05, 1.00] so one outlier category cannot price the board.
//   2. Growth: the seven-day TVL change, clamped to [-80%, +150%]. Gains count at half weight,
//      losses at near-full weight: a protocol bleeding TVL is a worse launch candidate than a
//      flat one is a better one.
//   3. Maturity: how long the protocol has run with no token, from listed_at to the snapshot's
//      as_of. Older is steadier: 0.55 + 0.45 * min(age, 1460d) / 1460d. Unknown age counts as
//      365 days. Age never proves a launch is coming; it only says the record is long.
//   4. Chain breadth: a protocol live on three or more chains earns a 1.05 factor, two chains
//      1.02. Multi-chain TVL is harder to fake and easier to keep.
//
//   implied = round(tvl_usd x categoryMultiple x growthMult x maturityMult x chainMult)
//
// One more rule, and it matters more than any multiplier: the board does not rank wrapped,
// bridged or staked-asset products (Bridge, Canonical Bridge, Liquid Staking, Liquid
// Restaking, Restaked BTC). Their TVL is the asset itself — WBTC's TVL is the bitcoin it
// holds, a canonical bridge's TVL is the chain it serves — and the receipt token already
// exists, so there is nothing left to launch. Ranking them would put WBTC and a chain's own
// bridge at the top of a token launch radar, which is the opposite of useful. They are set
// aside, listed in the dashboard with the reason, and never scored. The watchlist names no
// protocol in these categories, so the floor is unaffected. A few genuine bridge protocols
// are caught by this category call; that is deliberate — bridges price the asset, not the
// protocol, and a launch radar that cannot tell them apart is not a radar.
//
// A risk score (0-100) rides alongside every row, built from the same figures: young age,
// extreme seven-day moves, small TVL and single-chain exposure each add points. It is a
// warning label, never a rank: the board is ordered by implied value alone.
//
// No protocol name is ever special-cased. Every number above is a constant of this file, and
// the dashboard recomputes each row from the same constants, so the page and board.json agree.

/** One protocol as the sealed snapshot carries it: exactly ten fields. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants: the dashboard prints them and the page recomputes with them. */
export interface ModelConstants {
  growth_up_weight: number;
  growth_down_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_multi_factor: number;
  chain_double_factor: number;
  multiple_floor: number;
  multiple_cap: number;
  min_category_comps: number;
}

export const MODEL: ModelConstants = {
  growth_up_weight: 0.5,
  growth_down_weight: 0.9,
  growth_floor: -80,
  growth_cap: 150,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  chain_multi_factor: 1.05,
  chain_double_factor: 1.02,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  min_category_comps: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 40;

/** One risk contributor: why a row's risk score is what it is. */
export interface RiskFactor {
  label: string;
  points: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  risk_score: number;
  risk_band: 'Low' | 'Medium' | 'High';
  model: {
    category_multiple: number;
    category_comps: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  risk_score: number;
  risk_band: 'Low' | 'Medium' | 'High';
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  risk_factors: RiskFactor[];
  farm_steps: string[];
}

/** A wrapped, bridged or staked-asset product, set aside from the board with the reason. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  reason: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_per_tvl: number | null;
}

/** One category's comp table row, for the dashboard's Model view. */
export interface CompRow {
  category: string;
  comps: number;
  median_mcap_per_tvl: number;
  multiple_used: number;
}

/** Everything the dashboard needs: the board, the live set, the comps and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  comps: CompRow[];
  rows: RadarRow[];
  live: LiveRow[];
  set_aside_size: number;
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list of numbers. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The market comps: for every category, the median market-cap-per-TVL of its live-token
 * protocols (CEX excluded: exchange tokens are not priced like protocol tokens). Categories
 * with fewer than `min_category_comps` live comps use the global median instead.
 */
export function categoryComps(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, { multiple: number; comps: number; median: number }>; global: number } {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    if (p.category === 'CEX') continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const list = byCat.get(key) ?? [];
    list.push(ratio);
    byCat.set(key, list);
  }
  all.sort((a, b) => a - b);
  const globalRaw = median(all);
  const global = Math.min(model.multiple_cap, Math.max(model.multiple_floor, globalRaw));
  const byCategory = new Map<string, { multiple: number; comps: number; median: number }>();
  for (const [cat, ratios] of byCat) {
    ratios.sort((a, b) => a - b);
    const med = median(ratios);
    const multiple = ratios.length >= model.min_category_comps
      ? Math.min(model.multiple_cap, Math.max(model.multiple_floor, med))
      : global;
    byCategory.set(cat, { multiple, comps: ratios.length, median: round4(med) });
  }
  return { byCategory, global };
}

/** The multiple a protocol's category earns, with its comp count. */
export function multipleFor(p: SnapshotProtocol, comps: { byCategory: Map<string, { multiple: number; comps: number; median: number }>; global: number }): { multiple: number; comps: number } {
  const entry = comps.byCategory.get(p.category ?? 'Other');
  if (entry !== undefined) return { multiple: entry.multiple, comps: entry.comps };
  return { multiple: comps.global, comps: 0 };
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comps: { byCategory: Map<string, { multiple: number; comps: number; median: number }>; global: number },
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; compCount: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, comps: compCount } = multipleFor(protocol, comps);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const weight = growthPct >= 0 ? model.growth_up_weight : model.growth_down_weight;
  const growthMult = 1 + (growthPct / 100) * weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = protocol.chains.length;
  const chainMult = chainCount >= 3 ? model.chain_multi_factor : chainCount === 2 ? model.chain_double_factor : 1;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * chainMult));
  return { implied, multiple, compCount, growthPct, growthMult, maturityMult, chainMult, age };
}

/** The risk score (0-100) and its contributors, from the snapshot's own figures. */
export function riskScore(p: SnapshotProtocol, age: number | null): { score: number; band: 'Low' | 'Medium' | 'High'; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  if (age === null) {
    factors.push({ label: 'No listing date on record', points: 12 });
  } else if (age < 90) {
    factors.push({ label: `Listed only ${age} days ago`, points: 25 });
  } else if (age < 180) {
    factors.push({ label: `Listed only ${age} days ago`, points: 15 });
  } else if (age < 365) {
    factors.push({ label: `Listed ${age} days ago`, points: 8 });
  }
  const g = p.change_7d;
  if (g === null) {
    factors.push({ label: 'No seven-day TVL change reported', points: 5 });
  } else if (Math.abs(g) > 50) {
    factors.push({ label: `TVL moved ${g.toFixed(1)}% in seven days`, points: 20 });
  } else if (Math.abs(g) > 25) {
    factors.push({ label: `TVL moved ${g.toFixed(1)}% in seven days`, points: 10 });
  }
  if (p.tvl_usd < 10_000_000) {
    factors.push({ label: 'TVL under $10M', points: 15 });
  } else if (p.tvl_usd < 50_000_000) {
    factors.push({ label: 'TVL under $50M', points: 8 });
  }
  if (p.chains.length <= 1) factors.push({ label: 'Live on a single chain', points: 8 });
  const score = Math.min(100, factors.reduce((n, f) => n + f.points, 0));
  const band = score < 35 ? 'Low' : score < 65 ? 'Medium' : 'High';
  return { score, band, factors };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * The categories the board sets aside: wrapped, bridged or staked-asset products. Their TVL is
 * the asset itself and the receipt token already exists, so there is nothing left to launch.
 */
export const SET_ASIDE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol is a wrapped, bridged or staked-asset product the board sets aside. */
export function isSetAside(p: SnapshotProtocol): boolean {
  return p.category !== null && SET_ASIDE_CATEGORIES.has(p.category);
}

/** Why a set-aside protocol is not ranked, in one sentence. */
export function setAsideReason(p: SnapshotProtocol): string {
  if (p.category === 'Canonical Bridge') return 'A chain\u2019s own bridge: its TVL is the chain it serves, and it will never launch a token.';
  if (p.category === 'Bridge') return 'A wrapped or bridged asset: its TVL is the asset it holds, and the bridged token already exists.';
  return 'A staked-asset receipt: its TVL is the staked asset itself, and the receipt token already exists.';
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, not a wrapped-asset product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !isSetAside(p) && !VERSIONED.test(p.name);
}

/** The set-aside protocols, largest TVL first, for the dashboard's Set aside view. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && isSetAside(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      reason: setAsideReason(p),
    }));
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const comps = categoryComps(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot no longer carries
  // (it cannot, but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, not just the top few by TVL.
  // A small protocol with strong growth and a long record can outrank a large flat one.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, comps, model);
    const r = riskScore(p, v.age);
    return { p, v, r };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    risk_score: s.r.score,
    risk_band: s.r.band,
    model: {
      // Full precision, not rounded: the dashboard recomputes the implied value from these
      // four multipliers and must land on the same dollar. Display code rounds to four places.
      category_multiple: s.v.multiple,
      category_comps: s.v.compCount,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      maturity_multiplier: s.v.maturityMult,
      chain_multiplier: s.v.chainMult,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open; borrow a small amount once, then repay it.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and keep the shares.`;
  if (c.includes('restak') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one market position, then settle it.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('indexes') || c.includes('index')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and keep it in the position.`;
  if (c.includes('rwa') || c.includes('basis trad')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('privacy')) return `Use $${capital} through ${name}'s private transfer on ${chain} and keep the receipt.`;
  if (c.includes('launchpad')) return `Stake or lock $${capital} in ${name}'s launch pool on ${chain} and join one sale.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Step five is a risk check before adding capital; step six
 * says how to claim safely; step seven is the log and the exit plan.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the wallet looks active in every weekly snapshot.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before adding more capital, check the protocol's TVL trend and confirm every contract address on the chain explorer and the protocol's own docs; never trust an address from a direct message.`,
      cost: 'nothing to check',
      time: '10 minutes',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay a fee to claim.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and set your exit: unwind when the token is announced or the TVL falls by a third.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_per_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's form for data.js. The multipliers are full precision, not the board's rounded
 * display values, so the dashboard can recompute the implied value exactly and show its work.
 * The farm steps are the board's own strings, so the page and board.json never disagree. */
export function radarRow(row: BoardRow, riskFactors: RiskFactor[]): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    risk_score: row.risk_score,
    risk_band: row.risk_band,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    risk_factors: riskFactors,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = categoryComps(snapshot, model);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const compRows: CompRow[] = [...comps.byCategory.entries()]
    .map(([category, v]) => ({ category, comps: v.comps, median_mcap_per_tvl: v.median, multiple_used: v.multiple }))
    .sort((a, b) => b.comps - a.comps || (a.category < b.category ? -1 : 1));
  const riskBySlug = new Map<string, RiskFactor[]>();
  for (const row of board) {
    const p = snapshot.protocols.find((q) => q.slug === row.slug);
    if (p !== undefined) riskBySlug.set(row.slug, riskScore(p, row.age_days).factors);
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist: snapshot.watchlist,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round4(comps.global),
    comps: compRows,
    rows: board.map((r) => radarRow(r, riskBySlug.get(r.slug) ?? [])),
    live,
    set_aside_size: setAside.length,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the gate's 100`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
