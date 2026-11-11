'use strict';
/* ===== Sheet stack ===== */
const sheetStack = [];
function openSheet(title, html, { left = 'Cancel', right = null, onRight = null, onMount = null, onClose = null, tall = false } = {}) {
  const root = $('#sheets');
  if (!sheetStack.length) root.innerHTML = '<div class="backdrop" data-act="close-sheet"></div>';
  sheetStack.forEach(s => s.el.style.display = 'none');
  const el = document.createElement('div');
  el.className = 'sheet' + (tall ? ' tall' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="drag-zone"><div class="grab"></div><div class="sheet-h"><button data-act="close-sheet">${sheetStack.length && left === 'Cancel' ? '‹ Back' : esc(left)}</button><h3>${esc(title)}</h3><button class="r" data-role="right" ${right ? '' : 'tabindex="-1" aria-hidden="true"'}>${right ? esc(right) : ''}</button></div></div><div class="sheet-b">${html}</div>`;
  root.appendChild(el);
  const entry = { el, onClose };
  sheetStack.push(entry);
  if (right && onRight) $('[data-role=right]', el).onclick = () => onRight(el);
  if (onMount) onMount(el);
  lockScroll(true);
  bindSheetDrag(el);
  $('#toast').classList.remove('show');
  return el;
}
/* Keep the page behind a sheet from scrolling (iOS ignores overflow:hidden on body) */
let savedScroll = 0;
function lockScroll(on) {
  const b = document.body;
  if (on && !b.classList.contains('sheet-open')) { savedScroll = window.scrollY; b.style.top = `-${savedScroll}px`; b.classList.add('sheet-open'); }
  else if (!on && b.classList.contains('sheet-open')) { b.classList.remove('sheet-open'); b.style.top = ''; window.scrollTo(0, savedScroll); }
}
/* Drag the handle/header down to dismiss, like a native sheet */
function bindSheetDrag(el) {
  const zone = $('.drag-zone', el); let y0 = null, dy = 0;
  zone.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; el.classList.add('dragging'); zone.setPointerCapture(e.pointerId); });
  zone.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
  const end = () => {
    if (y0 == null) return; y0 = null; el.classList.remove('dragging');
    if (dy > 90) { el.style.transform = 'translateY(100%)'; setTimeout(() => { if (sheetStack.length && sheetStack[sheetStack.length - 1].el === el) closeSheet(); }, 180); }
    else el.style.transform = '';
  };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
}
function closeSheet(all = false) {
  do {
    const s = sheetStack.pop(); if (!s) break;
    s.el.remove(); if (s.onClose) s.onClose();
  } while (all && sheetStack.length);
  const top = sheetStack[sheetStack.length - 1];
  if (top) { top.el.style.display = ''; if (top.refresh) top.refresh(); }
  else { $('#sheets').innerHTML = ''; lockScroll(false); }
}
function refreshTopSheet(builder) { const s = sheetStack[sheetStack.length - 1]; if (s) $('.sheet-b', s.el).innerHTML = builder(); }

let toastTimer;
function toast(msg, action, fn) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) $('button', t).onclick = () => { t.classList.remove('show'); fn(); };
  t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2600);
}
function commit(msg) { save(); render(); if (msg) toast(msg); }
const accOptions = (sel, filter = () => true) => S().accounts.filter(a => (!a.archived || a.id === sel) && filter(a)).map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.emoji || ''} ${esc(a.name)}${a.currency !== S().currency ? ' (' + a.currency + ')' : ''}</option>`).join('');
const defaultAccount = () => (S().accounts.find(a => !a.archived && a.type === 'checking') || S().accounts.find(a => !a.archived) || {}).id;

/* ===== Transaction sheet ===== */
function openTxSheet(opts = {}) {
  const editing = opts.id ? S().transactions.find(t => t.id === opts.id) : null;
  const st = editing ? { ...editing, tags: [...(editing.tags || [])] } : {
    kind: opts.kind || (opts.cat && (cat(opts.cat) || {}).kind) || 'expense', amount: opts.amount || '', categoryId: opts.cat || null, accountId: defaultAccount(),
    toAccountId: null, date: opts.date || today(), note: opts.note || '', tags: [], planned: !!opts.date && opts.date > today(), repeat: 'none'
  };
  if (st.kind === 'transfer' && !st.toAccountId) st.toAccountId = (S().accounts.find(a => !a.archived && a.id !== st.accountId && a.type === 'savings') || S().accounts.find(a => !a.archived && a.id !== st.accountId) || {}).id;
  let more = !!editing || !!opts.date;
  const body = () => {
    const cats = S().categories.filter(c => c.kind === st.kind && (!c.archived || c.id === st.categoryId));
    const sugg = st.kind !== 'transfer' ? noteSuggestions(st.note, st.kind).slice(0, 4) : [];
    return `<div class="seg">${['expense', 'income', 'transfer'].map(k => `<button data-k="${k}" class="${st.kind === k ? 'on' : ''}">${{ expense: 'Expense', income: 'Income', transfer: 'Transfer' }[k]}</button>`).join('')}</div>
      <input class="amount-in num" id="tx-amt" inputmode="decimal" placeholder="0" value="${esc(st.amount)}" autocomplete="off">
      <div class="amount-cur">${esc(acctCur(st.accountId))}</div>
      <label class="field" style="margin-top:12px"><span>${st.kind === 'transfer' ? 'Note' : 'Description'}</span><input class="input" id="tx-note" placeholder="${st.kind === 'income' ? 'e.g. Paycheck' : st.kind === 'transfer' ? 'Optional' : 'e.g. Corner Café'}" value="${esc(st.note)}" autocomplete="off"></label>
      <div class="sugg" id="tx-sugg">${sugg.map(s => `<button data-note="${esc(s.note)}" data-cat="${s.categoryId || ''}">${esc(catEmoji(s.categoryId))} ${esc(s.note)}</button>`).join('')}</div>
      ${st.kind === 'transfer' ? (S().accounts.filter(a => !a.archived).length < 2 ? `<div class="card row" style="margin:4px 0 12px"><div class="emoji">🏦</div><div class="grow"><div style="font-weight:650">Add a second account</div><div class="small muted">Transfers move money between your accounts, like checking to savings.</div></div><button class="mini-btn" data-addacc="1">Add</button></div>`
      : `<div class="two"><label class="field"><span>From</span><select class="input" id="tx-acc">${accOptions(st.accountId)}</select></label><label class="field"><span>To</span><select class="input" id="tx-to">${accOptions(st.toAccountId, a => a.id !== st.accountId)}</select></label></div>`)
      : `<div class="cat-grid">${cats.map(c => `<button data-cat="${c.id}" class="${st.categoryId === c.id ? 'on' : ''}"><span class="em">${c.emoji}</span><span>${esc(c.name)}</span></button>`).join('')}<button data-newcat="1"><span class="em">＋</span><span>New</span></button></div>
        ${!editing && !more ? '<div class="hint">Tap a category to save instantly</div>' : ''}`}
      ${more ? `<div class="two">
          <label class="field"><span>Date</span><input class="input" type="date" id="tx-date" value="${st.date}"></label>
          ${st.kind !== 'transfer' ? `<label class="field"><span>Account</span><select class="input" id="tx-acc">${accOptions(st.accountId)}</select></label>` : '<span></span>'}
        </div>
        <label class="field"><span>Tags (comma separated)</span><input class="input" id="tx-tags" value="${esc(st.tags.join(', '))}" placeholder="work, trip-2026"></label>
        ${!editing ? `<label class="field"><span>Repeat</span><select class="input" id="tx-rep">${[['none', 'Never'], ['week:1', 'Every week'], ['week:2', 'Every 2 weeks'], ['month:1', 'Every month'], ['month:3', 'Every 3 months'], ['year:1', 'Every year']].map(([v, l]) => `<option value="${v}" ${st.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
        <label class="toggle"><input type="checkbox" id="tx-plan" ${st.planned ? 'checked' : ''}><span>Planned — doesn't touch balances until processed${st.date > today() ? '' : ''}</span></label>`
      : `<button class="more-toggle" data-more="1">Date, account, tags &amp; repeat ›</button>`}
      ${editing ? `<div class="two" style="margin-top:4px">${editing.planned ? '<button class="btn ghost" data-proc="1">Mark as paid</button>' : '<button class="btn ghost" data-dup="1">Duplicate</button>'}<button class="btn danger" data-del="1">Delete</button></div>` : ''}
      <div class="sheet-foot"><button class="btn" data-save="1">${editing ? 'Save changes' : 'Add ' + st.kind}</button></div>`;
  };
  const read = el => {
    const v = id => { const x = $('#' + id, el); return x ? x.value : undefined; };
    st.amount = v('tx-amt'); st.note = v('tx-note');
    if (v('tx-date') !== undefined) st.date = v('tx-date') || today();
    if (v('tx-acc') !== undefined) st.accountId = v('tx-acc');
    if (v('tx-to') !== undefined) st.toAccountId = v('tx-to');
    if (v('tx-tags') !== undefined) st.tags = v('tx-tags').split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);
    if (v('tx-rep') !== undefined) st.repeat = v('tx-rep');
    const p = $('#tx-plan', el); if (p) st.planned = p.checked;
  };
  const doSave = el => {
    read(el);
    const amt = Math.abs(parseAmount(st.amount));
    if (!amt) { toast('Enter an amount'); $('#tx-amt', el).focus(); return; }
    if (st.kind !== 'transfer' && !st.categoryId) { toast('Pick a category'); return; }
    if (st.kind === 'transfer' && (!st.toAccountId || st.toAccountId === st.accountId)) { toast(S().accounts.length < 2 ? 'Add a second account first' : 'Pick two different accounts'); return; }
    if (!isValidDate(st.date)) st.date = today();
    const planned = st.planned || st.date > today();
    const rec = { amount: round2(amt), kind: st.kind, categoryId: st.kind === 'transfer' ? null : st.categoryId, accountId: st.accountId, toAccountId: st.kind === 'transfer' ? st.toAccountId : null, date: st.date, note: (st.note || '').trim(), tags: st.tags, planned };
    if (editing) {
      Object.assign(editing, rec);
      if (rec.kind !== 'transfer') delete editing.toAmount;
    } else {
      const t = { id: uid(), created: Date.now(), ...rec };
      S().transactions.push(t);
      if (st.repeat && st.repeat !== 'none') {
        const [freq, interval] = st.repeat.split(':');
        const r = { id: uid(), name: rec.note || (rec.kind === 'transfer' ? 'Transfer' : catName(rec.categoryId)), kind: rec.kind, amount: rec.amount, categoryId: rec.categoryId, accountId: rec.accountId, toAccountId: rec.toAccountId, freq, interval: +interval, anchor: parseD(rec.date).getDate(), start: rec.date, next: nextOcc(rec.date, freq, +interval, parseD(rec.date).getDate()), end: null, remind: true, active: true, tags: rec.tags };
        S().recurring.push(r); t.recurringId = r.id;
      }
    }
    closeSheet(); commit(editing ? 'Saved' : `${rec.kind === 'income' ? 'Income' : rec.kind === 'transfer' ? 'Transfer' : 'Expense'} logged${planned ? ' as planned' : ''} · ${fmt(rec.amount, acctCur(rec.accountId))}`);
    if (!editing) { const last = S().transactions[S().transactions.length - 1]; toast(`Logged ${fmt(rec.amount, acctCur(rec.accountId))}${planned ? ' as planned' : ''}`, 'Undo', () => { S().transactions = S().transactions.filter(x => x !== last); if (last.recurringId && st.repeat !== 'none') S().recurring = S().recurring.filter(r => r.id !== last.recurringId); commit('Removed'); }); }
  };
  const el = openSheet(editing ? 'Edit transaction' : 'New transaction', body(), {
    tall: true,
    onMount: el => {
      const rebind = () => {
        const b = $('.sheet-b', el); b.innerHTML = body();
        const amt = $('#tx-amt', el);
        if (!editing && !st.amount) setTimeout(() => amt.focus(), 60);
        $('#tx-note', el).oninput = e => { st.note = e.target.value; const sugg = st.kind !== 'transfer' ? noteSuggestions(st.note, st.kind).slice(0, 4) : []; $('#tx-sugg', el).innerHTML = sugg.map(s => `<button data-note="${esc(s.note)}" data-cat="${s.categoryId || ''}">${esc(catEmoji(s.categoryId))} ${esc(s.note)}</button>`).join(''); };
        const acc = $('#tx-acc', el); if (acc) acc.onchange = () => { read(el); rebind(); };
      };
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || !el.contains(b) || b.closest('.sheet-h')) return;
        if (b.dataset.k) { read(el); st.kind = b.dataset.k; st.categoryId = null; if (st.kind === 'transfer' && !st.toAccountId) st.toAccountId = (S().accounts.find(a => !a.archived && a.id !== st.accountId) || {}).id; rebind(); }
        else if (b.dataset.more) { read(el); more = true; rebind(); }
        else if (b.dataset.addacc) { read(el); openAccSheet(null); sheetStack[sheetStack.length - 2].refresh = () => { st.accountId = st.accountId || defaultAccount(); st.toAccountId = (S().accounts.find(a => !a.archived && a.id !== st.accountId) || {}).id; rebind(); }; }
        else if (b.dataset.newcat) { read(el); openCatSheet(null, st.kind, c => { st.categoryId = c.id; rebind(); }); }
        else if (b.dataset.note != null) { read(el); st.note = b.dataset.note; if (b.dataset.cat && cat(b.dataset.cat)) st.categoryId = b.dataset.cat; rebind(); }
        else if (b.dataset.cat) { read(el); st.categoryId = b.dataset.cat; if (!editing && !more && Math.abs(parseAmount(st.amount)) > 0) doSave(el); else rebind(); }
        else if (b.dataset.save) doSave(el);
        else if (b.dataset.del) { closeSheet(); deleteTx([editing.id]); }
        else if (b.dataset.dup) { closeSheet(); const c = { ...editing, id: uid(), date: today(), created: Date.now(), recurringId: null, planned: false }; S().transactions.push(c); commit('Duplicated to today'); }
        else if (b.dataset.proc) { closeSheet(); processPlanned(editing.id); }
      });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); doSave(el); } });
      rebind();
    }
  });
  return el;
}
function deleteTx(ids) {
  const set = new Set(ids);
  const removed = S().transactions.filter(t => set.has(t.id));
  S().transactions = S().transactions.filter(t => !set.has(t.id));
  save(); render();
  toast(`Deleted ${removed.length} transaction${removed.length === 1 ? '' : 's'}`, 'Undo', () => { S().transactions.push(...removed); commit('Restored'); });
}
function processPlanned(id) {
  const t = S().transactions.find(x => x.id === id); if (!t) return;
  t.planned = false; if (t.date > today()) t.date = today();
  commit(`Processed ${t.note || catName(t.categoryId)}`);
}

/* ===== Recurring ===== */
function openRecSheet(id, preset = {}) {
  const r = id ? S().recurring.find(x => x.id === id) : null;
  const st = r ? { ...r } : { name: '', kind: preset.kind || 'expense', amount: '', categoryId: null, accountId: defaultAccount(), toAccountId: null, freq: 'month', interval: 1, next: addDays(today(), 1), end: '', remind: true, active: true };
  const body = () => {
    const cats = S().categories.filter(c => c.kind === st.kind && !c.archived);
    if (st.kind !== 'transfer' && !st.categoryId && cats[0]) st.categoryId = (cats.find(c => /subscri|rent|bill/i.test(c.name + c.group)) || cats[0]).id;
    if (st.kind === 'transfer' && !st.toAccountId) st.toAccountId = (S().accounts.find(a => a.type === 'savings' && a.id !== st.accountId) || S().accounts.find(a => a.id !== st.accountId) || {}).id;
    return `<div class="seg" style="margin-bottom:12px">${[['expense', 'Bill'], ['income', 'Income'], ['transfer', 'Transfer']].map(([k, l]) => `<button data-k="${k}" class="${st.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="field"><span>Name</span><input class="input" id="r-name" value="${esc(st.name)}" placeholder="${st.kind === 'income' ? 'Paycheck' : st.kind === 'transfer' ? 'Monthly savings' : 'Netflix, Rent, Gym…'}"></label>
    <label class="field"><span>Amount</span><input class="input num" id="r-amt" inputmode="decimal" value="${esc(st.amount)}" placeholder="0.00"></label>
    ${st.kind !== 'transfer' ? `<label class="field"><span>Category</span><select class="input" id="r-cat">${cats.map(c => `<option value="${c.id}" ${c.id === st.categoryId ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Account</span><select class="input" id="r-acc">${accOptions(st.accountId)}</select></label>`
      : `<div class="two"><label class="field"><span>From</span><select class="input" id="r-acc">${accOptions(st.accountId)}</select></label><label class="field"><span>To</span><select class="input" id="r-to">${accOptions(st.toAccountId, a => a.id !== st.accountId)}</select></label></div>`}
    <label class="field"><span>Repeats every</span><div class="two"><input class="input num" id="r-int" type="number" min="1" max="99" value="${st.interval}"><select class="input" id="r-freq">${Object.entries(FREQ_LABEL).map(([k, [s, p]]) => `<option value="${k}" ${st.freq === k ? 'selected' : ''}>${+st.interval === 1 ? s : p}</option>`).join('')}</select></div></label>
    <div class="two"><label class="field"><span>Next date</span><input class="input" type="date" id="r-next" value="${st.next}"></label><label class="field"><span>Ends (optional)</span><input class="input" type="date" id="r-end" value="${st.end || ''}"></label></div>
    <label class="toggle"><input type="checkbox" id="r-remind" ${st.remind ? 'checked' : ''}><span>Remind me ${S().remindDays || 1} day${(S().remindDays || 1) > 1 ? 's' : ''} before</span></label>
    ${r ? `<label class="toggle"><input type="checkbox" id="r-active" ${st.active ? 'checked' : ''}><span>Active</span></label>` : ''}
    <div class="small muted" style="margin:0 2px 10px">Logged automatically on each date, and counted in safe-to-spend before it happens.</div>
    ${r ? `<div class="two"><button class="btn ghost" data-proc="1">${st.kind === 'income' ? 'Mark received' : 'Mark next paid'}</button><button class="btn danger" data-del="1">Delete</button></div>` : ''}
    <div class="sheet-foot"><button class="btn" data-save="1">${r ? 'Save' : 'Add recurring'}</button></div>`;
  };
  const read = el => {
    const v = id => { const x = $('#' + id, el); return x ? x.value : undefined; };
    st.name = v('r-name'); st.amount = v('r-amt'); st.interval = Math.max(1, +v('r-int') || 1); st.freq = v('r-freq');
    st.next = v('r-next') || st.next; st.end = v('r-end') || null; st.remind = $('#r-remind', el).checked;
    if (v('r-cat') !== undefined) st.categoryId = v('r-cat');
    st.accountId = v('r-acc'); if (v('r-to') !== undefined) st.toAccountId = v('r-to');
    const a = $('#r-active', el); if (a) st.active = a.checked;
  };
  openSheet(r ? 'Recurring' : 'New recurring', body(), {
    tall: true,
    onMount: el => {
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.closest('.sheet-h')) return;
        if (b.dataset.k) { read(el); st.kind = b.dataset.k; st.categoryId = null; refreshTopSheet(body); }
        else if (b.dataset.save) {
          read(el);
          const amt = Math.abs(parseAmount(st.amount));
          if (!amt) return toast('Enter an amount');
          if (!isValidDate(st.next)) return toast('Pick a valid date');
          if (st.kind === 'transfer' && st.accountId === st.toAccountId) return toast('Pick two different accounts');
          const rec = { name: (st.name || '').trim() || (st.kind === 'transfer' ? 'Transfer' : catName(st.categoryId)), kind: st.kind, amount: round2(amt), categoryId: st.kind === 'transfer' ? null : st.categoryId, accountId: st.accountId, toAccountId: st.kind === 'transfer' ? st.toAccountId : null, freq: st.freq, interval: st.interval, next: st.next, anchor: parseD(st.next).getDate(), end: st.end, remind: st.remind, active: st.active };
          if (r) Object.assign(r, rec); else S().recurring.push({ id: uid(), start: st.next, ...rec });
          const n = processRecurring();
          closeSheet(); commit(n ? `Saved · logged ${n} due payment${n > 1 ? 's' : ''}` : 'Saved');
        }
        else if (b.dataset.proc) { processRecurringNow(r.id); closeSheet(); commit(`${r.kind === "income" ? "Received" : "Paid"}: ${r.name}`); }
        else if (b.dataset.del) { if (!confirm(`Delete "${r.name}"? Past transactions are kept.`)) return; S().recurring = S().recurring.filter(x => x !== r); closeSheet(); commit('Deleted'); }
      });
      el.addEventListener('change', e => { if (e.target.id === 'r-int' || e.target.id === 'r-acc') { read(el); refreshTopSheet(body); } });
    }
  });
}
function openRecList() {
  const body = () => {
    const rs = [...S().recurring].sort((a, b) => (b.active - a.active) || a.next.localeCompare(b.next));
    const monthly = r => { const f = { day: 30.44, week: 4.345, month: 1, year: 1 / 12 }[r.freq] / (r.interval || 1); return toBase(r.amount, acctCur(r.accountId)) * f; };
    const outM = sum(rs.filter(r => r.active && r.kind === 'expense'), monthly), inM = sum(rs.filter(r => r.active && r.kind === 'income'), monthly);
    return `<div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><div class="k">Bills per month</div><div class="v num">${fmt(outM)}</div></div><div class="kpi"><div class="k">Recurring income / mo</div><div class="v num pos">${fmt(inM)}</div></div></div>
    <div class="card flush">${rs.length ? `<ul class="list">${rs.map(r => `<li class="item tap" data-rec="${r.id}"><div class="emoji">${r.kind === 'transfer' ? '🔁' : catEmoji(r.categoryId)}</div><div class="grow"><div class="t ellipsis ${r.active ? '' : 'muted'}">${esc(r.name)}</div><div class="s ellipsis">${freqText(r)} · ${r.active ? 'next ' + relDay(r.next) : 'paused'}</div></div><div class="amt num ${r.kind === 'income' ? 'pos' : ''}">${fmt(r.amount, acctCur(r.accountId))}</div></li>`).join('')}</ul>` : '<div class="empty small">No recurring items yet.</div>'}</div>
    <button class="btn" data-new="1">+ Add recurring</button>`;
  };
  openSheet('Recurring', body(), {
    onMount: el => el.addEventListener('click', e => {
      const li = e.target.closest('[data-rec]'); if (li) return openRecSheet(li.dataset.rec);
      if (e.target.closest('[data-new]')) openRecSheet(null);
    }), onClose: null
  });
  sheetStack[sheetStack.length - 1].refresh = () => refreshTopSheet(body);
}

/* ===== Category ===== */
function openCatSheet(id, kind = 'expense', onCreated) {
  const c = id ? cat(id) : null;
  const st = c ? { ...c } : { name: '', emoji: '', kind, nature: 'want', group: kind === 'income' ? 'Income' : 'Lifestyle', budget: '' };
  let emojiTouched = !!c;
  const groups = [...new Set(S().categories.filter(x => x.kind === st.kind).map(x => x.group).filter(Boolean))];
  const [ps, pe] = periodRange(0);
  const spentNow = c ? sum(txIn(ps, pe, t => t.categoryId === c.id), txBase) : 0;
  const avg3 = c ? sum(txIn(periodRange(-3)[0], periodRange(-1)[1], t => t.categoryId === c.id), txBase) / 3 : 0;
  const html = `<div class="row" style="margin-bottom:12px"><input class="input" id="c-emoji" value="${esc(st.emoji || suggestEmoji(st.name))}" style="width:64px;text-align:center;font-size:24px" maxlength="8" aria-label="Emoji"><input class="input grow" id="c-name" value="${esc(st.name)}" placeholder="Category name"></div>
    <div class="small muted" id="c-sug" style="margin:-6px 2px 12px">${c ? '' : 'An emoji is suggested as you type. Tap it to change.'}</div>
    ${!c ? `<div class="seg" style="margin-bottom:12px"><button data-kind="expense" class="${st.kind === 'expense' ? 'on' : ''}">Expense</button><button data-kind="income" class="${st.kind === 'income' ? 'on' : ''}">Income</button></div>` : ''}
    ${st.kind === 'expense' ? `<label class="field"><span>Type</span><div class="seg" id="c-nature"><button data-n="need" class="${st.nature === 'need' ? 'on' : ''}">Need</button><button data-n="want" class="${st.nature !== 'need' ? 'on' : ''}">Want</button></div></label>
    <label class="field"><span>Monthly budget</span><input class="input num" id="c-budget" inputmode="decimal" value="${esc(st.budget || '')}" placeholder="No budget"></label>
    ${c && avg3 ? `<div class="small muted" style="margin:-6px 2px 12px">You spent ${fmt(spentNow)} this period · ${fmt(avg3)} per month on average over the last 3. <button class="mini-btn" data-useavg="${round2(avg3)}">Use average</button></div>` : ''}` : ''}
    <label class="field"><span>Group</span><input class="input" id="c-group" list="c-groups" value="${esc(st.group || '')}"><datalist id="c-groups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
    <button class="btn" data-save="1">${c ? 'Save' : 'Create category'}</button>
    ${c ? `<button class="btn ghost" data-view="1">View transactions</button><button class="btn danger" data-del="1">Delete category</button>` : ''}`;
  openSheet(c ? 'Category' : 'New category', html, {
    onMount: el => {
      const name = $('#c-name', el), emo = $('#c-emoji', el);
      name.oninput = () => { if (!emojiTouched) emo.value = suggestEmoji(name.value); };
      emo.oninput = () => { emojiTouched = true; };
      if (!c) setTimeout(() => name.focus(), 60);
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.closest('.sheet-h')) return;
        if (b.dataset.n) { st.nature = b.dataset.n; $$('#c-nature button', el).forEach(x => x.classList.toggle('on', x === b)); }
        else if (b.dataset.kind) { closeSheet(); openCatSheet(null, b.dataset.kind, onCreated); }
        else if (b.dataset.useavg) { $('#c-budget', el).value = b.dataset.useavg; }
        else if (b.dataset.view) { closeSheet(true); ui.tab = 'activity'; ui.filter = 'cat:' + c.id; ui.search = ''; render(); }
        else if (b.dataset.del) {
          const n = S().transactions.filter(t => t.categoryId === c.id).length;
          if (!confirm(`Delete ${c.name}?${n ? ` ${n} transaction${n > 1 ? 's' : ''} will become Uncategorized.` : ''}`)) return;
          S().categories = S().categories.filter(x => x !== c);
          S().transactions.forEach(t => { if (t.categoryId === c.id) t.categoryId = null; });
          closeSheet(); commit('Category deleted');
        }
        else if (b.dataset.save) {
          const nm = name.value.trim(); if (!nm) return toast('Give it a name');
          const bud = $('#c-budget', el) ? Math.abs(parseAmount($('#c-budget', el).value)) || 0 : 0;
          const rec = { name: nm, emoji: emo.value.trim() || suggestEmoji(nm), nature: st.nature, group: $('#c-group', el).value.trim() || (st.kind === 'income' ? 'Income' : 'Other'), budget: round2(bud) };
          let created;
          if (c) Object.assign(c, rec); else { created = { id: uid(), kind: st.kind, ...rec }; S().categories.push(created); }
          closeSheet(); save(); render();
          if (created && onCreated) onCreated(created); else toast('Saved');
        }
      });
    }
  });
}

/* ===== Account ===== */
function openAccSheet(id) {
  const a = id ? acct(id) : null;
  const bal = a ? balances()[a.id] : 0;
  const st = a ? { ...a } : { name: '', type: 'checking', currency: S().currency, opening: '', emoji: '' };
  let emojiTouched = !!a;
  const typeEmoji = { checking: '🏦', savings: '🐷', credit: '💳', cash: '💵' };
  const html = `<div class="row" style="margin-bottom:12px"><input class="input" id="a-emoji" value="${esc(st.emoji || typeEmoji[st.type])}" style="width:64px;text-align:center;font-size:24px" maxlength="8"><input class="input grow" id="a-name" value="${esc(st.name)}" placeholder="Account name"></div>
    <label class="field"><span>Type</span><select class="input" id="a-type">${Object.entries(ACCOUNT_TYPES).map(([k, l]) => `<option value="${k}" ${st.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span>Currency</span><select class="input" id="a-cur">${CURRENCIES.map(c => `<option value="${c.code}" ${c.code === st.currency ? 'selected' : ''}>${c.code} — ${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span>${a ? 'Current balance' : 'Balance right now'}</span><input class="input num" id="a-bal" inputmode="decimal" value="${a ? round2(bal) : ''}" placeholder="0.00"></label>
    <div class="small muted" style="margin:-6px 2px 12px">For credit cards, enter what you owe as a negative number (e.g. -250). Changing the balance adjusts the starting amount; your history stays the same.</div>
    <button class="btn" data-save="1">${a ? 'Save' : 'Add account'}</button>
    ${a ? `<button class="btn ghost" data-view="1">View transactions</button><button class="btn ghost" data-arch="1">${a.archived ? 'Unarchive' : 'Archive'}</button><button class="btn danger" data-del="1">Delete account</button>` : ''}`;
  openSheet(a ? 'Account' : 'New account', html, {
    onMount: el => {
      $('#a-type', el).onchange = e => { if (!emojiTouched) $('#a-emoji', el).value = typeEmoji[e.target.value]; };
      $('#a-emoji', el).oninput = () => emojiTouched = true;
      if (!a) setTimeout(() => $('#a-name', el).focus(), 60);
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.closest('.sheet-h')) return;
        if (b.dataset.save) {
          const nm = $('#a-name', el).value.trim(); if (!nm) return toast('Give it a name');
          const target = parseAmount($('#a-bal', el).value); const tv = isNaN(target) ? 0 : target;
          const rec = { name: nm, type: $('#a-type', el).value, currency: $('#a-cur', el).value, emoji: $('#a-emoji', el).value.trim() || typeEmoji[$('#a-type', el).value] };
          if (a) { Object.assign(a, rec); a.opening = round2((+a.opening || 0) + (tv - bal)); }
          else S().accounts.push({ id: uid(), opening: round2(tv), ...rec });
          if (rec.currency !== S().currency && !S().rates[rec.currency]) toast(`Set a ${rec.currency} exchange rate in Settings › Currency`);
          closeSheet(); save(); render(); if (rec.currency === S().currency || S().rates[rec.currency]) toast('Saved');
        } else if (b.dataset.view) { closeSheet(true); ui.tab = 'activity'; ui.filter = 'acc:' + a.id; render(); }
        else if (b.dataset.arch) { a.archived = !a.archived; closeSheet(); commit(a.archived ? 'Archived' : 'Unarchived'); }
        else if (b.dataset.del) {
          if (S().accounts.length === 1) return toast('You need at least one account');
          const n = S().transactions.filter(t => t.accountId === a.id || t.toAccountId === a.id).length;
          if (!confirm(`Delete ${a.name}${n ? ` and its ${n} transaction${n > 1 ? 's' : ''}` : ''}? This can't be undone.`)) return;
          S().transactions = S().transactions.filter(t => t.accountId !== a.id && t.toAccountId !== a.id);
          S().recurring = S().recurring.filter(r => r.accountId !== a.id && r.toAccountId !== a.id);
          S().accounts = S().accounts.filter(x => x !== a); closeSheet(); commit('Account deleted');
        }
      });
    }
  });
}

/* ===== Calendar ===== */
function openCalendar() {
  let off = 0, sel = today();
  const body = () => {
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + off);
    const ms = ymd(base), me = addDays(addMonths(ms, 1, 1), -1);
    const startDow = (base.getDay() + 6) % 7; // Monday first
    const gridStart = addDays(ms, -startDow);
    const ups = upcoming(today(), addDays(me, 7));
    const upBy = {}; ups.forEach(u => (upBy[u.date] = upBy[u.date] || []).push(u));
    const spent = {}; txIn(gridStart, addDays(gridStart, 41), t => t.kind === 'expense').forEach(t => spent[t.date] = (spent[t.date] || 0) + txBase(t));
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i); if (i === 35 && d > me) break;
      const u = upBy[d] || [];
      cells += `<button class="d ${d < ms || d > me ? 'out' : ''} ${d === today() ? 'today' : ''} ${d === sel ? 'sel' : ''}" data-d="${d}"><span>${parseD(d).getDate()}</span>
        ${spent[d] ? `<span class="x num">${fmt(spent[d], null, { compact: true })}</span>` : ''}<span class="dots">${u.slice(0, 3).map(x => `<i class="${x.kind === 'income' ? 'inc' : ''}"></i>`).join('')}</span></button>`;
    }
    const dayTx = S().transactions.filter(t => t.date === sel && !t.planned).sort(txSort);
    const dayUp = upBy[sel] || [];
    const monthUp = ups.filter(u => u.date >= ms && u.date <= me);
    const dueOut = sum(monthUp.filter(u => u.kind === 'expense'), u => toBase(u.amount, acctCur(u.accountId)));
    const dueIn = sum(monthUp.filter(u => u.kind === 'income'), u => toBase(u.amount, acctCur(u.accountId)));
    return `<div class="nav-row"><button class="arrow" data-nav="-1">‹</button><div class="title">${fmtDate(ms, { month: 'long', year: 'numeric' })}</div><button class="arrow" data-nav="1">›</button></div>
      <div class="small muted" style="text-align:center;margin-bottom:10px">Still due this month: <b class="num" style="color:var(--ink)">${fmt(dueOut)}</b> out · <b class="num pos">${fmt(dueIn)}</b> in</div>
      <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      <div class="sec-h">${relDay(sel)}</div>
      <div class="card flush">${dayUp.length || dayTx.length ? `<ul class="list">${dayUp.map(upItemHTML).join('')}${dayTx.map(t => txItemHTML(t)).join('')}</ul>` : '<div class="empty small">Nothing on this day.</div>'}</div>
      <button class="btn ghost" data-recs="1">Manage recurring &amp; subscriptions</button>
      <button class="btn ghost" data-plan="1">+ Plan a payment on this day</button>`;
  };
  openSheet('Upcoming', body(), {
    left: 'Done',
    onMount: el => el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.closest('.sheet-h')) return;
      if (b.dataset.nav) { off += +b.dataset.nav; const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + off); sel = off === 0 ? today() : ymd(base); refreshTopSheet(body); }
      else if (b.dataset.d) { sel = b.dataset.d; refreshTopSheet(body); }
      else if (b.dataset.recs) openRecList();
      else if (b.dataset.plan) openTxSheet({ date: sel < today() ? today() : sel });
    })
  });
  sheetStack[sheetStack.length - 1].refresh = () => refreshTopSheet(body);
}

