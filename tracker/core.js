'use strict';
/* ===== Utilities ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + f(x), 0);
const round2 = v => Math.round(v * 100) / 100;

/* Dates are stored as local YYYY-MM-DD strings */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (s, n, anchorDay) => {
  const d = parseD(s); const day = anchorDay || d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last)); return ymd(t);
};
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const isValidDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseD(s)) && ymd(parseD(s)) === s;
function nextOcc(s, freq, interval = 1, anchor) {
  interval = Math.max(1, +interval || 1);
  switch (freq) {
    case 'day': return addDays(s, interval);
    case 'week': return addDays(s, 7 * interval);
    case 'year': return addMonths(s, 12 * interval, anchor);
    default: return addMonths(s, interval, anchor);
  }
}
const FREQ_LABEL = { day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] };
function freqText(r) {
  const n = +r.interval || 1;
  if (n === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[r.freq];
  if (n === 2 && r.freq === 'week') return 'Every 2 weeks';
  return `Every ${n} ${FREQ_LABEL[r.freq][1]}`;
}
const LOCALE = undefined;
const dfCache = {};
function fmtDate(s, opts = { month: 'short', day: 'numeric' }) {
  const k = JSON.stringify(opts);
  dfCache[k] = dfCache[k] || new Intl.DateTimeFormat(LOCALE, opts);
  return dfCache[k].format(parseD(s));
}
function relDay(s) {
  const d = diffDays(today(), s);
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  if (d === 1) return 'Tomorrow';
  if (d > 1 && d < 7) return fmtDate(s, { weekday: 'long' });
  return fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric', year: parseD(s).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/* Money */
const fmtCache = {};
function fmt(v, cur, opts = {}) {
  cur = cur || S().currency;
  const k = cur + '|' + (opts.compact ? 'c' : '') + (opts.sign ? 's' : '') + (opts.whole ? 'w' : '');
  let f = fmtCache[k];
  if (!f) {
    const o = { style: 'currency', currency: cur };
    if (opts.compact) o.notation = 'compact';
    if (opts.sign) o.signDisplay = 'exceptZero';
    if (opts.whole) { o.maximumFractionDigits = 0; o.minimumFractionDigits = 0; }
    try { f = new Intl.NumberFormat(LOCALE, o); }
    catch (e) { try { f = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur }); } catch (e2) { f = { format: x => cur + ' ' + x.toFixed(2) }; } }
    fmtCache[k] = f;
  }
  return f.format(Object.is(v, -0) ? 0 : v);
}
const pct = v => (isFinite(v) ? Math.round(v * 100) : 0) + '%';
/* Accepts "$12.50", "12,50 €", "1.234,56", "1,234.56", "-4" */
function parseAmount(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[\s  ']/g, '');
  const neg = /^\(.*\)$/.test(s) || /^-|-$|^[^\d]*-/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) {
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  } else if (lc > -1) {
    const parts = s.split(',');
    const after = s.length - lc - 1;
    s = (parts.length > 2 || after === 3) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (ld > -1 && s.split('.').length > 2) {
    s = s.replace(/\./g, '');
  }
  const v = parseFloat(s);
  return isNaN(v) ? NaN : (neg ? -v : v);
}

/* Currencies */
const CURRENCIES = (() => {
  let list = [];
  try { list = Intl.supportedValuesOf('currency'); } catch (e) { }
  if (!list.length) list = 'AED ARS AUD BDT BGN BRL CAD CHF CLP CNY COP CZK DKK EGP EUR GBP GHS HKD HUF IDR ILS INR ISK JPY KES KRW KWD LKR MAD MXN MYR NGN NOK NZD PEN PHP PKR PLN QAR RON RSD RUB SAR SEK SGD THB TRY TWD UAH USD VND ZAR'.split(' ');
  let names; try { names = new Intl.DisplayNames(LOCALE, { type: 'currency' }); } catch (e) { }
  return list.map(c => ({ code: c, name: names ? names.of(c) : c }));
})();

/* Emoji suggestions for new categories / accounts */
const EMOJI_HINTS = [
  [/grocer|supermarket|food shop|market/, '🛒'], [/rent|mortgage|home|house|housing/, '🏠'], [/electric|power|utilit|energy/, '💡'], [/water/, '🚰'], [/gas bill|heating/, '🔥'],
  [/internet|wifi|broadband/, '🌐'], [/phone|mobile|cell/, '📱'], [/fuel|petrol|gas/, '⛽'], [/car|auto|vehicle/, '🚗'], [/parking/, '🅿️'], [/transport|transit|bus|metro|train|subway|commute/, '🚆'],
  [/taxi|uber|lyft|ride/, '🚕'], [/flight|travel|trip|vacation|holiday/, '✈️'], [/hotel|airbnb|lodging/, '🏨'], [/coffee|cafe|café|starbucks/, '☕'], [/restaurant|dining|eat out|food|lunch|dinner/, '🍽️'],
  [/takeaway|takeout|delivery|pizza/, '🍕'], [/bar|beer|drinks|pub|alcohol|wine/, '🍺'], [/snack|candy|sweets/, '🍫'], [/shop|clothes|clothing|fashion|apparel/, '🛍️'], [/shoe/, '👟'],
  [/subscri|stream|netflix|spotify|music/, '📺'], [/movie|cinema|film|entertain/, '🎬'], [/game|gaming/, '🎮'], [/book|read/, '📚'], [/gym|fitness|sport|workout/, '🏋️'],
  [/health|doctor|medical|pharma|medicine/, '💊'], [/dental|dentist/, '🦷'], [/insur/, '🛡️'], [/beauty|hair|salon|cosmetic/, '💇'], [/pet|dog|cat|vet/, '🐾'],
  [/kid|child|baby|daycare|school/, '🧸'], [/education|course|tuition|class/, '🎓'], [/gift|present/, '🎁'], [/charity|donat/, '❤️'], [/tax/, '🧾'], [/loan|debt|credit/, '💳'],
  [/saving|emergency|fund/, '🐷'], [/invest|stock|crypto|broker/, '📈'], [/salary|paycheck|wage|pay/, '💼'], [/freelance|side|contract/, '🧑‍💻'], [/bonus/, '🎉'], [/refund|cashback/, '↩️'],
  [/dividend|interest/, '🏦'], [/cash|wallet/, '💵'], [/bank|checking|current/, '🏦'], [/card/, '💳'], [/electronic|tech|gadget|computer/, '💻'], [/furniture|decor/, '🛋️'],
  [/garden|plant/, '🪴'], [/repair|maintenance|tools/, '🔧'], [/laundry|clean/, '🧺'], [/hobby|craft|art/, '🎨'], [/music|concert/, '🎵'], [/wedding/, '💍'], [/fee|bank charge/, '🏧'], [/other|misc/, '📦']
];
function suggestEmoji(name) {
  const n = (name || '').toLowerCase();
  for (const [re, e] of EMOJI_HINTS) if (re.test(n)) return e;
  return n ? '🏷️' : '📦';
}

/* ===== Storage ===== */
const KEY = 'spendable-tracker-v1';
let DB = null;
function loadDB() {
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; }
  if (!DB || !DB.spaces) DB = { v: 1, theme: 'auto', active: null, spaces: {}, notified: {} };
  DB.notified = DB.notified || {};
  DB.installedAt = DB.installedAt || Date.now();
}
/* Two copies: localStorage (instant) + IndexedDB (sturdier, survives localStorage clears). */
let saveTimer = null, idbPending = null;
function save() {
  DB.savedAt = Date.now();
  const json = JSON.stringify(DB);
  try { localStorage.setItem(KEY, json); }
  catch (e) { toast('Could not save to local storage. Keeping a copy in the database instead'); }
  idbPending = json; clearTimeout(saveTimer); saveTimer = setTimeout(flushIDB, 250);
}
function flushIDB() { if (idbPending == null) return; const j = idbPending; idbPending = null; idbSet(j).catch(() => { }); }
function idbOpen() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open('spendable-tracker', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbSet(json) { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(json, KEY); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); }); }
async function idbGet() { const db = await idbOpen(); return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(KEY); r.onsuccess = () => { db.close(); res(r.result || null); }; r.onerror = () => rej(r.error); }); }
/* If the IndexedDB copy is newer (or localStorage was wiped), use it. */
async function recoverFromIDB() {
  try {
    const j = await idbGet(); if (!j) return false;
    const d = JSON.parse(j);
    if (!d || !d.spaces || !Object.keys(d.spaces).length) return false;
    if (Object.keys(DB.spaces).length && (d.savedAt || 0) <= (DB.savedAt || 0)) return false;
    DB = d; DB.notified = DB.notified || {};
    try { localStorage.setItem(KEY, j); } catch (e) { }
    return true;
  } catch (e) { return false; }
}
let storagePersisted = null;
async function requestPersistence() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return;
    storagePersisted = await navigator.storage.persisted();
    if (!storagePersisted) storagePersisted = await navigator.storage.persist();
  } catch (e) { }
}
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const S = () => DB.spaces[DB.active];

