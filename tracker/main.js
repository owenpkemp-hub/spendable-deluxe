'use strict';
/* ===== Theme ===== */
function applyTheme() {
  const t = DB.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = dark ? '#0e1311' : '#f3f1ec';
}

/* ===== Actions (event delegation) ===== */
const ACTIONS = {
  tab(el) { ui.tab = el.dataset.tab; if (ui.tab !== 'activity') { ui.selecting = false; ui.selected.clear(); } render(); window.scrollTo(0, 0); if (el.dataset.focus) setTimeout(() => $('#search') && $('#search').focus(), 30); },
  'new-tx'(el) { openTxSheet({ cat: el.dataset.cat, kind: el.dataset.kind }); },
  'edit-tx'(el) { const sw = el.closest('.swipe'); if (sw && sw.dataset.justSwiped) return; if (sw && +$('.front', sw).dataset.off) { $('.front', sw).style.transform = ''; $('.front', sw).dataset.off = 0; return; } openTxSheet({ id: el.dataset.id }); },
  'delete-tx'(el) { deleteTx([el.dataset.id]); },
  process(el) {
    if (el.dataset.src === 'rec') { const r = S().recurring.find(x => x.id === el.dataset.id); processRecurringNow(el.dataset.id); commit(`Processed ${r ? r.name : ''}`); }
    else processPlanned(el.dataset.id);
    const top = sheetStack[sheetStack.length - 1]; if (top && top.refresh) top.refresh();
  },
  'hero-math'() { ui.showHeroMath = !ui.showHeroMath; render(); },
  calendar() { openCalendar(); },
  settings() { openSettings(); },
  'income-settings'() { openSettings(); SETTINGS.income(); },
  'new-rec'() { openRecSheet(null); },
  filter(el) { ui.filter = el.dataset.f; render(); },
  'filter-cat'(el) { if (!el.dataset.id) return; ui.tab = 'activity'; ui.filter = el.dataset.id === '_' ? 'all' : 'cat:' + el.dataset.id; ui.search = ''; render(); window.scrollTo(0, 0); },
  'select-mode'() { ui.selecting = !ui.selecting; ui.selected.clear(); render(); },
  'toggle-sel'(el) { const id = el.dataset.id; ui.selected.has(id) ? ui.selected.delete(id) : ui.selected.add(id); render(); },
  'select-all'() { const ids = filteredTx().map(t => t.id); if (ui.selected.size === ids.length) ui.selected.clear(); else ids.forEach(i => ui.selected.add(i)); render(); },
  'bulk-delete'() { if (!ui.selected.size) return; if (!confirm(`Delete ${ui.selected.size} transaction${ui.selected.size > 1 ? 's' : ''}?`)) return; const ids = [...ui.selected]; ui.selected.clear(); ui.selecting = false; deleteTx(ids); },
  'bud-nav'(el) { ui.budOff = Math.min(0, ui.budOff + +el.dataset.d); render(); },
  'edit-cat'(el) { openCatSheet(el.dataset.id); },
  'new-cat'() { openCatSheet(null); },
  'ins-mode'(el) { ui.insMode = el.dataset.m; ui.insOff = 0; ui.openInsight = null; render(); },
  'ins-nav'(el) { ui.insOff = Math.min(0, ui.insOff + +el.dataset.d); render(); },
  insight(el) { ui.openInsight = ui.openInsight === el.dataset.k ? null : el.dataset.k; render(); },
  'acc-sel'(el) { ui.accSel = el.dataset.id; render(); },
  'acc-range'(el) { ui.accRange = el.dataset.r; render(); },
  'edit-acc'(el) { openAccSheet(el.dataset.id); },
  'new-acc'() { openAccSheet(null); },
  'close-sheet'() { closeSheet(); },
  'ob-start'() {
    const sp = newSpace('Personal', $('#ob-cur').value);
    const bal = parseAmount($('#ob-bal').value); sp.accounts[0].opening = isNaN(bal) ? 0 : round2(bal);
    sp.income.mode = $('#ob-mode').value;
    if (sp.income.mode === 'recurring') {
      const amt = Math.abs(parseAmount($('#ob-amt').value)); const next = $('#ob-next').value;
      if (amt && isValidDate(next)) {
        const [freq, interval] = $('#ob-freq').value.split(':');
        sp.recurring.push({ id: uid(), name: 'Paycheck', kind: 'income', amount: round2(amt), categoryId: sp.categories.find(c => c.name === 'Salary').id, accountId: sp.accounts[0].id, freq, interval: +interval, anchor: parseD(next).getDate(), start: next, next, end: null, remind: false, active: true });
        if (freq === 'month') sp.periodStart = Math.min(28, parseD(next).getDate());
      }
    } else sp.income.expected = Math.abs(parseAmount($('#ob-exp').value)) || 0;
    processRecurring(); save(); render();
    toast('All set. Tap + to log a transaction');
  },
  'ob-sample'() { loadSample(); save(); render(); toast('Sample data loaded. Erase it any time in Settings'); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACTIONS[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('input', e => {
  if (e.target.id === 'search') {
    ui.search = e.target.value; const pos = e.target.selectionStart;
    render(); const s = $('#search'); s.focus(); try { s.setSelectionRange(pos, pos); } catch (err) { }
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheetStack.length) { closeSheet(); return; }
  if (sheetStack.length || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || e.metaKey || e.ctrlKey || e.altKey || !S()) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); openTxSheet({}); }
  else if (k === '/') { e.preventDefault(); ui.tab = 'activity'; render(); $('#search').focus(); }
  else if ('12345'.includes(k) && k) { ui.tab = ['home', 'activity', 'budget', 'insights', 'accounts'][+k - 1]; render(); }
});
document.addEventListener('click', e => { if (!e.target.closest('.swipe')) $$('.swipe .front').forEach(f => { if (+f.dataset.off) { f.style.transform = ''; f.dataset.off = 0; } }); }, true);

/* ===== URL actions (Apple Pay / Siri Shortcuts, PWA shortcuts) ===== */
function handleURL(params) {
  if (!S()) return;
  const sp = S();
  if (params.has('view')) { const v = params.get('view'); if (VIEWS[v]) { ui.tab = v; render(); } if (v === 'calendar') openCalendar(); }
  if (params.has('new')) { openTxSheet({ kind: ['expense', 'income', 'transfer'].includes(params.get('new')) ? params.get('new') : 'expense' }); }
  if (!params.has('add')) return;
  const amount = Math.abs(parseAmount(params.get('add')));
  const kind = params.get('type') === 'income' ? 'income' : 'expense';
  const note = (params.get('note') || params.get('merchant') || '').trim().slice(0, 120);
  let c = null;
  const cn = (params.get('category') || '').trim().toLowerCase();
  if (cn) c = sp.categories.find(x => x.kind === kind && x.name.toLowerCase() === cn) || sp.categories.find(x => x.kind === kind && x.name.toLowerCase().startsWith(cn));
  if (!c && note) { c = categoryForNote(note, kind); if (!c) { const s = noteSuggestions(note, kind)[0]; if (s) c = cat(s.categoryId); } }
  const an = (params.get('account') || '').trim().toLowerCase();
  const a = an ? sp.accounts.find(x => x.name.toLowerCase() === an) || sp.accounts.find(x => x.name.toLowerCase().includes(an)) : null;
  const tags = (params.get('tags') || '').split(/[,\s]+/).filter(Boolean);
  if (!amount || params.get('confirm') === '1' || (!c && kind === 'expense' && !sp.categories.some(x => /^other/i.test(x.name)))) {
    openTxSheet({ kind, amount: amount ? String(amount) : '', cat: c ? c.id : null, note });
    return;
  }
  if (!c) c = sp.categories.find(x => x.kind === kind && /^other/i.test(x.name)) || sp.categories.find(x => x.kind === kind);
  const t = { id: uid(), created: Date.now(), date: today(), amount: round2(amount), kind, categoryId: c ? c.id : null, accountId: (a || {}).id || defaultAccount(), toAccountId: null, note, tags, planned: false };
  sp.transactions.push(t); save(); render();
  const s = safeToSpend();
  toast(`Logged ${fmt(t.amount, acctCur(t.accountId))} ${c ? c.emoji + ' ' + c.name : ''} · ${fmt(Math.max(0, s.perDay))}/day left`, 'Edit', () => openTxSheet({ id: t.id }));
}

/* ===== Reminders ===== */
function checkReminders(force) {
  const sp = S(); if (!sp || !sp.reminders) return;
  const t = today(), horizon = addDays(t, sp.remindDays || 1);
  const due = upcoming(t, horizon).filter(u => u.src === 'rec' && u.first && u.remind !== false && u.kind !== 'income');
  const fresh = due.filter(u => { const k = sp.id + u.id + u.date; if (DB.notified[k] && !force) return false; DB.notified[k] = t; return true; });
  // forget old keys
  for (const [k, d] of Object.entries(DB.notified)) if (diffDays(d, t) > 60) delete DB.notified[k];
  save();
  if (!fresh.length) return;
  const text = fresh.map(u => `${u.name} ${fmt(u.amount, acctCur(u.accountId))} ${relDay(u.date).toLowerCase()}`).join(', ');
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('Upcoming payments', { body: text, icon: '../icons/icon-192.png', tag: 'spendable-due' })).catch(() => toast('Due soon: ' + text));
  } else toast('Due soon: ' + text, 'View', openCalendar);
}

