// Token Radar, model radar-2.
//
// Renders window.RADAR (written by main.ts from the snapshot) with no network at all:
// the whole dataset is the data.js script this page loads. The detail panel recomputes each
// row's implied value from the row's own TVL and four multipliers and says whether the
// recompute matches the board value, so the page checks the model it displays.

(function () {
  'use strict';
  var R = window.RADAR;
  var rows = R.rows;
  var live = R.live;
  var watchlist = new Set(R.watchlist);
  var MAX_SHOWN = 200;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  function moneyFull(n) {
    if (n == null || !isFinite(n)) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function pct(n) {
    if (n == null || !isFinite(n)) return '—';
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
    return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }

  function ageText(days) {
    if (days == null) return '—';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  }

  function mult(n) { return n.toFixed(4); }

  // ---- hash state: the URL carries the filters, so a screenshot link reproduces a view ----
  function readHash() {
    var out = {};
    var h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  function writeHash(state) {
    var parts = [];
    ['q', 'category', 'chain', 'tvl', 'risk', 'sort', 'view', 'p'].forEach(function (k) {
      if (state[k]) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(state[k]));
    });
    history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname + location.search);
  }

  var state = {
    q: '', category: '', chain: '', tvl: '0', risk: '', sort: 'implied', view: 'board', p: '',
  };

  function applyHash() {
    var h = readHash();
    Object.keys(state).forEach(function (k) { if (h[k] !== undefined) state[k] = h[k]; });
  }

  // ---- controls ----
  function fillOptions() {
    var cats = {};
    var chains = {};
    rows.forEach(function (r) {
      if (r.category) cats[r.category] = true;
      r.chains.forEach(function (c) { chains[c] = true; });
    });
    var catSel = $('category');
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      catSel.appendChild(o);
    });
    var chainSel = $('chain');
    Object.keys(chains).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      chainSel.appendChild(o);
    });
  }

  function readControls() {
    state.q = $('q').value.trim();
    state.category = $('category').value;
    state.chain = $('chain').value;
    state.tvl = $('tvl').value;
    state.risk = $('risk').value;
    state.sort = $('sort').value;
  }

  function writeControls() {
    $('q').value = state.q;
    $('category').value = state.category;
    $('chain').value = state.chain;
    $('tvl').value = state.tvl;
    $('risk').value = state.risk;
    $('sort').value = state.sort;
  }

  // ---- filtering and sorting ----
  function filtered() {
    var q = state.q.toLowerCase();
    var minTvl = Number(state.tvl) || 0;
    var list = rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (r.tvl_usd < minTvl) return false;
      if (state.risk && r.risk_band !== state.risk) return false;
      return true;
    });
    var key = state.sort;
    list.sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd || a.rank - b.rank;
      if (key === 'growth') return (b.change_7d == null ? -Infinity : b.change_7d) - (a.change_7d == null ? -Infinity : a.change_7d) || a.rank - b.rank;
      if (key === 'age') return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days) || a.rank - b.rank;
      if (key === 'risk') return b.risk_score - a.risk_score || a.rank - b.rank;
      if (key === 'name') return a.name.localeCompare(b.name);
      return a.rank - b.rank;
    });
    return list;
  }

  // ---- facts ----
  function renderFacts() {
    var covered = rows.filter(function (r) { return watchlist.has(r.slug); }).length;
    var facts = [
      { v: covered + ' / ' + R.watchlist_size, l: 'watchlist protocols covered' },
      { v: String(R.board_size), l: 'protocols ranked' },
      { v: String(R.early_size), l: 'early finds beyond the watchlist' },
      { v: String(R.live_size), l: 'live-token protocols set aside as comps' },
      { v: String(R.set_aside_size), l: 'wrapped / bridged products set aside' },
      { v: R.global_multiple.toFixed(3), l: 'global median mcap / TVL' },
    ];
    $('facts').innerHTML = facts.map(function (f) {
      return '<div class="fact"><b>' + esc(f.v) + '</b><span>' + esc(f.l) + '</span></div>';
    }).join('');
  }

  // ---- board ----
  function renderBoard() {
    var list = filtered();
    var shown = list.slice(0, MAX_SHOWN);
    var max = shown.length ? shown[0].implied_value_usd : 1;
    $('rows').innerHTML = shown.map(function (r) {
      var w = Math.max(2, Math.round((r.implied_value_usd / max) * 72));
      var wl = watchlist.has(r.slug) ? ' <span class="sub">★ watchlist</span>' : '';
      return '<tr data-slug="' + esc(r.slug) + '">'
        + '<td class="num">' + r.rank + '</td>'
        + '<td><span class="name">' + esc(r.name) + '</span><span class="sub">' + esc(r.category || 'Other') + ' · ' + esc(r.chains.join(', ') || '—') + '</span>' + wl + '</td>'
        + '<td class="num">' + money(r.tvl_usd) + '</td>'
        + '<td class="num">' + pct(r.change_7d) + '</td>'
        + '<td class="num">' + ageText(r.age_days) + '</td>'
        + '<td><span class="badge ' + r.risk_band + '">' + r.risk_band + ' ' + r.risk_score + '</span></td>'
        + '<td class="num"><span class="bar" style="width:' + w + 'px"></span>' + moneyFull(r.implied_value_usd) + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="7" class="empty">No protocol matches these filters.</td></tr>';
    $('count').textContent = list.length === rows.length
      ? rows.length + ' protocols, ranked by implied value.'
      : list.length + ' of ' + rows.length + ' protocols match' + (list.length > MAX_SHOWN ? '; showing the first ' + MAX_SHOWN + '.' : '.');
  }

  // ---- live view ----
  function renderLive() {
    $('liveCount').textContent = String(live.length);
    $('liveRows').innerHTML = live.map(function (p) {
      return '<tr><td><span class="name">' + esc(p.name) + '</span><span class="sub">' + esc(p.category || 'Other') + ' · ' + esc(p.chains.join(', ') || '—') + '</span></td>'
        + '<td class="num">' + money(p.mcap_usd) + '</td>'
        + '<td class="num">' + money(p.tvl_usd) + '</td>'
        + '<td class="num">' + (p.mcap_per_tvl == null ? '—' : p.mcap_per_tvl.toFixed(3)) + '</td>'
        + '<td class="num">' + pct(p.change_7d) + '</td></tr>';
    }).join('');
  }

  // ---- set-aside view ----
  function renderSetAside() {
    $('setAsideRows').innerHTML = R.set_aside.map(function (p) {
      return '<tr><td><span class="name">' + esc(p.name) + '</span><span class="sub">' + esc(p.category || 'Other') + ' · ' + esc(p.chains.join(', ') || '—') + '</span></td>'
        + '<td class="num">' + money(p.tvl_usd) + '</td>'
        + '<td class="num">' + pct(p.change_7d) + '</td>'
        + '<td>' + esc(p.reason) + '</td></tr>';
    }).join('');
  }

  // ---- model view ----
  function renderModel() {
    var m = R.model;
    var notes = [
      '<strong>Category multiple.</strong> The median market-cap-per-TVL of the live-token protocols in the same category, when the category has at least ' + m.min_category_comps + ' live comps; otherwise the global median of ' + R.global_multiple.toFixed(3) + '. Clamped to ' + m.multiple_floor + ' – ' + m.multiple_cap + '.',
      '<strong>Growth.</strong> The seven-day TVL change, clamped to ' + m.growth_floor + '% … +' + m.growth_cap + '%. Gains count at ' + m.growth_up_weight + '× weight, losses at ' + m.growth_down_weight + '× — a protocol bleeding TVL is a worse launch candidate than a flat one is a better one.',
      '<strong>Maturity.</strong> ' + m.maturity_floor + ' + ' + m.maturity_range + ' × min(age, ' + m.maturity_days + ' days) / ' + m.maturity_days + ' days. A protocol with no listing date counts as ' + m.unknown_age_days + ' days old. Age never proves a launch is coming; it only says the record is long.',
      '<strong>Chain breadth.</strong> Live on three or more chains earns ×' + m.chain_multi_factor + ', two chains ×' + m.chain_double_factor + ', one chain ×1. Multi-chain TVL is harder to fake and easier to keep.',
      '<strong>Risk score (0–100).</strong> Points for a young or missing listing date, an extreme seven-day move, small TVL and a single chain. It is a warning label, never a rank: the board is ordered by implied value alone.',
      '<strong>Coverage.</strong> The board ranks all ' + R.board_size + ' rankable pre-token protocols in the snapshot — the ' + R.watchlist_size + ' on the watchlist plus ' + R.early_size + ' early finds it does not name. Live-token protocols are set aside as comps; exchanges and versioned pools are excluded.',
      '<strong>Set aside.</strong> ' + R.set_aside_size + ' pre-token protocols are not ranked at all: wrapped, bridged and staked-asset products whose TVL is the asset itself and whose receipt token already exists. The Set aside view lists them with the reason each one was left out.',
    ];
    $('modelNotes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
    $('compRows').innerHTML = R.comps.map(function (c) {
      var usedGlobal = c.comps < m.min_category_comps;
      return '<tr><td>' + esc(c.category) + (usedGlobal ? ' <span class="sub">(uses global median)</span>' : '') + '</td>'
        + '<td class="num">' + c.comps + '</td>'
        + '<td class="num">' + c.median_mcap_per_tvl.toFixed(3) + '</td>'
        + '<td class="num">' + c.multiple_used.toFixed(3) + '</td></tr>';
    }).join('');
  }

  // ---- detail panel ----
  function recompute(r) {
    return Math.max(1, Math.round(r.tvl_usd * r.category_multiple * r.growth_multiplier * r.maturity_multiplier * r.chain_multiplier));
  }

  function openDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var again = recompute(r);
    var check = again === r.implied_value_usd
      ? '<p class="check">Recomputed from the four multipliers above: ' + moneyFull(again) + ' — matches the board value.</p>'
      : '<p class="warn">Recomputed from the four multipliers above: ' + moneyFull(again) + ' — the board value is ' + moneyFull(r.implied_value_usd) + '.</p>';
    var risk = r.risk_factors.length
      ? '<ul class="risklist">' + r.risk_factors.map(function (f) {
          return '<li>' + esc(f.label) + ' <span class="pts">+' + f.points + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="viewnote">No risk factor fired for this protocol.</p>';
    var farm = '<ol class="farmlist">' + r.farm_steps.map(function (s) {
      var i = s.lastIndexOf(' Cost: ');
      var action = i === -1 ? s : s.slice(0, i);
      var cost = i === -1 ? '' : s.slice(i + 1);
      return '<li>' + esc(action) + (cost ? '<br><span class="cost">' + esc(cost) + '</span>' : '') + '</li>';
    }).join('') + '</ol>';
    $('detailBody').innerHTML =
      '<h2>' + esc(r.name) + '</h2>'
      + '<p class="dsub">Rank #' + r.rank + ' · ' + esc(r.category || 'Other') + ' · ' + esc(r.chains.join(', ') || '—') + (watchlist.has(r.slug) ? ' · ★ on the watchlist' : '') + '</p>'
      + '<div class="kv"><span>TVL</span><span>' + moneyFull(r.tvl_usd) + '</span></div>'
      + '<div class="kv"><span>Seven-day TVL change</span><span>' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</span></div>'
      + '<div class="kv"><span>Age</span><span>' + ageText(r.age_days) + (r.listed_at ? ' (listed ' + esc(r.listed_at) + ')' : '') + '</span></div>'
      + '<div class="kv"><span>Risk</span><span>' + r.risk_band + ' ' + r.risk_score + ' / 100</span></div>'
      + '<h3>How the implied value is built</h3>'
      + '<div class="kv"><span>TVL</span><span>' + moneyFull(r.tvl_usd) + '</span></div>'
      + '<div class="kv"><span>× category multiple</span><span>' + mult(r.category_multiple) + '</span></div>'
      + '<div class="kv"><span>× growth multiplier</span><span>' + mult(r.growth_multiplier) + '</span></div>'
      + '<div class="kv"><span>× maturity multiplier</span><span>' + mult(r.maturity_multiplier) + '</span></div>'
      + '<div class="kv"><span>× chain multiplier</span><span>' + mult(r.chain_multiplier) + '</span></div>'
      + '<div class="kv"><span><strong>Implied value</strong></span><span><strong>' + moneyFull(r.implied_value_usd) + '</strong></span></div>'
      + check
      + '<h3>Why the risk score is ' + r.risk_score + '</h3>' + risk
      + '<h3>Farm plan — seven steps</h3>' + farm
      + '<p class="viewnote">The implied value is a model, not a price. The farm plan never asks you to pay to claim.</p>';
    $('detail').hidden = false;
  }

  function closeDetail() {
    $('detail').hidden = true;
    state.p = '';
    writeHash(state);
  }

  // ---- views ----
  function renderView() {
    var v = state.view;
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === v);
    });
    $('boardView').hidden = v !== 'board';
    $('liveView').hidden = v !== 'live';
    $('setAsideView').hidden = v !== 'setaside';
    $('modelView').hidden = v !== 'model';
    if (v === 'live') renderLive();
    if (v === 'setaside') renderSetAside();
    if (v === 'model') renderModel();
  }

  function renderAll() {
    renderFacts();
    renderBoard();
    renderView();
    if (state.p) openDetail(state.p);
  }

  // ---- wire up ----
  applyHash();
  fillOptions();
  writeControls();
  $('asof').textContent = 'Snapshot ' + R.as_of + ' · ' + R.source.split(' https')[0];
  $('source').textContent = R.source + ', as of ' + R.as_of;

  ['q', 'category', 'chain', 'tvl', 'risk', 'sort'].forEach(function (id) {
    $(id).addEventListener('input', function () { readControls(); state.p = ''; writeHash(state); renderBoard(); });
    $(id).addEventListener('change', function () { readControls(); state.p = ''; writeHash(state); renderBoard(); });
  });
  $('reset').addEventListener('click', function () {
    state.q = ''; state.category = ''; state.chain = ''; state.tvl = '0'; state.risk = ''; state.sort = 'implied'; state.p = '';
    writeControls(); writeHash(state); renderBoard();
  });
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.view = b.getAttribute('data-view');
      writeHash(state);
      renderView();
    });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.p = tr.getAttribute('data-slug');
    writeHash(state);
    openDetail(state.p);
  });
  $('closeDetail').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

  renderAll();
})();