const DEFAULT_CATS = [
  ['Groceries', '🛒', 'need', 'Essentials'], ['Rent', '🏠', 'need', 'Bills'], ['Utilities', '💡', 'need', 'Bills'], ['Phone & Internet', '📱', 'need', 'Bills'],
  ['Transport', '🚆', 'need', 'Essentials'], ['Health', '💊', 'need', 'Essentials'], ['Insurance', '🛡️', 'need', 'Bills'],
  ['Dining Out', '🍽️', 'want', 'Lifestyle'], ['Coffee', '☕', 'want', 'Lifestyle'], ['Shopping', '🛍️', 'want', 'Lifestyle'], ['Entertainment', '🎬', 'want', 'Lifestyle'],
  ['Subscriptions', '📺', 'want', 'Bills'], ['Fitness', '🏋️', 'want', 'Lifestyle'], ['Travel', '✈️', 'want', 'Lifestyle'], ['Gifts', '🎁', 'want', 'Lifestyle'], ['Other', '📦', 'want', 'Other']
];
const DEFAULT_INCOME = [['Salary', '💼'], ['Freelance', '🧑‍💻'], ['Other Income', '💰']];

function newSpace(name, currency) {
  const id = uid();
  const sp = {
    id, name: name || 'Personal', currency: currency || guessCurrency(), rates: {}, periodStart: 1,
    created: today(),
    income: { mode: 'recurring', expected: 0 },
    savingsGoal: 0, remindDays: 1, reminders: false,
    accounts: [{ id: uid(), name: 'Checking', type: 'checking', currency: null, opening: 0, emoji: '🏦' }],
    categories: [
      ...DEFAULT_CATS.map(([n, e, nature, group]) => ({ id: uid(), name: n, emoji: e, kind: 'expense', nature, group, budget: 0 })),
      ...DEFAULT_INCOME.map(([n, e]) => ({ id: uid(), name: n, emoji: e, kind: 'income', group: 'Income', budget: 0 }))
    ],
    transactions: [], recurring: []
  };
  sp.accounts[0].currency = sp.currency;
  DB.spaces[id] = sp; DB.active = id;
  return sp;
}
function guessCurrency() {
  try {
    const loc = navigator.language || 'en-US';
    const region = (new Intl.Locale(loc).maximize().region) || 'US';
    const map = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', JP: 'JPY', CN: 'CNY', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', MX: 'MXN', BR: 'BRL', ZA: 'ZAR', SG: 'SGD', HK: 'HKD', KR: 'KRW', MA: 'MAD', AE: 'AED', SA: 'SAR', TR: 'TRY', RU: 'RUB', UA: 'UAH', ID: 'IDR', MY: 'MYR', PH: 'PHP', VN: 'VND', TH: 'THB', IL: 'ILS', EG: 'EGP', NG: 'NGN', AR: 'ARS', CL: 'CLP', CO: 'COP' };
    const eu = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
    return map[region] || (eu.includes(region) ? 'EUR' : 'USD');
  } catch (e) { return 'USD'; }
}