/* ===== Sample data ===== */
function loadSample() {
  const sp = newSpace('Personal', guessCurrency());
  sp.name = 'Personal';
  const C = n => sp.categories.find(c => c.name === n).id;
  const chk = sp.accounts[0];
  const sav = { id: uid(), name: 'Savings', type: 'savings', currency: sp.currency, opening: 0, emoji: '🐷' };
  const card = { id: uid(), name: 'Credit card', type: 'credit', currency: sp.currency, opening: 0, emoji: '💳' };
  const cash = { id: uid(), name: 'Wallet', type: 'cash', currency: sp.currency, opening: 0, emoji: '💵' };
  sp.accounts.push(sav, card, cash);
  const t = today(); const start = addDays(t, -150); sp.created = start;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const rec = (name, kind, amount, cat, acc, freq, interval, first, to) => sp.recurring.push({ id: uid(), name, kind, amount, categoryId: cat ? C(cat) : null, accountId: acc.id, toAccountId: to ? to.id : null, freq, interval, anchor: parseD(first).getDate(), start: first, next: first, end: null, remind: true, active: true });
  const day1 = (off) => { const d = parseD(start); return ymd(new Date(d.getFullYear(), d.getMonth() + off, 1)); };
  // first payday: a Friday near start
  let pay = start; while (parseD(pay).getDay() !== 5) pay = addDays(pay, 1);
  rec('Paycheck', 'income', 2150, 'Salary', chk, 'week', 2, pay);
  rec('Rent', 'expense', 1250, 'Rent', chk, 'month', 1, day1(1));
  rec('Electricity', 'expense', 64, 'Utilities', chk, 'month', 1, addDays(day1(1), 11));
  rec('Phone plan', 'expense', 35, 'Phone & Internet', chk, 'month', 1, addDays(day1(1), 14));
  rec('Internet', 'expense', 49.99, 'Phone & Internet', chk, 'month', 1, addDays(day1(1), 19));
  rec('Netflix', 'expense', 15.49, 'Subscriptions', card, 'month', 1, addDays(day1(1), 6));
  rec('Spotify', 'expense', 11.99, 'Subscriptions', card, 'month', 1, addDays(day1(1), 21));
  rec('Gym membership', 'expense', 39, 'Fitness', card, 'month', 1, addDays(day1(1), 2));
  rec('Car insurance', 'expense', 410, 'Insurance', chk, 'month', 6, addDays(day1(1), 24));
  rec('Monthly savings', 'transfer', 300, null, chk, 'month', 1, addDays(day1(1), 1), sav);
  rec('Pay credit card', 'transfer', 450, null, chk, 'month', 1, addDays(day1(1), 26), card);
  const add = (date, amount, cat, acc, note, tags) => sp.transactions.push({ id: uid(), created: Date.now(), date, amount: round2(amount), kind: 'expense', categoryId: C(cat), accountId: acc.id, toAccountId: null, note, tags: tags || [], planned: false });
  for (let d = start; d <= t; d = addDays(d, 1)) {
    const dow = parseD(d).getDay();
    if (rnd() < .55) add(d, 3.8 + rnd() * 2.4, 'Coffee', rnd() < .7 ? card : cash, pick(['Corner Café', 'Bean There', 'Daily Grind', 'Corner Café']));
    if (dow === 6 || (dow === 3 && rnd() < .5)) add(d, 45 + rnd() * 90, 'Groceries', card, pick(['FreshMart', 'Green Grocer', 'FreshMart', 'Farmers market']));
    if (rnd() < .22) add(d, 14 + rnd() * 48, 'Dining Out', card, pick(['Noodle Bar', 'Taco Spot', 'Pizza Place', 'Sushi Go', 'Thai Garden']));
    if (dow >= 1 && dow <= 5 && rnd() < .35) add(d, 2.75 * (rnd() < .8 ? 2 : 1), 'Transport', card, 'Metro fare');
    if (rnd() < .07) add(d, 25 + rnd() * 110, 'Shopping', card, pick(['Online order', 'Bookshop', 'Hardware store', 'Clothing store']));
    if (rnd() < .06) add(d, 12 + rnd() * 40, 'Entertainment', card, pick(['Cinema', 'Concert tickets', 'Bowling', 'Museum']), rnd() < .3 ? ['weekend'] : []);
    if (rnd() < .03) add(d, 15 + rnd() * 60, 'Health', card, 'Pharmacy');
    if (rnd() < .02) add(d, 20 + rnd() * 60, 'Gifts', card, 'Birthday gift');
  }
  // a weekend trip
  const trip = addDays(t, -38);
  add(trip, 189, 'Travel', card, 'Train tickets', ['trip']); add(addDays(trip, 1), 240, 'Travel', card, 'Hotel', ['trip']); add(addDays(trip, 1), 62, 'Dining Out', card, 'Seaside Grill', ['trip']);
  sp.transactions.push({ id: uid(), created: Date.now(), date: addDays(t, -60), amount: 650, kind: 'income', categoryId: C('Freelance'), accountId: chk.id, toAccountId: null, note: 'Logo design project', tags: ['side-gig'], planned: false });
  sp.transactions.push({ id: uid(), created: Date.now(), date: addDays(t, -9), amount: 120, kind: 'transfer', categoryId: null, accountId: chk.id, toAccountId: cash.id, note: 'ATM withdrawal', tags: [], planned: false });
  // planned
  sp.transactions.push({ id: uid(), created: Date.now(), date: addDays(t, 4), amount: 85, kind: 'expense', categoryId: C('Health'), accountId: chk.id, toAccountId: null, note: 'Dentist', tags: [], planned: true });
  processRecurring();
  // Set openings so today's balances look realistic
  const target = { [chk.id]: 2380, [sav.id]: 6200, [card.id]: -412.37, [cash.id]: 64 };
  sp.accounts.forEach(a => a.opening = 0);
  const b0 = balances();
  sp.accounts.forEach(a => a.opening = round2(target[a.id] - b0[a.id]));
  const budgets = { Groceries: 520, 'Dining Out': 250, Coffee: 110, Transport: 120, Shopping: 200, Entertainment: 120, Subscriptions: 30, Fitness: 40, Utilities: 80, 'Phone & Internet': 90, Rent: 1250, Health: 60 };
  sp.categories.forEach(c => { if (budgets[c.name]) c.budget = budgets[c.name]; });
  sp.savingsGoal = 300; sp.reminders = false;
}

/* ===== Boot ===== */
loadDB();
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
if (DB.spaces && !DB.spaces[DB.active]) DB.active = Object.keys(DB.spaces)[0] || null;
if (S()) { const n = processRecurring(); save(); if (n) setTimeout(() => toast(`${n} recurring payment${n > 1 ? 's' : ''} logged`), 400); }
render();
(() => {
  const params = new URLSearchParams(location.search);
  if ([...params.keys()].length) { handleURL(params); history.replaceState(null, '', location.pathname); }
})();
setTimeout(() => checkReminders(), 800);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !S()) return;
  const n = processRecurring(); if (n) { save(); }
  if (!sheetStack.length) render();
  checkReminders();
});
// day rollover while open
let lastDay = today(); setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (S()) { processRecurring(); save(); if (!sheetStack.length) render(); } } }, 60000);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.deferredInstall = e; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