/* ===== Settings ===== */
function openSettings() {
  const html = settingsHTML();
  openSheet('Settings', html, {
    left: 'Done',
    onMount: el => el.addEventListener('click', e => {
      const li = e.target.closest('[data-s]'); if (!li) return;
      SETTINGS[li.dataset.s]();
    })
  });
  sheetStack[sheetStack.length - 1].refresh = () => refreshTopSheet(settingsHTML);
}
function settingsHTML() {
  const sp = S();
  const item = (act, emoji, title, sub) => `<li class="item" data-s="${act}"><div class="emoji">${emoji}</div><div class="grow"><div class="t">${title}</div>${sub ? `<div class="s ellipsis">${sub}</div>` : ''}</div><span class="chev">›</span></li>`;
  const html = `
    <div class="sec-h">Space</div><div class="card flush set-list"><ul class="list">
      ${item('spaces', '🗂️', esc(sp.name), `${Object.keys(DB.spaces).length} space${Object.keys(DB.spaces).length > 1 ? 's' : ''} · switch, add or rename`)}</ul></div>
    <div class="sec-h">Budget</div><div class="card flush set-list"><ul class="list">
      ${item('income', '💼', 'Income planning', sp.income.mode === 'irregular' ? `Irregular · expecting ${fmt(+sp.income.expected || 0)}/month` : 'Regular paycheck · safe-to-spend runs to payday')}
      ${item('period', '📅', 'Budget period', `Starts on day ${sp.periodStart} of each month`)}
      ${item('savings', '🐷', 'Savings goal', sp.savingsGoal ? `${fmt(sp.savingsGoal)} set aside each period` : 'Not set')}
      ${item('recurring', '🔄', 'Recurring & subscriptions', `${sp.recurring.filter(r => r.active).length} active`)}
      ${item('categories', '🏷️', 'Categories', `${sp.categories.length} categories`)}
      ${item('reminders', '🔔', 'Payment reminders', sp.reminders ? `On · ${sp.remindDays} day${sp.remindDays > 1 ? 's' : ''} before` : 'Off')}</ul></div>
    <div class="sec-h">Logging</div><div class="card flush set-list"><ul class="list">
      ${item('shortcuts', '⚡', 'Auto-log Apple Pay', S().walletLastSync ? `Last synced ${relDay(ymd(new Date(S().walletLastSync))).toLowerCase()}` : 'Track every tap-to-pay with an iPhone automation')}
      ${item('install', '📲', 'Add to Home Screen', 'Opens instantly and works offline')}</ul></div>
    <div class="sec-h">Appearance &amp; currency</div><div class="card flush set-list"><ul class="list">
      ${item('theme', '🌓', 'Theme', { auto: 'Match system', light: 'Light', dark: 'Dark' }[DB.theme || 'auto'])}
      ${item('currency', '💱', 'Currency', `${sp.currency}${Object.keys(sp.rates).length ? ' · ' + Object.keys(sp.rates).length + ' exchange rate(s)' : ''}`)}</ul></div>
    <div class="sec-h">Data</div><div class="card flush set-list"><ul class="list">
      ${item('import', '📥', 'Import CSV', 'From your bank or another budget app')}
      ${item('export', '📤', 'Export CSV', `${sp.transactions.length} transactions`)}
      ${item('backup', '💾', 'Backup & restore', 'Everything, all spaces, as one file')}
      ${item('erase', '🗑️', 'Erase this space', '')}</ul></div>
    <div class="sec-h">Privacy</div><div class="card small muted">No account, no sign-in, no bank connection, no analytics. Everything is stored in this browser on this device. Back up regularly, or export to move to another device.</div>
    <div class="hint">Spendable Tracker · works offline</div>`;
  return html;
}
function refreshSettings() { closeSheet(true); openSettings(); }
const SETTINGS = {
  spaces() {
    const body = () => `<div class="card flush"><ul class="list">${Object.values(DB.spaces).map(s => `<li class="item tap" data-sw="${s.id}"><div class="emoji">${s.id === DB.active ? '✅' : '🗂️'}</div><div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${s.currency} · ${s.transactions.length} transactions</div></div>${s.id === DB.active ? '<span class="badge acc">Active</span>' : ''}</li>`).join('')}</ul></div>
      <label class="field"><span>Rename this space</span><div class="row"><input class="input grow" id="sp-name" value="${esc(S().name)}"><button class="mini-btn" data-ren="1">Save</button></div></label>
      <label class="field"><span>New space</span><div class="row"><input class="input grow" id="sp-new" placeholder="e.g. Household, Business, Trip"><button class="mini-btn" data-add="1">Add</button></div></label>
      <div class="small muted">Spaces keep separate accounts, budgets and history — for a partner, a side business or a trip.</div>
      ${Object.keys(DB.spaces).length > 1 ? '<button class="btn danger" data-delsp="1" style="margin-top:16px">Delete this space</button>' : ''}`;
    openSheet('Spaces', body(), {
      onMount: el => el.addEventListener('click', e => {
        const sw = e.target.closest('[data-sw]');
        if (sw) { DB.active = sw.dataset.sw; processRecurring(); save(); closeSheet(true); render(); toast(`Switched to ${S().name}`); return; }
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.ren) { const n = $('#sp-name', el).value.trim(); if (n) { S().name = n; commit('Renamed'); refreshTopSheet(body); } }
        if (b.dataset.add) { const n = $('#sp-new', el).value.trim(); if (!n) return toast('Name the space'); const cur = S().currency; newSpace(n, cur); save(); closeSheet(true); render(); toast(`Created ${n}`); }
        if (b.dataset.delsp) { if (!confirm(`Delete space "${S().name}" and all its data?`)) return; delete DB.spaces[DB.active]; DB.active = Object.keys(DB.spaces)[0]; save(); closeSheet(true); render(); toast('Space deleted'); }
      })
    });
  },
  income() {
    const sp = S();
    const incRec = sp.recurring.filter(r => r.kind === 'income' && r.active);
    const html = `<div class="seg" id="inc-mode" style="margin-bottom:14px"><button data-m="recurring" class="${sp.income.mode === 'recurring' ? 'on' : ''}">Regular paycheck</button><button data-m="irregular" class="${sp.income.mode === 'irregular' ? 'on' : ''}">Irregular income</button></div>
      <div id="inc-reg" style="${sp.income.mode === 'recurring' ? '' : 'display:none'}">
        <div class="small muted" style="margin-bottom:10px">Safe-to-spend covers the days until your next payday. Paydays come from your recurring income.</div>
        <div class="card flush"><ul class="list">${incRec.length ? incRec.map(r => `<li class="item tap" data-rec="${r.id}"><div class="emoji">${catEmoji(r.categoryId)}</div><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${freqText(r)} · next ${relDay(r.next)}</div></div><div class="amt num pos">${fmt(r.amount, acctCur(r.accountId))}</div></li>`).join('') : '<div class="empty small">No paycheck set up yet.</div>'}</ul></div>
        <button class="btn ghost" data-addpay="1">+ Add paycheck</button>
      </div>
      <div id="inc-irr" style="${sp.income.mode === 'irregular' ? '' : 'display:none'}">
        <div class="small muted" style="margin-bottom:10px">For freelance or varying pay. Safe-to-spend runs to the end of the budget period and only counts money that has arrived, so it goes up as income lands. Set a monthly target to track progress.</div>
        <label class="field"><span>Expected income per month</span><input class="input num" id="inc-exp" inputmode="decimal" value="${sp.income.expected || ''}" placeholder="0.00"></label>
        <button class="btn" data-saveexp="1">Save</button>
      </div>`;
    openSheet('Income planning', html, {
      onMount: el => el.addEventListener('click', e => {
        const b = e.target.closest('button,[data-rec]'); if (!b) return;
        if (b.dataset.m) { sp.income.mode = b.dataset.m; save(); render(); $$('#inc-mode button', el).forEach(x => x.classList.toggle('on', x === b)); $('#inc-reg', el).style.display = b.dataset.m === 'recurring' ? '' : 'none'; $('#inc-irr', el).style.display = b.dataset.m === 'irregular' ? '' : 'none'; }
        if (b.dataset.rec) openRecSheet(b.dataset.rec);
        if (b.dataset.addpay) openRecSheet(null, { kind: 'income' });
        if (b.dataset.saveexp) { sp.income.expected = Math.abs(parseAmount($('#inc-exp', el).value)) || 0; commit('Saved'); closeSheet(); }
      })
    });
    sheetStack[sheetStack.length - 1].refresh = () => { closeSheet(); SETTINGS.income(); };
  },
  period() {
    const html = `<label class="field"><span>Budget period starts on day</span><select class="input" id="p-day">${Array.from({ length: 28 }, (_, i) => `<option ${S().periodStart === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      <div class="small muted">Pick the day you usually get paid, for example 25 to budget from the 25th to the 24th.</div><button class="btn" data-save="1">Save</button>`;
    openSheet('Budget period', html, { onMount: el => $('[data-save]', el).onclick = () => { S().periodStart = +$('#p-day', el).value; commit('Saved'); closeSheet(); } });
  },
  savings() {
    const html = `<label class="field"><span>Set aside each period</span><input class="input num" id="sv" inputmode="decimal" value="${S().savingsGoal || ''}" placeholder="0.00"></label>
      <div class="small muted">This is held back from safe-to-spend until you move it to a savings account. Recurring transfers to savings count toward it.</div><button class="btn" data-save="1">Save</button>`;
    openSheet('Savings goal', html, { onMount: el => $('[data-save]', el).onclick = () => { S().savingsGoal = round2(Math.abs(parseAmount($('#sv', el).value)) || 0); commit('Saved'); closeSheet(); } });
  },
  recurring() { openRecList(); },
  categories() {
    const body = () => ['expense', 'income'].map(k => `<div class="sec-h">${k === 'expense' ? 'Expense' : 'Income'} categories</div><div class="card flush"><ul class="list">${S().categories.filter(c => c.kind === k).map(c => `<li class="item tap" data-cat="${c.id}"><div class="emoji">${c.emoji}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.group || '')}${c.kind === 'expense' ? ' · ' + (c.nature === 'need' ? 'Need' : 'Want') : ''}${c.budget ? ' · ' + fmt(c.budget) + '/mo' : ''}</div></div><span class="chev muted">›</span></li>`).join('')}</ul></div>`).join('') + '<button class="btn" data-new="1">+ New category</button>';
    openSheet('Categories', body(), { onMount: el => el.addEventListener('click', e => { const li = e.target.closest('[data-cat]'); if (li) openCatSheet(li.dataset.cat); if (e.target.closest('[data-new]')) openCatSheet(null); }) });
    sheetStack[sheetStack.length - 1].refresh = () => refreshTopSheet(body);
  },
  reminders() {
    const sp = S();
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const html = `<label class="toggle"><input type="checkbox" id="rm-on" ${sp.reminders ? 'checked' : ''}><span>Remind me before recurring payments</span></label>
      <label class="field"><span>How many days before</span><select class="input" id="rm-days">${[1, 2, 3, 5, 7].map(d => `<option ${sp.remindDays === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <div class="small muted">Reminders show when you open the app, as a notification if you allow it (${perm === 'granted' ? 'allowed' : perm === 'denied' ? 'blocked in browser settings' : perm === 'unsupported' ? 'not supported in this browser' : 'not yet allowed'}). Web apps can't wake up on a schedule, so open Spendable now and then to catch them. You can turn reminders off for a single bill in its settings.</div>
      <button class="btn" data-save="1">Save</button>`;
    openSheet('Payment reminders', html, {
      onMount: el => $('[data-save]', el).onclick = async () => {
        sp.reminders = $('#rm-on', el).checked; sp.remindDays = +$('#rm-days', el).value;
        if (sp.reminders && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { } }
        commit('Saved'); closeSheet(); checkReminders(true);
      }
    });
  },
  shortcuts() {
    const url = location.href.split(/[?#]/)[0];
    const sp = S();
    const html = `<div class="card small" style="line-height:1.55"><b>How it works:</b> an iPhone Shortcuts automation runs every time you tap to pay with Apple Pay. It adds a line to a small file in iCloud Drive. Tap <b>Sync Apple Pay</b> here and every new payment is added at once, with duplicates skipped and categories guessed from your history. No bank connection needed.</div>
      <div class="sec-h">1 · Create the automation (once)</div>
      <ol class="steps small" style="line-height:1.55">
        <li>Open the <b>Shortcuts</b> app and tap the <b>Automation</b> tab at the bottom.</li>
        <li>Tap <b>+</b> (top right), or <b>New Automation</b> if you don't have any yet.</li>
        <li>Scroll down and tap <b>Wallet</b>.</li>
        <li>Choose your cards (or leave it on any card), select <b>Run Immediately</b>, then tap <b>Next</b>.</li>
        <li>Tap <b>New Blank Automation</b>, then <b>Add Action</b>.</li>
        <li>Search for <b>Text</b> and add it. In the text box, build this line:<br>
          <span class="code" style="display:block;margin-top:6px">Current Date | Amount | Merchant</span>
          To insert each blue variable, tap in the box and use the bar above the keyboard: pick <b>Current Date</b>, type <b>&nbsp;|&nbsp;</b>, pick <b>Shortcut Input</b>, then tap it and change it to <b>Amount</b>. Type <b>&nbsp;|&nbsp;</b>, add <b>Shortcut Input</b> again and change it to <b>Merchant</b>.</li>
        <li>Tap the <b>Current Date</b> variable and set <b>Date Format</b> to <b>ISO 8601</b>.</li>
        <li>Search for <b>Append to Text File</b> and add it. Tap the file name and set it to <b>Spendable Apple Pay</b>. Leave <b>Make New Line</b> on.</li>
        <li>Tap <b>Done</b>. The next time you tap to pay, a line is added to <i>iCloud Drive › Shortcuts › Spendable Apple Pay.txt</i>.</li>
      </ol>
      <div class="sec-h">2 · Sync into Spendable</div>
      <label class="field"><span>Log Apple Pay payments to</span><select class="input" id="wl-acc">${accOptions(sp.walletAccount || defaultAccount())}</select></label>
      <label class="btn" style="text-align:center;cursor:pointer">⚡ Sync Apple Pay<input type="file" accept=".txt,text/plain" id="wl-file" hidden></label>
      <div class="small muted" style="margin:2px 2px 10px;line-height:1.5">Pick <b>Spendable Apple Pay</b> from Recents, or from iCloud Drive › Shortcuts. You can sync as often as you like; payments already imported are skipped. ${sp.walletLastSync ? `Last synced ${relDay(ymd(new Date(sp.walletLastSync))).toLowerCase()}.` : ''} Once you've synced, a <b>Sync Apple Pay</b> button also appears on Home.</div>
      <div class="sec-h">Good to know</div>
      <div class="small muted" style="line-height:1.6">• The Wallet automation needs iOS 17 or later. It runs for Apple Pay taps in stores, apps and websites with cards that support transaction automations (most debit and credit cards in Wallet).<br>
      • Swiping a physical card doesn't trigger it. Add those with the <b>+</b> button.<br>
      • The file stays in your own iCloud Drive. Nothing goes through a server.</div>
      <div class="sec-h">Using Spendable in Safari instead?</div>
      <div class="small muted" style="line-height:1.6">If you use Spendable as a Safari tab rather than from the Home Screen, you can log each payment instantly. Instead of the two actions above, add a <b>URL</b> action with the link below (swap AMOUNT and MERCHANT for the Shortcut Input variables), then an <b>Open URLs</b> action. This doesn't work with the Home Screen app, because iPhone always opens links in Safari, which keeps separate data.</div>
      <div class="code" id="sc-url" style="margin-top:8px">${esc(url)}?add=AMOUNT&amp;note=MERCHANT</div>
      <button class="btn ghost" data-copy="sc-url">Copy link</button>`;
    openSheet('Auto-log Apple Pay', html, {
      onMount: el => {
        $('#wl-acc', el).onchange = e => { sp.walletAccount = e.target.value; save(); };
        $('#wl-file', el).onchange = e => syncWalletFile(e.target.files[0], $('#wl-acc', el).value);
        el.addEventListener('click', async e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.copy) { const txt = $('#' + b.dataset.copy, el).textContent; try { await navigator.clipboard.writeText(txt); toast('Copied'); } catch (err) { toast('Select the text to copy it'); } }
        });
      }
    });
  },
  install() {
    const html = `<div class="small" style="line-height:1.6"><b>iPhone / iPad (Safari):</b> tap Share, then <b>Add to Home Screen</b>.<br><b>Android (Chrome):</b> tap ⋮, then <b>Install app</b> or <b>Add to Home screen</b>.<br><b>Desktop (Chrome / Edge):</b> click the install icon in the address bar.</div>
      ${window.deferredInstall ? '<button class="btn" data-inst="1">Install now</button>' : ''}
      <div class="small muted" style="margin-top:12px">Once installed, Spendable opens instantly and works offline. Long-press the icon for quick actions: Add expense, Add income, What's left.</div>`;
    openSheet('Add to Home Screen', html, { onMount: el => { const b = $('[data-inst]', el); if (b) b.onclick = async () => { window.deferredInstall.prompt(); window.deferredInstall = null; closeSheet(); }; } });
  },
  theme() {
    const html = `<div class="seg">${[['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-t="${k}" class="${(DB.theme || 'auto') === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    openSheet('Theme', html, { onMount: el => el.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; DB.theme = b.dataset.t; applyTheme(); save(); $$('[data-t]', el).forEach(x => x.classList.toggle('on', x === b)); render(); }) });
  },
  currency() {
    const sp = S();
    const foreign = [...new Set(sp.accounts.map(a => a.currency).filter(c => c && c !== sp.currency))];
    const html = `<label class="field"><span>Main currency</span><select class="input" id="cu-base">${CURRENCIES.map(c => `<option value="${c.code}" ${c.code === sp.currency ? 'selected' : ''}>${c.code} — ${esc(c.name)}</option>`).join('')}</select></label>
      <div class="small muted" style="margin:-4px 2px 14px">${CURRENCIES.length} currencies available. Changing the main currency doesn't convert amounts; it changes how totals are shown.</div>
      ${foreign.length ? `<div class="sec-h">Exchange rates</div><div class="small muted" style="margin:0 2px 10px">Used to add up accounts in other currencies. Set them yourself — the app never goes online.</div>
      ${foreign.map(c => `<label class="field"><span>1 ${c} = ? ${sp.currency}</span><input class="input num" data-rate="${c}" inputmode="decimal" value="${sp.rates[c] || ''}" placeholder="1.00"></label>`).join('')}` : '<div class="small muted">Add an account in another currency (Accounts › Add account) to use more than one currency.</div>'}
      <button class="btn" data-save="1">Save</button>`;
    openSheet('Currency', html, {
      onMount: el => $('[data-save]', el).onclick = () => {
        sp.currency = $('#cu-base', el).value;
        $$('[data-rate]', el).forEach(i => { const v = parseAmount(i.value); if (v > 0) sp.rates[i.dataset.rate] = v; else delete sp.rates[i.dataset.rate]; });
        Object.keys(fmtCache).forEach(k => delete fmtCache[k]);
        commit('Saved'); refreshSettings();
      }
    });
  },
  import() { openImport(); },
  export() {
    const sp = S();
    const head = ['date', 'type', 'amount', 'currency', 'category', 'account', 'to_account', 'description', 'tags', 'planned'];
    const rows = [...sp.transactions].sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.kind, (t.kind === 'expense' ? -t.amount : t.amount).toFixed(2), acctCur(t.accountId), t.kind === 'transfer' ? '' : catName(t.categoryId), (acct(t.accountId) || {}).name, t.kind === 'transfer' ? (acct(t.toAccountId) || {}).name : '', t.note, (t.tags || []).join(' '), t.planned ? 'yes' : '']);
    download(`spendable-${sp.name.replace(/\W+/g, '-').toLowerCase()}-${today()}.csv`, [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
    toast(`Exported ${rows.length} transactions`);
  },
  backup() {
    const html = `<button class="btn" data-dl="1">Download backup</button>
      <label class="btn ghost" style="text-align:center;cursor:pointer">Restore from backup<input type="file" accept=".json,application/json" id="rs-file" hidden></label>
      <div class="small muted">A backup holds every space, account, category, recurring item and transaction. Restoring replaces what's on this device. Use it to move to a new phone, too.</div>
      <div class="sec-h">How your data is kept</div>
      <div class="card small" style="line-height:1.6">✅ Saved automatically on every change, in two places on this device (browser storage and a database copy).<br>
      ${storagePersisted ? '✅ This browser has agreed not to clear the data automatically.' : '⚠️ This browser may clear website data that goes unused for weeks. Use the app often, install it to your Home Screen, and keep a backup.'}<br>
      ${DB.lastBackup ? `💾 Last backup: ${fmtDate(ymd(new Date(DB.lastBackup)), { month: 'short', day: 'numeric', year: 'numeric' })}` : '💾 No backup yet'}<br>
      <span class="muted">Clearing Safari or Chrome website data, or deleting the app from your Home Screen, erases it, so back up first.</span></div>`;
    openSheet('Backup & restore', html, {
      onMount: el => {
        $('[data-dl]', el).onclick = async () => {
          DB.lastBackup = Date.now(); save();
          const name = `spendable-backup-${today()}.json`, text = JSON.stringify(DB, null, 1);
          // On phones, the share sheet lets you save straight to Files / iCloud Drive / Google Drive
          try {
            const file = new File([text], name, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Spendable backup' }); toast('Backup saved'); render(); return; }
          } catch (e) { if (e.name === 'AbortError') return; }
          download(name, text, 'application/json'); toast('Backup downloaded'); render();
        };
        $('#rs-file', el).onchange = e => restoreBackup(e.target.files[0]);
      }
    });
  },
  erase() {
    if (!confirm(`Erase all transactions, recurring items and balances in "${S().name}"? Categories are kept. This can't be undone.`)) return;
    const sp = S(); sp.transactions = []; sp.recurring = []; sp.accounts.forEach(a => a.opening = 0);
    commit('Space erased'); refreshSettings();
  }
};
function syncWalletFile(file, accountId) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    const r = importWalletText(rd.result, accountId || S().walletAccount);
    if (accountId) S().walletAccount = accountId;
    closeSheet(true); save(); render();
    if (r.added) toast(`Added ${r.added} Apple Pay payment${r.added > 1 ? 's' : ''}${r.dup ? ` · ${r.dup} already in` : ''}`, 'Undo', () => { const ids = new Set(r.addedTx.map(t => t.id)); S().transactions = S().transactions.filter(t => !ids.has(t.id)); commit('Removed'); });
    else toast(r.dup ? `You're up to date. All ${r.dup} payments were already imported` : r.bad ? "Couldn't read that file. Check the automation's Text action" : 'That file is empty');
  };
  rd.onerror = () => toast("Couldn't open that file");
  rd.readAsText(file);
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function restoreBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !d.spaces || !Object.keys(d.spaces).length) throw new Error('not a Spendable backup');
      for (const sp of Object.values(d.spaces)) if (!Array.isArray(sp.transactions) || !Array.isArray(sp.accounts)) throw new Error('backup is damaged');
      if (S() && !confirm('Replace everything on this device with this backup?')) return;
      DB = d; DB.notified = DB.notified || {}; if (!DB.spaces[DB.active]) DB.active = Object.keys(DB.spaces)[0];
      applyTheme(); processRecurring(); save(); closeSheet(true); render(); toast('Backup restored');
    } catch (e) { toast('Could not restore: ' + e.message); }
  };
  r.readAsText(file);
}