/* ===== Lookups ===== */
const acct = id => S().accounts.find(a => a.id === id);
const cat = id => S().categories.find(c => c.id === id);
const acctCur = id => (acct(id) || {}).currency || S().currency;
const catName = id => (cat(id) || { name: 'Uncategorized' }).name;
const catEmoji = id => (cat(id) || { emoji: '❔' }).emoji;
function toBase(amount, cur) { const sp = S(); if (!cur || cur === sp.currency) return amount; return amount * (+sp.rates[cur] || 1); }
function fromBase(amount, cur) { const sp = S(); if (!cur || cur === sp.currency) return amount; return amount / (+sp.rates[cur] || 1); }
const txBase = t => toBase(t.amount, acctCur(t.accountId));
const ACCOUNT_TYPES = { checking: 'Checking', savings: 'Savings', credit: 'Credit card', cash: 'Cash' };
const isLiquid = a => a && !a.archived && a.type !== 'savings';

/* Effects of a transaction on account balances: [[accountId, delta in that account's currency]] */
function txEffects(t) {
  if (t.kind === 'expense') return [[t.accountId, -t.amount]];
  if (t.kind === 'income') return [[t.accountId, t.amount]];
  const to = t.toAmount != null ? t.toAmount : fromBase(toBase(t.amount, acctCur(t.accountId)), acctCur(t.toAccountId));
  return [[t.accountId, -t.amount], [t.toAccountId, to]];
}
function balances(upTo) {
  const b = {};
  for (const a of S().accounts) b[a.id] = +a.opening || 0;
  for (const t of S().transactions) {
    if (t.planned || (upTo && t.date > upTo)) continue;
    for (const [id, d] of txEffects(t)) if (id in b) b[id] += d;
  }
  return b;
}
function balanceSeries(accId, from, to) {
  const accs = accId === 'all' ? S().accounts.filter(a => !a.archived) : [acct(accId)].filter(Boolean);
  const ids = new Set(accs.map(a => a.id));
  const conv = (amt, id) => accId === 'all' ? toBase(amt, acctCur(id)) : amt;
  let v = sum(accs, a => conv(+a.opening || 0, a.id));
  const delta = {};
  for (const t of S().transactions) {
    if (t.planned || t.date > to) continue;
    for (const [id, d] of txEffects(t)) {
      if (!ids.has(id)) continue;
      const c = conv(d, id);
      if (t.date < from) v += c; else delta[t.date] = (delta[t.date] || 0) + c;
    }
  }
  const pts = [];
  for (let d = from; d <= to; d = addDays(d, 1)) { v += delta[d] || 0; pts.push({ date: d, v: round2(v) }); }
  return pts;
}
function firstDate() {
  let f = S().created || today();
  for (const t of S().transactions) if (t.date < f) f = t.date;
  return f;
}

