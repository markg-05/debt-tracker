(() => {
  'use strict';

  const KEY = 'marker.v1';
  const $ = (sel, root = document) => root.querySelector(sel);

  // ───────── Icons, tags, methods ─────────

  const ICONS = {
    spade: '<path d="M12 3.5c2.6 3.6 6.5 5.9 6.5 9.3a3.4 3.4 0 0 1-5.6 2.6l.9 4.1h-3.6l.9-4.1a3.4 3.4 0 0 1-5.6-2.6c0-3.4 3.9-5.7 6.5-9.3z"/>',
    cards: '<rect x="3.5" y="6.5" width="9.5" height="13.5" rx="1.8" transform="rotate(-9 8.25 13.25)"/><rect x="10.5" y="4" width="9.5" height="13.5" rx="1.8" transform="rotate(7 15.25 10.75)"/>',
    fork: '<path d="M7 3.5v17M4.5 3.5v4.5a2.5 2.5 0 0 0 5 0V3.5M17.5 20.5v-17c-2.2 1.2-3.5 3.8-3.5 7.5h3.5"/>',
    glass: '<path d="M5 4.5h14l-7 7.5zM12 12v7.5M8 19.5h8"/>',
    car: '<path d="M4.5 16.5v-4l2-5h11l2 5v4zM4.5 16.5v2M19.5 16.5v2M3 11.5h1.5M19.5 11.5H21"/><circle cx="8.5" cy="13.5" r=".6"/><circle cx="15.5" cy="13.5" r=".6"/>',
    ticket: '<path d="M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4z"/><path d="M14.5 7.5v1.5M14.5 11.25v1.5M14.5 15v1.5"/>',
    dots: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3"/>',
    cash: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
    transfer: '<path d="M4 9h14l-3.5-3.5M20 15H6l3.5 3.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" class="i" aria-hidden="true">${ICONS[name]}</svg>`;

  const TAGS = [
    { id: 'poker', label: 'Poker', icon: 'spade' },
    { id: 'blackjack', label: 'Blackjack', icon: 'cards' },
    { id: 'food', label: 'Food', icon: 'fork' },
    { id: 'drinks', label: 'Drinks', icon: 'glass' },
    { id: 'ride', label: 'Ride', icon: 'car' },
    { id: 'tickets', label: 'Tickets', icon: 'ticket' },
    { id: 'other', label: 'Other', icon: 'dots' },
  ];
  const METHODS = [
    { id: 'cash', label: 'Cash', icon: 'cash' },
    { id: 'etransfer', label: 'E-transfer', icon: 'transfer' },
  ];
  const TAG = Object.fromEntries(TAGS.map((t) => [t.id, t]));
  const METHOD = Object.fromEntries(METHODS.map((m) => [m.id, m]));

  // ───────── State ─────────

  const DEFAULT_NAMES = { a: 'Mark', b: 'Milo' };

  let state = load();
  const draft = { kind: 'debt', from: 'b', tag: null, method: null };
  let filter = 'all';
  let freshId = null;

  function load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
    if (!s || s.v !== 1 || !Array.isArray(s.entries)) s = { v: 1, players: {}, entries: [] };
    s.players = { a: s.players?.a || DEFAULT_NAMES.a, b: s.players?.b || DEFAULT_NAMES.b };
    return s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  const other = (p) => (p === 'a' ? 'b' : 'a');
  const name = (p) => state.players[p] || DEFAULT_NAMES[p];
  // two letters when both names start the same (Mark & Milo → Ma, Mi)
  const initial = (p) => {
    const mine = name(p).trim();
    const theirs = name(other(p)).trim();
    const n = mine.charAt(0).toUpperCase() === theirs.charAt(0).toUpperCase() ? 2 : 1;
    return mine.charAt(0).toUpperCase() + mine.slice(1, n).toLowerCase() || '?';
  };
  const live = () => state.entries.filter((e) => !e.deleted).sort((x, y) => x.ts - y.ts);

  // > 0 means b owes a; < 0 means a owes b.
  // A debt from X adds to X's side; a payment from X takes off X's side.
  const delta = (e) => (e.kind === 'debt' ? 1 : -1) * (e.from === 'b' ? 1 : -1) * e.amount;
  const balance = () => live().reduce((sum, e) => sum + delta(e), 0);
  const debtorOf = (net) => (net > 0 ? 'b' : net < 0 ? 'a' : null);

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ───────── Formatting ─────────

  const money = (cents) => {
    const abs = Math.abs(cents);
    return '$' + (abs / 100).toLocaleString('en-US', {
      minimumFractionDigits: abs % 100 ? 2 : 0,
      maximumFractionDigits: 2,
    });
  };
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const sentence = (e) => `${name(e.from)} ${e.kind === 'debt' ? 'owes' : 'paid'} ${name(other(e.from))}`;
  const labelOf = (e) =>
    e.kind === 'payout'
      ? (METHOD[e.method] ? METHOD[e.method].label : 'Payment')
      : (TAG[e.tag] ? TAG[e.tag].label : '');
  const titleOf = (e) => e.note || labelOf(e) || 'Debt';
  const iconOf = (e) =>
    e.kind === 'payout' ? (METHOD[e.method] ? METHOD[e.method].icon : 'check') : (TAG[e.tag] ? TAG[e.tag].icon : 'dots');

  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  function dayLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.round((sod(now) - sod(d)) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
  const timeLabel = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  // ───────── Elements ─────────

  const el = {
    subtitle: $('#subtitle'),
    seatA: $('.seat[data-seat="a"]'),
    seatB: $('.seat[data-seat="b"]'),
    puck: $('#puck'),
    verdict: $('#verdict'),
    figure: $('#figure'),
    settle: $('#settleBtn'),
    segment: $('#segment'),
    fromBtn: $('#fromBtn'),
    toBtn: $('#toBtn'),
    verb: $('#verb'),
    swap: $('#swapBtn'),
    amount: $('#amount'),
    bumps: $('#bumps'),
    tags: $('#tags'),
    methods: $('#methods'),
    note: $('#note'),
    submit: $('#submitBtn'),
    composer: $('#composer'),
    count: $('#count'),
    filters: $('#filters'),
    summary: $('#filterSummary'),
    ledger: $('#ledger'),
    toast: $('#toast'),
  };

  // ───────── Render: balance ─────────

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shown = 0;
  let raf = 0;

  function paintFigure(cents) {
    el.figure.classList.toggle('even', cents === 0);
    if (cents === 0) { el.figure.textContent = '$0'; return; }
    const [whole, frac] = (Math.abs(cents) / 100).toFixed(2).split('.');
    const wholeStr = '$' + Number(whole).toLocaleString('en-US');
    el.figure.innerHTML = frac === '00' ? wholeStr : `${wholeStr}<span class="cents">.${frac}</span>`;
  }

  function tweenFigure(to) {
    cancelAnimationFrame(raf);
    const from = shown;
    if (from === to || reduceMotion) { shown = to; paintFigure(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 600);
      const k = 1 - Math.pow(1 - p, 3);
      shown = p < 1 ? Math.round(from + (to - from) * k) : to;
      // whole dollars mid-flight so the cents don't flicker
      paintFigure(p < 1 ? Math.round(shown / 100) * 100 : to);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function renderTable() {
    const net = balance();
    const debtor = debtorOf(net);
    const creditor = debtor && other(debtor);

    el.subtitle.textContent = `${name('a')} & ${name('b')}`;
    for (const [seat, node] of [['a', el.seatA], ['b', el.seatB]]) {
      $('.monogram', node).textContent = initial(seat);
      $('.seat-name', node).textContent = name(seat);
      node.classList.toggle('up', seat === creditor);
    }

    el.verdict.innerHTML = debtor
      ? `<b>${esc(name(debtor))}</b> owes <b>${esc(name(creditor))}</b>`
      : 'All square';

    // leans toward whoever is up; never quite reaches the seat
    const ratio = net / (Math.abs(net) + 5000);
    el.puck.style.left = `${50 - ratio * 44}%`;
    el.puck.classList.toggle('even', !debtor);

    el.settle.disabled = !debtor;
    tweenFigure(Math.abs(net));
  }

  // ───────── Render: composer ─────────

  function parseAmount() {
    const n = parseFloat(el.amount.value);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }
  function setAmount(cents) {
    el.amount.value = cents ? (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100)) : '';
  }

  function renderComposer() {
    const isDebt = draft.kind === 'debt';
    el.segment.dataset.kind = draft.kind;
    for (const b of el.segment.querySelectorAll('button')) {
      b.setAttribute('aria-selected', String(b.dataset.kind === draft.kind));
    }
    el.fromBtn.innerHTML = `<span>${esc(name(draft.from))}</span>`;
    el.toBtn.innerHTML = `<span>${esc(name(other(draft.from)))}</span>`;
    el.verb.textContent = isDebt ? 'owes' : 'paid';

    el.tags.hidden = !isDebt;
    el.methods.hidden = isDebt;
    el.tags.innerHTML = TAGS.map((t) =>
      `<button type="button" class="chip" data-tag="${t.id}" aria-pressed="${draft.tag === t.id}">${icon(t.icon)}${t.label}</button>`
    ).join('');
    el.methods.innerHTML = METHODS.map((m) =>
      `<button type="button" class="method" role="radio" data-method="${m.id}" aria-checked="${draft.method === m.id}">${icon(m.icon)}${m.label}</button>`
    ).join('');

    renderSubmit();
  }

  function renderSubmit() {
    const cents = parseAmount();
    const needsMethod = draft.kind === 'payout' && !draft.method;
    el.submit.disabled = !cents || needsMethod;
    el.submit.textContent = !cents
      ? 'Enter an amount'
      : needsMethod
        ? 'Choose cash or e-transfer'
        : draft.kind === 'debt'
          ? `Add ${money(cents)} to the tab`
          : `Record ${money(cents)} payment`;
  }

  // ───────── Render: history ─────────

  function renderHistory() {
    const all = live();
    let run = 0;
    const rows = all.map((e) => ({ e, run: (run += delta(e)) }));

    el.count.textContent = all.length ? `${all.length} ${all.length === 1 ? 'entry' : 'entries'}` : '';

    // filters only for things that actually appear
    const used = new Set(all.map((e) => e.tag).filter(Boolean));
    const hasPayout = all.some((e) => e.kind === 'payout');
    const opts = [['all', 'All']];
    if (hasPayout) opts.push(['payout', 'Payments']);
    for (const t of TAGS) if (used.has(t.id)) opts.push([t.id, t.label]);
    if (!opts.some(([id]) => id === filter)) filter = 'all';
    el.filters.innerHTML = opts.length > 2
      ? opts.map(([id, label]) => `<button type="button" class="filter" data-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')
      : '';

    const match = (e) => filter === 'all' || (filter === 'payout' ? e.kind === 'payout' : e.tag === filter);
    const shownRows = rows.filter((r) => match(r.e)).reverse();

    if (filter !== 'all' && shownRows.length) {
      const n = shownRows.length;
      if (filter === 'payout') {
        const total = shownRows.reduce((s, r) => s + r.e.amount, 0);
        el.summary.innerHTML = `<b>${money(total)}</b> paid back across ${n}`;
      } else {
        const sub = shownRows.reduce((s, r) => s + delta(r.e), 0);
        const d = debtorOf(sub);
        el.summary.innerHTML = d
          ? `${TAG[filter].label} overall: <b>${esc(name(d))}</b> is down <b>${money(sub)}</b> across ${n}`
          : `${TAG[filter].label} overall: dead even across ${n}`;
      }
      el.summary.hidden = false;
    } else {
      el.summary.hidden = true;
    }

    if (!all.length) {
      el.ledger.innerHTML = `<div class="empty"><strong>No entries yet</strong>Add the first one above.</div>`;
      return;
    }

    let html = '';
    let lastDay = '';
    for (const { e, run } of shownRows) {
      const day = dayLabel(e.ts);
      if (day !== lastDay) { html += `<h3 class="day">${esc(day)}</h3>`; lastDay = day; }
      const label = labelOf(e);
      const subPrefix = e.note && label ? `${esc(label)} · ` : '';
      const lean = run / (Math.abs(run) + 5000);
      const runText = run ? `${name(debtorOf(run))} down ${money(run)}` : 'Even';
      html += `
        <button type="button" class="row${e.id === freshId ? ' fresh' : ''}" data-id="${e.id}">
          <span class="row-icon${e.kind === 'payout' ? ' payout' : ''}">${icon(iconOf(e))}</span>
          <span class="row-main">
            <span class="row-title">${esc(titleOf(e))}</span>
            <span class="row-sub">${subPrefix}${esc(sentence(e))} · ${timeLabel(e.ts)}</span>
          </span>
          <span class="row-amt">
            <span class="amt">${money(e.amount)}</span>
            <span class="mini" title="After this: ${esc(runText)}"><i style="left:${50 - lean * 46}%"></i></span>
          </span>
        </button>`;
    }
    el.ledger.innerHTML = html;
    freshId = null;
  }

  function render() {
    renderTable();
    renderComposer();
    renderHistory();
  }

  // ───────── Toast ─────────

  let toastTimer = 0;
  function toast(text, undo) {
    clearTimeout(toastTimer);
    $('.toast-text', el.toast).textContent = text;
    const action = $('.toast-action', el.toast);
    action.hidden = !undo;
    action.onclick = undo ? () => { undo(); el.toast.classList.remove('show'); } : null;
    el.toast.classList.add('show');
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), undo ? 5000 : 2600);
  }

  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch {} };

  // ───────── Dialogs ─────────

  function closeOnBackdrop(dialog) {
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close('cancel'); });
  }

  const confirmDlg = $('#confirm');
  closeOnBackdrop(confirmDlg);
  function ask(title, body, okLabel, { danger = false } = {}) {
    $('#confirmTitle').textContent = title;
    $('#confirmBody').textContent = body;
    const ok = $('#confirmOk');
    ok.textContent = okLabel;
    ok.classList.toggle('destructive', danger);
    confirmDlg.returnValue = '';
    confirmDlg.showModal();
    return new Promise((resolve) => {
      confirmDlg.addEventListener('close', () => resolve(confirmDlg.returnValue === 'ok'), { once: true });
    });
  }

  // entry detail
  const entryDlg = $('#entry');
  closeOnBackdrop(entryDlg);
  function openEntry(id) {
    const e = state.entries.find((x) => x.id === id);
    if (!e) return;
    const d = new Date(e.ts);
    const label = labelOf(e);
    $('#entryBody').innerHTML = `
      <header class="sheet-head">
        <h3>${e.kind === 'payout' ? 'Payment' : 'Debt'}</h3>
        <button class="icon-btn" value="close" aria-label="Close"><svg viewBox="0 0 24 24" class="i" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </header>
      <div class="detail-amt">${money(e.amount)}</div>
      <p class="detail-sentence">${esc(sentence(e))}</p>
      <dl class="detail-list">
        <div><dt>${e.kind === 'payout' ? 'Method' : 'Tag'}</dt><dd>${label ? esc(label) : '—'}</dd></div>
        <div><dt>Note</dt><dd>${e.note ? esc(e.note) : '—'}</dd></div>
        <div><dt>When</dt><dd>${esc(d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))}, ${timeLabel(e.ts)}</dd></div>
      </dl>
      <button type="button" class="danger-btn" data-delete="${e.id}">Delete this entry</button>`;
    entryDlg.showModal();
  }
  entryDlg.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-delete]');
    const e = btn && state.entries.find((x) => x.id === btn.dataset.delete);
    if (!e) return;
    e.deleted = Date.now();
    save();
    entryDlg.close();
    render();
    changed(`Delete: ${sentence(e)} ${money(e.amount)}`);
    toast('Entry deleted', () => { delete e.deleted; save(); render(); });
  });

  // settings
  const settings = $('#settings');
  closeOnBackdrop(settings);
  $('#openSettings').addEventListener('click', () => {
    $('#nameA').value = state.players.a;
    $('#nameB').value = state.players.b;
    $('#tokenInput').value = getToken();
    settings.showModal();
  });
  for (const [id, seat] of [['#nameA', 'a'], ['#nameB', 'b']]) {
    $(id).addEventListener('input', (e) => {
      state.players[seat] = e.target.value.trim() || DEFAULT_NAMES[seat];
      save();
      render();
    });
  }

  $('#wipeBtn').addEventListener('click', async () => {
    settings.close();
    const ok = await ask('Clear everything?', 'Every debt and payment on this device will be removed. This can’t be undone.', 'Clear all', { danger: true });
    if (!ok) return;
    // tombstones, so the clear reaches the other phone too
    const now = Date.now();
    for (const e of state.entries) if (!e.deleted) e.deleted = now;
    save();
    render();
    changed('Clear everything');
    toast('Cleared');
  });

  // ───────── GitHub sync ─────────
  // The shared tab is data.json on the repo's `data` branch. Anyone can read it;
  // saving needs a fine-grained token with Contents read/write on this repo.

  const REMOTE = { owner: 'markg-05', repo: 'debt-tracker', branch: 'data', path: 'data.json' };
  const API = `https://api.github.com/repos/${REMOTE.owner}/${REMOTE.repo}/contents/${REMOTE.path}`;
  const TOKEN_KEY = 'marker.token';
  const SAVE_DELAY = 6000; // longer than the undo window, so undone actions never leave the device

  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
  const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

  const toB64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };
  const fromB64 = (b64) =>
    new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (ch) => ch.charCodeAt(0)));

  function clean(e) {
    if (!e || typeof e.id !== 'string' || !Number.isInteger(e.amount) || e.amount <= 0) return null;
    if (!['debt', 'payout'].includes(e.kind) || !['a', 'b'].includes(e.from) || !Number.isFinite(e.ts)) return null;
    const out = {
      id: e.id.slice(0, 40), kind: e.kind, from: e.from, amount: e.amount,
      note: String(e.note || '').slice(0, 80), ts: e.ts,
    };
    if (e.kind === 'debt') out.tag = TAG[e.tag] ? e.tag : null;
    else out.method = METHOD[e.method] ? e.method : null;
    if (e.deleted) out.deleted = Number(e.deleted) || Date.now();
    return out;
  }

  // fold entries in: new ids are added, deletions win. Returns whether anything changed.
  function absorb(list) {
    const byId = new Map(state.entries.map((e) => [e.id, e]));
    let changed = false;
    for (const e of list) {
      const cur = byId.get(e.id);
      if (!cur) { byId.set(e.id, e); changed = true; }
      else if (e.deleted && !cur.deleted) { cur.deleted = e.deleted; changed = true; }
    }
    if (changed) state.entries = [...byId.values()];
    return changed;
  }

  // does this device have anything the file is missing?
  function ahead(remote) {
    const byId = new Map(remote.map((e) => [e.id, e]));
    return state.entries.some((e) => {
      const r = byId.get(e.id);
      return !r || (e.deleted && !r.deleted);
    });
  }

  async function gh(url, opts = {}) {
    const token = getToken();
    return fetch(url, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  }

  async function pullRemote() {
    const res = await gh(`${API}?ref=${REMOTE.branch}`);
    if (res.status === 404) return { sha: null, entries: [] };
    if (!res.ok) throw Object.assign(new Error('pull'), { status: res.status });
    const file = await res.json();
    const data = JSON.parse(fromB64(file.content) || '{}');
    return { sha: file.sha, entries: (data.entries || []).map(clean).filter(Boolean) };
  }

  const serialize = () => JSON.stringify({
    v: 1,
    players: state.players,
    entries: [...state.entries].sort((x, y) => x.ts - y.ts),
  }, null, 2) + '\n';

  const sync = { status: 'idle', at: 0, error: 0 };
  let syncing = null;
  let again = false;
  let saveTimer = 0;
  let commitMessage = '';

  function setStatus(status, error = 0) {
    sync.status = status;
    sync.error = error;
    if (status === 'ok') sync.at = Date.now();
    renderSyncStatus();
  }

  const needsToken = () => sync.status === 'readonly' || (sync.status === 'error' && [401, 403].includes(sync.error));

  function renderSyncStatus() {
    const btn = $('#syncBtn');
    const time = sync.at ? new Date(sync.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    const [label, title] = {
      idle: ['Not synced', 'Tap to sync'],
      pending: ['Saving…', 'Saves a few seconds after each change'],
      syncing: ['Syncing…', 'Talking to GitHub'],
      ok: [`Synced ${time}`, 'Tap to check for new entries'],
      readonly: ['Read-only', 'Add a GitHub token in Settings to save changes'],
      error: sync.error === 401 || sync.error === 403
        ? ['Token rejected', 'GitHub rejected the token — check it in Settings']
        : ['Offline', 'Couldn’t reach GitHub. Changes are kept here; tap to retry'],
    }[sync.status];
    $('#syncStatus').textContent = label;
    btn.title = title;
    btn.dataset.status = sync.status;
  }

  function syncNow() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (syncing) { again = true; return syncing; }
    syncing = (async () => {
      setStatus('syncing');
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const remote = await pullRemote();
          if (absorb(remote.entries)) { save(); render(); }
          if (!ahead(remote.entries)) { commitMessage = ''; setStatus('ok'); return; }
          if (!getToken()) { setStatus('readonly'); return; }
          const res = await gh(API, {
            method: 'PUT',
            body: JSON.stringify({
              message: commitMessage || 'Update tab',
              content: toB64(serialize()),
              branch: REMOTE.branch,
              ...(remote.sha ? { sha: remote.sha } : {}),
            }),
          });
          if (res.ok) { commitMessage = ''; setStatus('ok'); return; }
          // someone else saved first: pull their version and try again
          if (res.status !== 409 && res.status !== 422) throw Object.assign(new Error('push'), { status: res.status });
        }
        throw new Error('conflict');
      } catch (err) {
        setStatus('error', err.status || 0);
      } finally {
        syncing = null;
        if (again) { again = false; syncNow(); }
      }
    })();
    return syncing;
  }

  // called after every change on this device
  function changed(message) {
    commitMessage = commitMessage ? 'Update tab' : message;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(syncNow, SAVE_DELAY);
    setStatus('pending');
  }

  // tapping the status syncs; if there's no working token, it opens Settings instead
  $('#syncBtn').addEventListener('click', () => {
    if (!needsToken()) { syncNow(); return; }
    $('#openSettings').click();
    $('#tokenInput').focus();
  });
  const tokenInput = $('#tokenInput');
  tokenInput.addEventListener('change', () => {
    setToken(tokenInput.value.trim());
    syncNow();
  });

  // ───────── Backup ─────────

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([serialize()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `the-tab-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    settings.close();
    try {
      const data = JSON.parse(await file.text());
      const list = (data.entries || []).map(clean).filter(Boolean);
      if (!absorb(list)) { toast('Nothing new in that backup'); return; }
      save();
      render();
      changed('Import backup');
      toast('Backup merged');
    } catch {
      toast('That file isn’t a backup from The Tab');
    }
  });

  // ───────── Composer events ─────────

  el.segment.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-kind]');
    if (!b || b.dataset.kind === draft.kind) return;
    draft.kind = b.dataset.kind;
    // a payment almost always comes from whoever is behind
    const debtor = debtorOf(balance());
    if (draft.kind === 'payout' && debtor) draft.from = debtor;
    renderComposer();
  });

  function swap() {
    draft.from = other(draft.from);
    el.swap.classList.toggle('spun');
    renderComposer();
  }
  el.swap.addEventListener('click', swap);
  el.fromBtn.addEventListener('click', swap);
  el.toBtn.addEventListener('click', swap);

  el.amount.addEventListener('input', () => {
    // digits and one decimal point, two places max
    let v = el.amount.value.replace(/[^0-9.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    if (v !== el.amount.value) el.amount.value = v;
    renderSubmit();
  });

  el.bumps.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-add]');
    if (!b) return;
    setAmount(parseAmount() + Number(b.dataset.add) * 100);
    buzz();
    renderSubmit();
  });

  el.tags.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tag]');
    if (!b) return;
    draft.tag = draft.tag === b.dataset.tag ? null : b.dataset.tag;
    for (const t of el.tags.children) t.setAttribute('aria-pressed', String(t.dataset.tag === draft.tag));
    if (draft.tag === 'other') el.note.focus();
  });

  el.methods.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-method]');
    if (!b) return;
    draft.method = b.dataset.method;
    for (const m of el.methods.children) m.setAttribute('aria-checked', String(m.dataset.method === draft.method));
    renderSubmit();
  });

  el.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const cents = parseAmount();
    if (!cents) { el.amount.focus(); return; }
    if (draft.kind === 'payout' && !draft.method) return;
    const entry = {
      id: uid(),
      kind: draft.kind,
      from: draft.from,
      amount: cents,
      note: el.note.value.trim(),
      ts: Date.now(),
    };
    if (draft.kind === 'debt') entry.tag = draft.tag;
    else entry.method = draft.method;
    state.entries.push(entry);
    save();
    freshId = entry.id;
    setAmount(0);
    el.note.value = '';
    draft.tag = null;
    draft.method = null;
    el.amount.blur();
    el.note.blur();
    buzz();
    render();
    changed(`${sentence(entry)} ${money(cents)}`);
    toast(`${sentence(entry)} ${money(cents)}`, () => {
      state.entries = state.entries.filter((x) => x.id !== entry.id);
      save();
      render();
    });
  });

  // Settle up fills in a full payment; picking cash or e-transfer finishes it.
  el.settle.addEventListener('click', () => {
    const net = balance();
    const debtor = debtorOf(net);
    if (!debtor) return;
    draft.kind = 'payout';
    draft.from = debtor;
    draft.method = null;
    setAmount(Math.abs(net));
    renderComposer();
    el.composer.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  // ───────── History events ─────────

  el.filters.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    renderHistory();
  });
  el.ledger.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openEntry(row.dataset.id);
  });

  // ───────── Boot ─────────

  render();
  syncNow();
  // pick up the other phone's changes when coming back to the app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !saveTimer) syncNow();
    if (document.visibilityState === 'hidden' && saveTimer) syncNow();
  });
  window.addEventListener('online', () => syncNow());
  // another tab of the app changed the tab
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    state = load();
    render();
  });
})();