/* ===== CSV import ===== */
function openImport() {
  let rows = null, head = [], map = {}, opts = { dateFmt: 'auto', sign: 'neg-expense', accountId: defaultAccount(), hasHeader: true };
  const FIELDS = [['date', 'Date'], ['amount', 'Amount'], ['description', 'Description'], ['category', 'Category'], ['type', 'Type (expense/income)'], ['debit', 'Debit / money out'], ['credit', 'Credit / money in'], ['account', 'Account'], ['tags', 'Tags']];
  const guess = () => {
    const h = head.map(x => x.toLowerCase());
    const find = res => { const i = h.findIndex(x => res.some(r => r.test(x))); return i < 0 ? '' : String(i); };
    map = {
      date: find([/date/, /^day/, /time/]), amount: find([/^amount/, /amount/, /^value/, /sum/]), description: find([/desc/, /payee/, /merchant/, /memo/, /name/, /note/, /details/, /title/]),
      category: find([/categ/]), type: find([/^type/, /kind/, /direction/]), debit: find([/debit/, /withdraw/, /money out/, /paid out/, /outflow/]), credit: find([/credit/, /deposit/, /money in/, /paid in/, /inflow/]),
      account: find([/^account/]), tags: find([/tag/, /label/])
    };
    if (map.amount && (map.amount === map.debit || map.amount === map.credit)) map.amount = '';
  };
  const parsedRows = () => {
    if (!rows) return [];
    const data = opts.hasHeader ? rows.slice(1) : rows;
    const g = (r, k) => map[k] !== '' && map[k] != null ? (r[+map[k]] ?? '').trim() : '';
    return data.map((r, i) => {
      const date = parseDateFlexible(g(r, 'date'), opts.dateFmt);
      let amt = NaN, kind = 'expense';
      if (map.amount !== '') amt = parseAmount(g(r, 'amount'));
      else { const d = parseAmount(g(r, 'debit')), c = parseAmount(g(r, 'credit')); if (d) { amt = -Math.abs(d); } else if (c) amt = Math.abs(c); }
      const typ = g(r, 'type').toLowerCase();
      if (/income|credit|deposit|in$/.test(typ)) kind = 'income';
      else if (/expense|debit|withdraw|out$/.test(typ)) kind = 'expense';
      else if (/transfer/.test(typ)) kind = 'skip-transfer';
      else kind = (opts.sign === 'neg-expense' ? amt < 0 : amt > 0) ? 'expense' : 'income';
      const err = !date ? 'Unreadable date' : (isNaN(amt) || amt === 0) ? 'Missing amount' : kind === 'skip-transfer' ? 'Transfer (skipped)' : '';
      return { row: i + (opts.hasHeader ? 2 : 1), date, amount: Math.abs(amt), kind, note: g(r, 'description'), category: g(r, 'category'), account: g(r, 'account'), tags: g(r, 'tags'), err };
    });
  };
  const body = () => {
    if (!rows) return `<div class="small muted" style="margin-bottom:12px">Import transactions from your bank's CSV export or another budget app. You'll see a preview before anything is saved.</div>
      <label class="btn" style="text-align:center;cursor:pointer">Choose CSV file<input type="file" accept=".csv,text/csv,.txt" id="im-file" hidden></label>`;
    const pr = parsedRows(); const ok = pr.filter(r => !r.err);
    const col = k => `<select class="input" data-map="${k}"><option value="">—</option>${head.map((h, i) => `<option value="${i}" ${map[k] === String(i) ? 'selected' : ''}>${esc(opts.hasHeader ? h : 'Column ' + (i + 1))}</option>`).join('')}</select>`;
    return `<label class="toggle"><input type="checkbox" data-opt="hasHeader" ${opts.hasHeader ? 'checked' : ''}><span>First row is a header</span></label>
      <div class="two">${FIELDS.map(([k, l]) => `<label class="field"><span>${l}</span>${col(k)}</label>`).join('')}</div>
      <div class="two"><label class="field"><span>Date format</span><select class="input" data-opt="dateFmt">${[['auto', 'Auto-detect'], ['mdy', 'MM/DD/YYYY'], ['dmy', 'DD/MM/YYYY']].map(([v, l]) => `<option value="${v}" ${opts.dateFmt === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Amount signs</span><select class="input" data-opt="sign"><option value="neg-expense" ${opts.sign === 'neg-expense' ? 'selected' : ''}>Negative = expense</option><option value="pos-expense" ${opts.sign === 'pos-expense' ? 'selected' : ''}>Positive = expense</option></select></label></div>
      <label class="field"><span>Import into account${map.account ? ' (when the Account column is empty or unknown)' : ''}</span><select class="input" data-opt="accountId">${accOptions(opts.accountId)}</select></label>
      <div class="sec-h">Preview · ${ok.length} ready${pr.length - ok.length ? `, ${pr.length - ok.length} will be skipped` : ''}</div>
      <div class="card" style="overflow-x:auto;padding:8px"><table class="preview"><tr><th>Date</th><th>Description</th><th>Category</th><th class="right">Amount</th></tr>
      ${pr.slice(0, 12).map(r => `<tr class="${r.err ? 'bad' : ''}"><td>${r.err ? `Row ${r.row}: ${esc(r.err)}` : esc(r.date)}</td><td>${esc(r.note)}</td><td>${esc(r.category)}</td><td class="right num">${r.err ? '' : (r.kind === 'income' ? '+' : '−') + esc(r.amount.toFixed(2))}</td></tr>`).join('')}</table>
      ${pr.length > 12 ? `<div class="small muted" style="padding:6px 4px">…and ${pr.length - 12} more rows</div>` : ''}</div>
      <label class="toggle"><input type="checkbox" id="im-dedupe" checked><span>Skip rows that match an existing transaction (same date, amount and description)</span></label>
      <button class="btn" data-go="1" ${ok.length ? '' : 'disabled'}>Import ${ok.length} transaction${ok.length === 1 ? '' : 's'}</button>`;
  };
  openSheet('Import CSV', body(), {
    onMount: el => {
      const bindFile = () => { const f = $('#im-file', el); if (f) f.onchange = e => { const file = e.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { rows = parseCSV(String(rd.result).replace(/^﻿/, '')); if (!rows.length) { toast('That file is empty'); rows = null; return; } head = rows[0].map(x => x.trim()); guess(); refreshTopSheet(body); }; rd.readAsText(file); }; };
      bindFile();
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.map) { map[t.dataset.map] = t.value; refreshTopSheet(body); }
        if (t.dataset.opt) { opts[t.dataset.opt] = t.type === 'checkbox' ? t.checked : t.value; refreshTopSheet(body); }
      });
      el.addEventListener('click', e => {
        if (!e.target.closest('[data-go]')) return;
        const pr = parsedRows().filter(r => !r.err);
        const dedupe = $('#im-dedupe', el).checked;
        const seen = new Set(S().transactions.map(t => `${t.date}|${t.amount.toFixed(2)}|${(t.note || '').toLowerCase()}`));
        let added = 0, dup = 0, newCats = 0; const sp = S();
        for (const r of pr) {
          const key = `${r.date}|${r.amount.toFixed(2)}|${r.note.toLowerCase()}`;
          if (dedupe && seen.has(key)) { dup++; continue; }
          seen.add(key);
          let c = null;
          if (r.category) { c = sp.categories.find(x => x.kind === r.kind && x.name.toLowerCase() === r.category.toLowerCase()); if (!c) { c = { id: uid(), name: r.category, emoji: suggestEmoji(r.category), kind: r.kind, nature: 'want', group: r.kind === 'income' ? 'Income' : 'Imported', budget: 0 }; sp.categories.push(c); newCats++; } }
          else if (r.note) c = categoryForNote(r.note, r.kind);
          if (!c) c = sp.categories.find(x => x.kind === r.kind && /^other/i.test(x.name)) || sp.categories.find(x => x.kind === r.kind);
          const a = r.account ? sp.accounts.find(x => x.name.toLowerCase() === r.account.toLowerCase()) : null;
          sp.transactions.push({ id: uid(), created: Date.now() + added, date: r.date, amount: round2(r.amount), kind: r.kind, categoryId: c ? c.id : null, accountId: (a || {}).id || opts.accountId, toAccountId: null, note: r.note, tags: r.tags ? r.tags.split(/[,\s]+/).filter(Boolean) : [], planned: false });
          added++;
        }
        closeSheet(true); commit();
        const skipped = parsedRows().length - pr.length;
        toast(`Imported ${added}${dup ? ` · ${dup} duplicates skipped` : ''}${skipped ? ` · ${skipped} unreadable rows` : ''}${newCats ? ` · ${newCats} new categories` : ''}`);
      });
      const obs = new MutationObserver(bindFile); obs.observe($('.sheet-b', el), { childList: true });
    }
  });
}