/* ===== Periods ===== */
function periodRange(off = 0, ref = today()) {
  const P = Math.min(28, Math.max(1, +S().periodStart || 1));
  const d = parseD(ref);
  let m = d.getMonth(); if (d.getDate() < P) m--;
  const s = ymd(new Date(d.getFullYear(), m + off, P));
  return [s, addDays(addMonths(s, 1, P), -1)];
}
function yearRange(off = 0) { const y = new Date().getFullYear() + off; return [`${y}-01-01`, `${y}-12-31`]; }
function periodLabel([s, e]) {
  if (s.endsWith('-01')) return fmtDate(s, { month: 'long', year: 'numeric' });
  return `${fmtDate(s)} – ${fmtDate(e, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
const txIn = (a, b, f) => S().transactions.filter(t => !t.planned && t.date >= a && t.date <= b && (!f || f(t)));

/* ===== Recurring ===== */
function processRecurring() {
  const t = today(); let n = 0;
  for (const r of S().recurring) {
    if (!r.active) continue;
    let guard = 0;
    while (r.next <= t && (!r.end || r.next <= r.end) && guard++ < 1000) {
      S().transactions.push(recToTx(r, r.next)); n++;
      r.next = nextOcc(r.next, r.freq, r.interval, r.anchor);
    }
    if (r.end && r.next > r.end) r.active = false;
  }
  return n;
}
function recToTx(r, date) {
  return { id: uid(), date, amount: r.amount, kind: r.kind, categoryId: r.kind === 'transfer' ? null : r.categoryId, accountId: r.accountId, toAccountId: r.kind === 'transfer' ? r.toAccountId : null, note: r.name, tags: r.tags || [], planned: false, recurringId: r.id, created: Date.now() };
}
function processRecurringNow(rid) {
  const r = S().recurring.find(x => x.id === rid); if (!r) return;
  S().transactions.push(recToTx(r, today()));
  r.next = nextOcc(r.next, r.freq, r.interval, r.anchor);
  if (r.end && r.next > r.end) r.active = false;
}
/* Upcoming items (recurring occurrences + planned transactions) between from..to. Overdue planned are included. */
function upcoming(from, to) {
  const out = [];
  for (const r of S().recurring) {
    if (!r.active) continue;
    let d = r.next, g = 0, first = true;
    while (d <= to && (!r.end || d <= r.end) && g++ < 400) {
      if (d >= from) out.push({ src: 'rec', id: r.id, date: d, name: r.name, amount: r.amount, kind: r.kind, categoryId: r.categoryId, accountId: r.accountId, toAccountId: r.toAccountId, first, remind: r.remind });
      first = false;
      d = nextOcc(d, r.freq, r.interval, r.anchor);
    }
  }
  for (const t of S().transactions) if (t.planned && t.date <= to) out.push({ src: 'plan', id: t.id, date: t.date, name: t.note || catName(t.categoryId), amount: t.amount, kind: t.kind, categoryId: t.categoryId, accountId: t.accountId, toAccountId: t.toAccountId, first: true });
  return out.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
}

/* ===== Income & safe to spend ===== */
function nextPayday() {
  const sp = S(), t = today();
  if (sp.income.mode === 'recurring') {
    let best = null;
    for (const r of sp.recurring) if (r.active && r.kind === 'income' && r.next > t && (!r.end || r.next <= r.end) && (!best || r.next < best)) best = r.next;
    if (best) return { date: best, source: 'payday' };
  }
  return { date: addDays(periodRange(0)[1], 1), source: 'period' };
}
function safeToSpend() {
  const sp = S(), t = today();
  const pay = nextPayday();
  const days = Math.max(1, diffDays(t, pay.date));
  const bal = balances();
  const liquidAccs = sp.accounts.filter(isLiquid);
  const cash = sum(liquidAccs, a => toBase(bal[a.id], a.currency));
  const ups = upcoming(t, addDays(pay.date, -1));
  const isSav = id => (acct(id) || {}).type === 'savings';
  const bills = sum(ups.filter(u => u.kind === 'expense' && isLiquid(acct(u.accountId))), u => toBase(u.amount, acctCur(u.accountId)));
  const savingsRec = sum(ups.filter(u => u.kind === 'transfer' && isSav(u.toAccountId) && isLiquid(acct(u.accountId))), u => toBase(u.amount, acctCur(u.accountId)));
  const [ps, pe] = periodRange(0);
  const savedThisPeriod = sum(txIn(ps, pe, x => x.kind === 'transfer' && isSav(x.toAccountId) && isLiquid(acct(x.accountId))), txBase);
  const goalLeft = Math.max(0, (+sp.savingsGoal || 0) - savedThisPeriod - savingsRec);
  const savings = savingsRec + goalLeft;
  const safe = cash - bills - savings;
  const spentToday = sum(txIn(t, t, x => x.kind === 'expense' && isLiquid(acct(x.accountId))), txBase);
  const perDay = safe / days;
  const todayLeft = (safe + spentToday) / days - spentToday;
  const incomeThisPeriod = sum(txIn(ps, pe, x => x.kind === 'income'), txBase);
  return { cash, bills, savings, safe, perDay, days, pay, spentToday, todayLeft, billsItems: ups.filter(u => u.kind === 'expense'), incomeThisPeriod };
}

/* Spending by category in base currency */
function spendByCat(a, b) {
  const m = {};
  for (const t of txIn(a, b, x => x.kind === 'expense')) m[t.categoryId || '_'] = (m[t.categoryId || '_'] || 0) + txBase(t);
  return m;
}
function totals(a, b) {
  const tx = txIn(a, b);
  const income = sum(tx.filter(t => t.kind === 'income'), txBase);
  const expense = sum(tx.filter(t => t.kind === 'expense'), txBase);
  const toSavings = sum(tx.filter(t => t.kind === 'transfer' && (acct(t.toAccountId) || {}).type === 'savings'), txBase);
  return { income, expense, toSavings, net: income - expense };
}

/* Note suggestions based on history */
function noteSuggestions(prefix, kind) {
  const p = (prefix || '').toLowerCase().trim();
  const m = new Map();
  for (const t of S().transactions) {
    if (!t.note || (kind && t.kind !== kind)) continue;
    const k = t.note.trim(); if (!k) continue;
    if (p && !k.toLowerCase().includes(p)) continue;
    if (k.toLowerCase() === p) continue;
    const e = m.get(k) || { note: k, n: 0, last: '', categoryId: t.categoryId, amount: t.amount };
    e.n++; if (t.date >= e.last) { e.last = t.date; e.categoryId = t.categoryId; e.amount = t.amount; }
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => (p ? (b.note.toLowerCase().startsWith(p) - a.note.toLowerCase().startsWith(p)) : 0) || b.n - a.n).slice(0, 5);
}
/* Category last used with this exact description (case-insensitive) */
function categoryForNote(note, kind) {
  const n = (note || '').trim().toLowerCase(); if (!n) return null;
  let best = null;
  for (const t of S().transactions) if (t.kind === kind && t.categoryId && (t.note || '').trim().toLowerCase() === n && (!best || t.date >= best.date)) best = t;
  return best ? cat(best.categoryId) : null;
}
function topCategories(kind = 'expense', n = 6) {
  const cnt = {};
  const since = addDays(today(), -60);
  for (const t of S().transactions) if (t.kind === kind && t.date >= since && t.categoryId) cnt[t.categoryId] = (cnt[t.categoryId] || 0) + 1;
  const cats = S().categories.filter(c => c.kind === kind && !c.archived);
  return cats.sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0)).slice(0, n);
}

/* ===== CSV ===== */
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  const delim = (() => { const line = text.split(/\r?\n/)[0] || ''; const c = { ',': 0, ';': 0, '\t': 0 }; let inq = false; for (const ch of line) { if (ch === '"') inq = !inq; else if (!inq && ch in c) c[ch]++; } return Object.entries(c).sort((a, b) => b[1] - a[1])[0][1] ? Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] : ','; })();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else f += ch;
  }
  row.push(f); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function parseDateFlexible(s, fmtHint) {
  s = String(s || '').trim().slice(0, 10).trim();
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return mk(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let [, a, b, y] = m; if (y.length === 2) y = '20' + y;
    if (fmtHint === 'dmy' || (+a > 12 && fmtHint !== 'mdy')) return mk(y, b, a);
    return mk(y, a, b);
  }
  const d = new Date(s); if (!isNaN(d)) return ymd(d);
  return null;
  function mk(y, mo, d) { const r = `${y}-${pad(+mo)}-${pad(+d)}`; return isValidDate(r) ? r : null; }
}
