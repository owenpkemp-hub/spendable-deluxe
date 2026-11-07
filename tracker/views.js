'use strict';
const ui = { tab: 'home', filter: 'all', search: '', selecting: false, selected: new Set(), insMode: 'month', insOff: 0, budOff: 0, accRange: '3M', accSel: 'all', openInsight: null, showHeroMath: false };

const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  activity: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  budget: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4"/></svg>',
  insights: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  accounts: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>'
};
const TABS = [['home', 'Home'], ['activity', 'Activity'], null, ['budget', 'Budget'], ['insights', 'Insights']];

function render() {
  if (!S()) { renderOnboarding(); return; }
  document.body.classList.remove('onboarding');
  $('#fab').style.display = '';
  $('#tabs').innerHTML = `<div class="inner">${[...TABS, ['accounts', 'Accounts']].map(t => t ? `<button class="${ui.tab === t[0] ? 'on' : ''}" data-act="tab" data-tab="${t[0]}">${ICONS[t[0]]}${t[1]}</button>` : '<span class="spacer"></span>').join('')}</div>`;
  const titles = { home: S().name, activity: 'Activity', budget: 'Budget', insights: 'Insights', accounts: 'Accounts' };
  const sub = { home: fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric' }) };
  $('#top').innerHTML = `<div class="grow"><div class="sub">${esc(sub[ui.tab] || S().name)}</div><h1 class="ellipsis">${esc(titles[ui.tab])}</h1></div>
    ${ui.tab === 'home' ? `<button class="icon-btn" data-act="calendar" aria-label="Upcoming calendar">${ICONS.cal}</button><button class="icon-btn" data-act="tab" data-tab="activity" data-focus="1" aria-label="Search">${ICONS.search}</button>` : ''}
    <button class="icon-btn" data-act="settings" aria-label="Settings">${ICONS.gear}</button>`;
  const v = $('#view');
  v.innerHTML = VIEWS[ui.tab]();
  attachInspect(v);
  if (ui.tab === 'activity') bindSwipes(v);
}

/* ===== Home ===== */
function heroHTML() {
  const s = safeToSpend();
  const neg = s.safe < 0;
  const total = Math.max(1, s.cash);
  const w = v => Math.max(0, Math.min(100, v / total * 100)).toFixed(1);
  const payLabel = s.pay.source === 'payday' ? `until payday · ${fmtDate(s.pay.date, { weekday: 'short', month: 'short', day: 'numeric' })}` : `left in this budget period`;
  return `<section class="hero ${neg ? 'negative' : ''}" data-act="hero-math">
    <div class="label">Safe to spend</div>
    <div class="big num">${fmt(s.safe)}</div>
    <div class="per num">${neg ? 'Bills and savings are more than your cash' : `${fmt(Math.max(0, s.perDay))} a day · ${s.days} day${s.days === 1 ? '' : 's'} ${payLabel}`}</div>
    <div class="bar" title="Cash split"><i style="width:${w(s.bills)}%;background:rgba(255,255,255,.55)"></i><i style="width:${w(s.savings)}%;background:rgba(255,255,255,.32)"></i></div>
    <div class="meta">
      <span class="pill num">💵 Cash ${fmt(s.cash, null, { whole: true })}</span>
      <span class="pill num">🧾 Bills ${fmt(s.bills, null, { whole: true })}</span>
      <span class="pill num">🐷 Savings ${fmt(s.savings, null, { whole: true })}</span>
    </div>
    ${ui.showHeroMath ? `<div class="small" style="margin-top:12px;opacity:.95;line-height:1.6">
      Cash in checking, cash &amp; cards <b class="num">${fmt(s.cash)}</b><br>
      − Bills &amp; subscriptions due before ${s.pay.source === 'payday' ? 'payday' : 'period end'} <b class="num">${fmt(s.bills)}</b><br>
      − Savings still to set aside <b class="num">${fmt(s.savings)}</b><br>
      = Safe to spend <b class="num">${fmt(s.safe)}</b> ÷ ${s.days} days</div>` : ''}
  </section>`;
}
const VIEWS = {};
VIEWS.home = () => {
  const s = safeToSpend(), t = today();
  const quick = topCategories('expense', 8);
  const ups = upcoming(t, addDays(t, 14)).slice(0, 6);
  const recent = [...S().transactions].filter(x => !x.planned).sort(txSort).slice(0, 5);
  const [ps, pe] = periodRange(0);
  const tot = totals(ps, pe);
  const budgeted = sum(S().categories.filter(c => c.kind === 'expense'), c => +c.budget || 0);
  const sp = S();
  let incomeCard = '';
  if (sp.income.mode === 'irregular' && sp.income.expected > 0) {
    const got = s.incomeThisPeriod, exp = +sp.income.expected;
    incomeCard = `<div class="card"><h2>Income plan <button class="link" data-act="income-settings">Edit</button></h2>
      <div class="row"><div class="grow"><b class="num">${fmt(got)}</b> <span class="muted">of ${fmt(exp)} expected</span></div><span class="badge ${got >= exp ? 'acc' : 'warn'}">${got >= exp ? 'On plan' : fmt(exp - got, null, { whole: true }) + ' to go'}</span></div>
      <div class="prog"><i style="width:${Math.min(100, got / exp * 100)}%"></i></div>
      <div class="small muted" style="margin-top:8px">Safe-to-spend only counts money that has arrived. It goes up as income comes in.</div></div>`;
  }
  return `${heroHTML()}
  <div class="kpis">
    <div class="kpi"><div class="k">Left today</div><div class="v num ${s.todayLeft < 0 ? 'neg' : ''}">${fmt(s.todayLeft, null, { whole: Math.abs(s.todayLeft) >= 100 })}</div></div>
    <div class="kpi"><div class="k">Spent this period</div><div class="v num">${fmt(tot.expense, null, { whole: true })}</div></div>
    <div class="kpi"><div class="k">${budgeted ? 'Budget left' : 'Income'}</div><div class="v num ${budgeted && budgeted - tot.expense < 0 ? 'neg' : ''}">${fmt(budgeted ? budgeted - tot.expense : tot.income, null, { whole: true })}</div></div>
  </div>
  <div class="sec-h">Quick add</div>
  <div class="chips">${quick.map(c => `<button class="chip quick" data-act="new-tx" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}<button class="chip quick" data-act="new-tx" data-kind="income">💰 Income</button><button class="chip quick" data-act="new-tx" data-kind="transfer">🔁 Transfer</button></div>
  ${incomeCard}
  <div class="sec-h">Upcoming <button class="link" data-act="calendar">Calendar</button></div>
  <div class="card flush">${ups.length ? `<ul class="list">${ups.map(upItemHTML).join('')}</ul>` : `<div class="empty small"><div class="e">🗓️</div>No bills or planned payments in the next 2 weeks.<br><button class="mini-btn" style="margin-top:10px" data-act="new-rec">Add a recurring bill</button></div>`}</div>
  <div class="sec-h">Recent <button class="link" data-act="tab" data-tab="activity">See all</button></div>
  <div class="card flush">${recent.length ? `<ul class="list">${recent.map(t => txItemHTML(t)).join('')}</ul>` : `<div class="empty small"><div class="e">✨</div>No transactions yet. Tap + to log your first one.</div>`}</div>`;
};
function upItemHTML(u) {
  const d = diffDays(today(), u.date);
  const when = d < 0 ? `<span class="badge neg">Overdue</span>` : d === 0 ? `<span class="badge warn">Today</span>` : `${relDay(u.date)}`;
  const em = u.kind === 'transfer' ? '🔁' : catEmoji(u.categoryId);
  const cls = u.kind === 'income' ? 'pos' : '';
  return `<li class="item"><div class="emoji">${em}</div><div class="grow"><div class="t ellipsis">${esc(u.name)}</div><div class="s">${when} · ${u.src === 'rec' ? 'Recurring' : 'Planned'}${u.kind === 'transfer' ? ' · to ' + esc((acct(u.toAccountId) || {}).name || '') : ''}</div></div>
    <div class="right"><div class="amt num ${cls}">${u.kind === 'income' ? '+' : u.kind === 'expense' ? '−' : ''}${fmt(u.amount, acctCur(u.accountId))}</div>
    ${u.first ? `<button class="mini-btn" style="margin-top:4px" data-act="process" data-src="${u.src}" data-id="${u.id}">Process now</button>` : ''}</div></li>`;
}
const txSort = (a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0);
function txItemHTML(t, opts = {}) {
  const a = acct(t.accountId) || { name: '?' };
  const isT = t.kind === 'transfer';
  const title = t.note || (isT ? 'Transfer' : catName(t.categoryId));
  const subParts = [];
  if (!isT && t.note) subParts.push(esc(catName(t.categoryId)));
  if (isT) subParts.push(`${esc(a.name)} → ${esc((acct(t.toAccountId) || { name: '?' }).name)}`); else if (S().accounts.length > 1) subParts.push(esc(a.name));
  if (opts.showDate) subParts.push(relDay(t.date));
  const tags = (t.tags || []).map(x => `<span class="tag">#${esc(x)}</span>`).join(' ');
  const sign = t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '';
  const sel = ui.selecting ? `<span class="check ${ui.selected.has(t.id) ? 'on' : ''}">${ui.selected.has(t.id) ? '✓' : ''}</span>` : '';
  return `<li class="item tap" data-act="${ui.selecting && opts.selectable ? 'toggle-sel' : 'edit-tx'}" data-id="${t.id}">${sel}<div class="emoji">${isT ? '🔁' : catEmoji(t.categoryId)}</div>
    <div class="grow"><div class="t ellipsis">${esc(title)} ${t.planned ? '<span class="badge warn">Planned</span>' : ''}${t.recurringId ? ' <span class="badge">↻</span>' : ''}</div><div class="s ellipsis">${subParts.join(' · ')} ${tags}</div></div>
    <div class="amt num ${t.kind === 'income' ? 'pos' : ''}">${sign}${fmt(t.amount, acctCur(t.accountId))}</div></li>`;
}

/* ===== Activity ===== */
function filteredTx() {
  const q = ui.search.trim().toLowerCase();
  return S().transactions.filter(t => {
    if (ui.filter === 'expense' && t.kind !== 'expense') return false;
    if (ui.filter === 'income' && t.kind !== 'income') return false;
    if (ui.filter === 'transfer' && t.kind !== 'transfer') return false;
    if (ui.filter === 'planned' && !t.planned) return false;
    if (ui.filter.startsWith('acc:') && t.accountId !== ui.filter.slice(4) && t.toAccountId !== ui.filter.slice(4)) return false;
    if (ui.filter.startsWith('cat:') && t.categoryId !== ui.filter.slice(4)) return false;
    if (!q) return true;
    const hay = [t.note, catName(t.categoryId), (acct(t.accountId) || {}).name, ...(t.tags || []).map(x => '#' + x), String(t.amount), t.date].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }).sort(txSort);
}
VIEWS.activity = () => {
  const list = filteredTx();
  const groups = [];
  for (const t of list.slice(0, 600)) { const g = groups[groups.length - 1]; if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] }); }
  const filters = [['all', 'All'], ['expense', 'Expenses'], ['income', 'Income'], ['transfer', 'Transfers'], ['planned', 'Planned']];
  const extra = ui.filter.startsWith('cat:') ? [[ui.filter, catEmoji(ui.filter.slice(4)) + ' ' + catName(ui.filter.slice(4))]] : ui.filter.startsWith('acc:') ? [[ui.filter, (acct(ui.filter.slice(4)) || {}).name]] : [];
  const totOut = sum(list.filter(t => t.kind === 'expense' && !t.planned), txBase), totIn = sum(list.filter(t => t.kind === 'income' && !t.planned), txBase);
  return `<div class="row" style="margin:6px 0 10px"><input class="input grow" id="search" type="search" placeholder="Search notes, categories, #tags, amounts" value="${esc(ui.search)}" autocomplete="off">
    <button class="mini-btn ${ui.selecting ? 'neg' : ''}" data-act="select-mode">${ui.selecting ? 'Done' : 'Select'}</button></div>
  <div class="chips">${[...extra, ...filters].map(([k, l]) => `<button class="chip ${ui.filter === k ? 'on' : ''}" data-act="filter" data-f="${esc(k)}">${esc(l)}</button>`).join('')}</div>
  ${ui.selecting ? `<div class="card row"><span class="grow"><b>${ui.selected.size}</b> selected</span><button class="mini-btn" data-act="select-all">Select all</button><button class="mini-btn neg" data-act="bulk-delete" ${ui.selected.size ? '' : 'disabled'}>Delete</button></div>` : ''}
  ${list.length && (ui.search || ui.filter !== 'all') ? `<div class="small muted" style="margin:8px 4px">${list.length} result${list.length === 1 ? '' : 's'} · out ${fmt(totOut)} · in ${fmt(totIn)}</div>` : ''}
  ${groups.length ? groups.map(g => {
    const dayOut = sum(g.items.filter(t => t.kind === 'expense' && !t.planned), txBase);
    return `<div class="day-h"><span>${relDay(g.date)}</span><span class="num">${dayOut ? '−' + fmt(dayOut) : ''}</span></div>
      <div class="card flush" style="margin:0;padding:0;overflow:hidden"><ul class="list">${g.items.map(t => ui.selecting ? txItemHTML(t, { selectable: true }) : swipeWrap(t)).join('')}</ul></div>`;
  }).join('') : `<div class="empty"><div class="e">🔍</div>${ui.search ? 'No matching transactions.' : 'Nothing here yet.'}</div>`}
  ${list.length > 600 ? '<div class="hint">Showing the latest 600. Search to narrow down.</div>' : ''}
  ${!ui.selecting && list.length ? '<div class="hint" style="margin-top:14px">Swipe left to delete. Swipe right on a planned transaction to process it.</div>' : ''}`;
};
function swipeWrap(t) {
  return `<div class="swipe" data-id="${t.id}" data-planned="${t.planned ? 1 : 0}"><div class="acts">${t.planned ? `<button class="proc" data-act="process" data-src="plan" data-id="${t.id}">Process</button>` : ''}<button class="del" data-act="delete-tx" data-id="${t.id}">Delete</button></div>
    <div class="front">${txItemHTML(t)}</div></div>`;
}
function bindSwipes(root) {
  for (const el of $$('.swipe', root)) {
    const front = $('.front', el); let x0 = null, y0 = 0, dx = 0, locked = null, base = 0;
    el.addEventListener('pointerdown', e => { if (e.target.closest('.acts')) return; x0 = e.clientX; y0 = e.clientY; dx = 0; locked = null; base = +(front.dataset.off || 0); });
    el.addEventListener('pointermove', e => {
      if (x0 == null) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (locked == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (locked !== 'x') return;
      dx = base + mx; if (el.dataset.planned !== '1') dx = Math.min(0, dx);
      dx = Math.max(-120, Math.min(120, dx));
      el.classList.add('dragging'); front.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
      if (x0 == null) return; el.classList.remove('dragging');
      if (locked === 'x') {
        const off = dx < -50 ? -96 : dx > 50 ? 104 : 0;
        $$('.swipe .front').forEach(f => { if (f !== front) { f.style.transform = ''; f.dataset.off = 0; } });
        front.style.transform = off ? `translateX(${off}px)` : ''; front.dataset.off = off;
        el.dataset.justSwiped = '1'; setTimeout(() => delete el.dataset.justSwiped, 50);
      }
      x0 = null;
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
}

/* ===== Budget ===== */
VIEWS.budget = () => {
  const [ps, pe] = periodRange(ui.budOff);
  const spent = spendByCat(ps, pe);
  const cats = S().categories.filter(c => c.kind === 'expense' && !c.archived);
  const budgetedCats = cats.filter(c => +c.budget > 0);
  const totalBudget = sum(budgetedCats, c => +c.budget);
  const totalSpent = sum(Object.values(spent));
  // Pace only looks at day-to-day spending: bills from recurring items land in one go and shouldn't trip the warning
  const fixedSpent = sum(txIn(ps, pe, x => x.kind === 'expense' && x.recurringId && cat(x.categoryId) && +cat(x.categoryId).budget > 0), txBase);
  const flexBudget = Math.max(0, totalBudget - fixedSpent), flexUsed = flexBudget ? (totalSpent - fixedSpent) / flexBudget : 0;
  const t = today(), isCur = ui.budOff === 0;
  const elapsed = isCur ? (diffDays(ps, t) + 1) / (diffDays(ps, pe) + 1) : 1;
  const left = totalBudget - totalSpent;
  const daysLeft = isCur ? diffDays(t, pe) + 1 : 0;
  const groups = {};
  for (const c of cats) (groups[c.group || 'Other'] = groups[c.group || 'Other'] || []).push(c);
  const catRow = c => {
    const sp = spent[c.id] || 0, b = +c.budget || 0;
    const over = b && sp > b, near = b && !over && sp > b * Math.max(.85, elapsed);
    return `<li class="item tap" data-act="edit-cat" data-id="${c.id}"><div class="emoji">${c.emoji}</div><div class="grow">
      <div class="row"><span class="t grow ellipsis">${esc(c.name)}</span><span class="num amt ${over ? 'neg' : ''}">${fmt(sp)}${b ? `<span class="muted small"> / ${fmt(b, null, { whole: true })}</span>` : ''}</span></div>
      ${b ? `<div class="prog"><i class="${over ? 'over' : near ? 'near' : ''}" style="width:${Math.min(100, sp / b * 100).toFixed(1)}%"></i></div>
      <div class="s ${over ? 'neg' : ''}" style="margin-top:3px">${over ? `${fmt(sp - b)} over budget` : `${fmt(b - sp)} left${isCur && daysLeft ? ` · ${fmt((b - sp) / daysLeft)}/day` : ''}`}</div>` : `<div class="s">No budget · tap to set</div>`}
    </div></li>`;
  };
  const unc = spent['_'] || 0;
  return `<div class="nav-row"><button class="arrow" data-act="bud-nav" data-d="-1">‹</button><div class="title">${periodLabel([ps, pe])}</div><button class="arrow" data-act="bud-nav" data-d="1" ${ui.budOff >= 0 ? 'disabled' : ''}>›</button></div>
  <div class="card">
    <div class="row"><div class="grow"><div class="small muted">${totalBudget ? (left >= 0 ? 'Left to spend' : 'Over budget') : 'Spent'}</div>
      <div class="num" style="font-size:32px;font-weight:760;letter-spacing:-.02em" ${totalBudget && left < 0 ? 'class="neg"' : ''}><span class="${totalBudget && left < 0 ? 'neg' : ''}">${fmt(totalBudget ? Math.abs(left) : totalSpent)}</span></div></div>
      ${totalBudget ? `<div class="right small muted">Spent <b class="num" style="color:var(--ink)">${fmt(totalSpent)}</b><br>of <span class="num">${fmt(totalBudget)}</span></div>` : ''}</div>
    ${totalBudget ? `<div class="bench"><i style="width:${Math.min(100, totalSpent / totalBudget * 100)}%;${left < 0 ? 'background:var(--neg)' : ''}"></i>${isCur ? `<span class="mark" style="left:${(elapsed * 100).toFixed(1)}%" title="Today"></span>` : ''}</div>
    <div class="small muted">${isCur ? (flexBudget && flexUsed > elapsed + .05 ? `⚠️ Day-to-day spending is running fast — ${pct(flexUsed)} of it used with ${pct(elapsed)} of the period gone.` : `✅ On pace — ${pct(totalSpent / totalBudget)} used, ${pct(elapsed)} of the period gone. ${daysLeft} days left${left > 0 ? `, about ${fmt(left / daysLeft)} a day` : ''}.`) : ''}</div>`
      : `<div class="small muted" style="margin-top:6px">Set a monthly budget on any category to track what's left.</div>`}
  </div>
  ${Object.entries(groups).map(([g, cs]) => {
    const gs = sum(cs, c => spent[c.id] || 0), gb = sum(cs, c => +c.budget || 0);
    return `<div class="sec-h">${esc(g)} <span class="link num" style="color:var(--muted);cursor:default">${fmt(gs, null, { whole: true })}${gb ? ' / ' + fmt(gb, null, { whole: true }) : ''}</span></div>
    <div class="card flush"><ul class="list">${cs.sort((a, b) => (spent[b.id] || 0) - (spent[a.id] || 0)).map(catRow).join('')}</ul></div>`;
  }).join('')}
  ${unc ? `<div class="card row"><div class="emoji">❔</div><div class="grow t">Uncategorized</div><div class="amt num">${fmt(unc)}</div></div>` : ''}
  <button class="btn ghost" data-act="new-cat">+ New category</button>`;
};

/* ===== Insights ===== */
function insightRange() { return ui.insMode === 'year' ? yearRange(ui.insOff) : periodRange(ui.insOff); }
function insightCard(key, title, body, sentence) {
  const open = ui.openInsight === key;
  return `<div class="card"><h2>${title}<button class="insight-btn" data-act="insight" data-k="${key}">${open ? 'Hide' : '✦ Explain'}</button></h2>${body}
    ${open ? `<div class="insight"><span>✦</span><span>${sentence}</span></div>` : ''}</div>`;
}
VIEWS.insights = () => {
  const [a, b] = insightRange();
  const isYear = ui.insMode === 'year';
  const prev = isYear ? yearRange(ui.insOff - 1) : periodRange(ui.insOff - 1);
  const tot = totals(a, b), ptot = totals(prev[0], prev[1]);
  const byCat = spendByCat(a, b);
  const catRows = Object.entries(byCat).map(([id, v]) => ({ id, v, label: id === '_' ? 'Uncategorized' : catName(id), emoji: id === '_' ? '❔' : catEmoji(id) })).sort((x, y) => y.v - x.v);
  const segs = catRows.slice(0, 7).map((r, i) => ({ ...r, color: PALETTE[i] }));
  if (catRows.length > 7) segs.push({ label: 'Everything else', emoji: '…', v: sum(catRows.slice(7), r => r.v), color: PALETTE[7] });
  const title = isYear ? String(parseD(a).getFullYear()) : periodLabel([a, b]);
  const isCur = ui.insOff === 0;
  const t = today();

  // 1. Breakdown
  const top = catRows[0];
  const s1 = !tot.expense ? 'No spending logged in this period yet.' : `${top.emoji} ${esc(top.label)} is your biggest category at ${pct(top.v / tot.expense)} of spending (${fmt(top.v)})${catRows[1] ? `, followed by ${esc(catRows[1].label)} at ${pct(catRows[1].v / tot.expense)}` : ''}.`;
  const breakdown = `${donutSVG(segs, fmt(tot.expense, null, { whole: true }), 'spent')}
    <div class="legend">${segs.map(s => `<div class="li tap" data-act="filter-cat" data-id="${s.id || ''}"><span class="dot" style="background:${s.color}"></span><span class="grow ellipsis">${s.emoji} ${esc(s.label)}</span><span class="num amt">${fmt(s.v)}</span><span class="muted small num" style="width:38px;text-align:right">${pct(s.v / (tot.expense || 1))}</span></div>`).join('')}</div>`;

  // 2. Trend
  let trend, s2;
  if (isYear) {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const ms = `${a.slice(0, 4)}-${pad(m + 1)}-01`, me = addDays(addMonths(ms, 1, 1), -1);
      const tt = totals(ms, me);
      months.push({ label: fmtDate(ms, { month: 'narrow' }), a: tt.income, b: tt.expense, dim: ms > t, full: fmtDate(ms, { month: 'long' }) });
    }
    const active = months.filter(m => !m.dim && (m.a || m.b));
    const avg = active.length ? sum(active, m => m.b) / active.length : 0;
    const hi = active.slice().sort((x, y) => y.b - x.b)[0];
    trend = `${barsSVG(months, { colorA: 'var(--c1)', colorB: 'var(--c2)' })}<div class="legend" style="grid-template-columns:1fr 1fr"><div class="li"><span class="dot" style="background:var(--c1)"></span>Income</div><div class="li"><span class="dot" style="background:var(--c2)"></span>Spending</div></div>`;
    s2 = !active.length ? 'No activity logged this year yet.' : `You spend about ${fmt(avg)} a month on average this year. ${hi ? `${hi.full} was the highest at ${fmt(hi.b)}.` : ''}`;
  } else {
    const days = diffDays(a, b) + 1, pdays = diffDays(prev[0], prev[1]) + 1;
    const cum = (s, e, n) => { const m = {}; for (const x of txIn(s, e, x => x.kind === 'expense')) m[x.date] = (m[x.date] || 0) + txBase(x); const out = []; let c = 0; for (let i = 0; i < n; i++) { const d = addDays(s, i); c += m[d] || 0; out.push({ v: d > t ? null : round2(c), label: fmtDate(d), full: fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' }) }); } return out; };
    const cur = cum(a, b, days), pv = cum(prev[0], prev[1], Math.max(days, pdays)).slice(0, days);
    const idx = isCur ? Math.min(days - 1, diffDays(a, t)) : days - 1;
    const nowV = cur[idx].v || 0, thenV = pv[idx] ? pv[idx].v || 0 : 0;
    const diff = nowV - thenV;
    trend = `<div class="readout" id="trend-readout" data-default="Touch the chart to inspect">Touch the chart to inspect</div>${lineSVG('trend', [{ points: cur, color: 'var(--c1)', area: true, name: 'This period' }, { points: pv, color: 'var(--muted)', dash: true, name: 'Last period' }], { zero: true })}
      <div class="legend" style="grid-template-columns:1fr 1fr"><div class="li"><span class="dot" style="background:var(--c1)"></span>This period</div><div class="li"><span class="dot" style="background:var(--muted)"></span>Last period</div></div>`;
    s2 = !thenV && !nowV ? 'No spending in this or the previous period yet.' : !thenV ? `You've spent ${fmt(nowV)} so far; there is no earlier period to compare with.` : `By this point in the period you've spent ${fmt(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than last time (${diff > 0 ? '+' : '−'}${pct(Math.abs(diff) / thenV)}).`;
  }

  // 3. Top spending (by note / merchant)
  const byNote = {};
  for (const x of txIn(a, b, x => x.kind === 'expense')) { const k = (x.note || catName(x.categoryId)).trim(); const e = byNote[k] = byNote[k] || { label: k, v: 0, n: 0, emoji: catEmoji(x.categoryId) }; e.v += txBase(x); e.n++; }
  const topRows = Object.values(byNote).sort((x, y) => y.v - x.v).slice(0, 6);
  const s3 = !topRows.length ? 'Nothing to rank yet.' : `${esc(topRows[0].label)} tops your list with ${topRows[0].n} payment${topRows[0].n > 1 ? 's' : ''} totaling ${fmt(topRows[0].v)}${tot.expense ? ` — ${pct(topRows[0].v / tot.expense)} of everything you spent` : ''}.`;
  const topBody = topRows.length ? hbars(topRows, tot.expense) : '<div class="empty small">No spending yet</div>';

  // 4. Saving rate
  const saved = tot.income - tot.expense;
  const rate = tot.income > 0 ? saved / tot.income : null;
  const BENCH = .2;
  const rateBody = `<div class="row"><div class="grow"><div class="num" style="font-size:34px;font-weight:760;letter-spacing:-.02em" >${rate == null ? (tot.toSavings > 0 || saved > 0 ? 'No income' : '—') : `<span class="${rate < 0 ? 'neg' : ''}">${pct(rate)}</span>`}</div>
      <div class="small muted">${rate == null ? (tot.toSavings > 0 ? `${fmt(tot.toSavings)} moved to savings, but no income was logged` : 'Log income to see your saving rate') : `${saved >= 0 ? 'Saved' : 'Overspent'} ${fmt(Math.abs(saved))} of ${fmt(tot.income)} income`}</div></div>
      ${ptot.income > 0 && rate != null ? `<span class="badge ${rate >= ptot.net / ptot.income ? 'acc' : 'warn'}">${rate >= ptot.net / ptot.income ? '▲' : '▼'} ${pct(Math.abs(rate - ptot.net / ptot.income))} vs last</span>` : ''}</div>
    <div class="bench"><i style="width:${rate == null ? 0 : Math.max(0, Math.min(100, rate * 100))}%;${rate != null && rate < BENCH ? 'background:var(--warn)' : ''}"></i><span class="mark" style="left:${BENCH * 100}%"></span></div>
    <div class="small muted">Benchmark: a common guideline is to save at least 20% of income.</div>`;
  const s4 = rate == null ? (tot.toSavings > 0 ? 'You moved money to savings, but no income was logged for this period, so a rate can\'t be calculated.' : 'Your saving rate appears once income is logged.') : rate >= BENCH ? `You kept ${pct(rate)} of your income — above the 20% benchmark. Nice work.` : rate >= 0 ? `You kept ${pct(rate)} of your income, ${pct(BENCH - rate)} short of the 20% benchmark — that's about ${fmt((BENCH - rate) * tot.income)} more to reach it.` : `You spent ${fmt(-saved)} more than you earned this period.`;

  // 5. Money flow
  const flowRows = catRows.slice(0, 8);
  const flowMax = Math.max(tot.income, tot.expense, 1);
  const flowBody = `<div class="row small" style="margin-bottom:8px"><span class="grow"><b>Money in</b></span><b class="num pos">${fmt(tot.income)}</b></div>
    <div class="stack" style="height:16px"><i style="width:${(tot.income / flowMax * 100).toFixed(1)}%;background:var(--c1)"></i></div>
    <div class="row small" style="margin:12px 0 8px"><span class="grow"><b>Money out</b> <span class="muted">largest first</span></span><b class="num">${fmt(tot.expense)}</b></div>
    <div class="stack" style="height:16px">${flowRows.map((r, i) => `<i title="${esc(r.label)}" style="width:${(r.v / flowMax * 100).toFixed(2)}%;background:${PALETTE[(i + 1) % 8]}"></i>`).join('')}</div>
    <div class="legend" style="margin-top:10px">${flowRows.map((r, i) => `<div class="li"><span class="dot" style="background:${PALETTE[(i + 1) % 8]}"></span><span class="grow ellipsis">${r.emoji} ${esc(r.label)}</span><span class="num">${fmt(r.v)}</span></div>`).join('')}
    <div class="li" style="border-top:1px solid var(--line);padding-top:6px"><span class="grow"><b>${saved >= 0 ? 'Left over' : 'Shortfall'}</b></span><b class="num ${saved < 0 ? 'neg' : 'pos'}">${fmt(saved)}</b></div></div>`;
  const s5 = !tot.income && !tot.expense ? 'No money moved in this period.' : tot.income ? `For every ${fmt(100, null, { whole: true })} that came in, ${fmt(tot.expense / tot.income * 100, null, { whole: true })} went out${top ? `, and ${fmt(top.v / tot.income * 100, null, { whole: true })} of it went to ${esc(top.label)}` : ''}.` : `${fmt(tot.expense)} went out with no income logged.`;

  // 6. Needs vs wants (50/30/20)
  let need = 0, want = 0;
  for (const r of catRows) { const c = cat(r.id); if (c && c.nature === 'need') need += r.v; else want += r.v; }
  const base = tot.income || (need + want) || 1;
  const nw = `<div class="stack"><i style="width:${(need / base * 100).toFixed(1)}%;background:var(--c3)"></i><i style="width:${(want / base * 100).toFixed(1)}%;background:var(--c2)"></i><i style="width:${(Math.max(0, saved) / base * 100).toFixed(1)}%;background:var(--c1)"></i></div>
    <div class="legend">
      <div class="li"><span class="dot" style="background:var(--c3)"></span><span class="grow">Needs</span><span class="num">${fmt(need)}</span><span class="muted small num" style="width:80px;text-align:right">${pct(need / base)} <span style="opacity:.7">/ 50%</span></span></div>
      <div class="li"><span class="dot" style="background:var(--c2)"></span><span class="grow">Wants</span><span class="num">${fmt(want)}</span><span class="muted small num" style="width:80px;text-align:right">${pct(want / base)} <span style="opacity:.7">/ 30%</span></span></div>
      <div class="li"><span class="dot" style="background:var(--c1)"></span><span class="grow">Saved</span><span class="num">${fmt(Math.max(0, saved))}</span><span class="muted small num" style="width:80px;text-align:right">${tot.income ? pct(Math.max(0, saved) / base) : '—'} <span style="opacity:.7">/ 20%</span></span></div>
    </div><div class="small muted" style="margin-top:8px">Benchmark: the 50/30/20 rule${tot.income ? ', as a share of income' : ' (log income to compare)'}. Mark categories as needs or wants in the Budget tab.</div>`;
  const s6 = !(need + want) ? 'No spending to classify yet.' : tot.income ? (want / base > .3 ? `Wants take ${pct(want / base)} of your income, above the 30% guideline — trimming ${fmt(want - .3 * base)} would bring you in line.` : need / base > .5 ? `Needs take ${pct(need / base)} of income, above the 50% guideline, which leaves less room for savings.` : `You're within the 50/30/20 guideline: ${pct(need / base)} needs, ${pct(want / base)} wants.`) : `${pct(need / (need + want))} of your spending went to needs and ${pct(want / (need + want))} to wants.`;

  return `<div class="seg" style="margin-top:6px"><button class="${!isYear ? 'on' : ''}" data-act="ins-mode" data-m="month">Month</button><button class="${isYear ? 'on' : ''}" data-act="ins-mode" data-m="year">Year</button></div>
  <div class="nav-row"><button class="arrow" data-act="ins-nav" data-d="-1">‹</button><div class="title">${esc(title)}</div><button class="arrow" data-act="ins-nav" data-d="1" ${ui.insOff >= 0 ? 'disabled' : ''}>›</button></div>
  <div class="kpis"><div class="kpi"><div class="k">Income</div><div class="v num pos">${fmt(tot.income, null, { whole: true })}</div></div><div class="kpi"><div class="k">Spent</div><div class="v num">${fmt(tot.expense, null, { whole: true })}</div></div><div class="kpi"><div class="k">Net</div><div class="v num ${tot.net < 0 ? 'neg' : ''}">${fmt(tot.net, null, { whole: true, sign: true })}</div></div></div>
  ${insightCard('breakdown', 'Spending breakdown', breakdown, s1)}
  ${insightCard('trend', isYear ? 'Income vs spending' : 'Spending trend', trend, s2)}
  ${insightCard('top', 'Top spending', topBody, s3)}
  ${insightCard('rate', 'Saving rate', rateBody, s4)}
  ${insightCard('flow', 'Money flow', flowBody, s5)}
  ${insightCard('nw', 'Needs, wants &amp; savings', nw, s6)}
  <div class="hint">Explanations are worked out on your device from your own numbers. Nothing is sent anywhere.</div>`;
};

/* ===== Accounts ===== */
const RANGES = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, 'All': null };
VIEWS.accounts = () => {
  const bal = balances();
  const accs = S().accounts.filter(a => !a.archived);
  const t = today();
  const days = RANGES[ui.accRange];
  const from = days ? addDays(t, -days + 1) : firstDate();
  if (ui.accSel !== 'all' && !acct(ui.accSel)) ui.accSel = 'all';
  const selCur = ui.accSel === 'all' ? S().currency : acctCur(ui.accSel);
  const pts = balanceSeries(ui.accSel, from, t).map(p => ({ ...p, label: fmtDate(p.date, days && days <= 31 ? { month: 'short', day: 'numeric' } : { month: 'short', year: '2-digit' }), full: fmtDate(p.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }));
  const first = pts[0].v, last = pts[pts.length - 1].v, ch = last - first;
  let hi = pts[0], lo = pts[0]; for (const p of pts) { if (p.v > hi.v) hi = p; if (p.v < lo.v) lo = p; }
  const f = v => fmt(v, selCur);
  const summary = pts.length < 2 ? 'Not enough history yet.' : `${ui.accSel === 'all' ? 'Your combined balance' : esc(acct(ui.accSel).name)} ${Math.abs(ch) < .005 ? 'held steady' : ch > 0 ? `rose ${f(ch)}` : `fell ${f(-ch)}`}${first ? ` (${ch >= 0 ? '+' : '−'}${pct(Math.abs(ch / first))})` : ''} over this range. It peaked at ${f(hi.v)} on ${fmtDate(hi.date)} and was lowest at ${f(lo.v)} on ${fmtDate(lo.date)}.`;
  const net = sum(accs, a => toBase(bal[a.id], a.currency));
  const byType = {};
  for (const a of accs) (byType[a.type] = byType[a.type] || []).push(a);
  const archived = S().accounts.filter(a => a.archived);
  return `<div class="chips" style="margin-top:6px"><button class="chip ${ui.accSel === 'all' ? 'on' : ''}" data-act="acc-sel" data-id="all">All accounts</button>${accs.map(a => `<button class="chip ${ui.accSel === a.id ? 'on' : ''}" data-act="acc-sel" data-id="${a.id}">${a.emoji || ''} ${esc(a.name)}</button>`).join('')}</div>
  <div class="card">
    <div class="readout" id="acc-readout" data-default="<b class=&quot;num&quot;>${esc(f(last))}</b>${ch ? `<span class=&quot;${ch < 0 ? 'neg' : 'pos'}&quot;>${esc(fmt(ch, selCur, { sign: true }))}</span> · ${ui.accRange === 'All' ? 'all time' : 'past ' + ui.accRange}` : 'No change'}"><b class="num">${f(last)}</b>${ch ? `<span class="${ch < 0 ? 'neg' : 'pos'}">${fmt(ch, selCur, { sign: true })}</span> · ${ui.accRange === 'All' ? 'all time' : 'past ' + ui.accRange}` : 'No change'}</div>
    ${lineSVG('acc', [{ points: pts, color: ch < 0 ? 'var(--neg)' : 'var(--c1)', area: true }], { h: 170, fmt: f })}
    <div class="seg" style="margin-top:10px">${Object.keys(RANGES).map(r => `<button class="${ui.accRange === r ? 'on' : ''}" data-act="acc-range" data-r="${r}">${r}</button>`).join('')}</div>
    <div class="insight"><span>✦</span><span>${summary}</span></div>
  </div>
  <div class="card row"><div class="grow"><div class="small muted">Net worth</div><div class="num" style="font-size:26px;font-weight:760" ><span class="${net < 0 ? 'neg' : ''}">${fmt(net)}</span></div></div><button class="mini-btn" data-act="new-tx" data-kind="transfer">🔁 Transfer</button></div>
  ${Object.entries(ACCOUNT_TYPES).filter(([k]) => byType[k]).map(([k, label]) => `<div class="sec-h">${label}${byType[k].length > 1 ? 's' : ''} <span class="link num" style="color:var(--muted);cursor:default">${fmt(sum(byType[k], a => toBase(bal[a.id], a.currency)))}</span></div>
    <div class="card flush"><ul class="list">${byType[k].map(a => `<li class="item tap" data-act="edit-acc" data-id="${a.id}"><div class="emoji">${a.emoji || '🏦'}</div><div class="grow"><div class="t ellipsis">${esc(a.name)}</div><div class="s">${a.currency !== S().currency ? a.currency + ' · ' : ''}${S().transactions.filter(t => t.accountId === a.id || t.toAccountId === a.id).length} transactions</div></div>
      <div class="right"><div class="amt num ${bal[a.id] < 0 ? 'neg' : ''}">${fmt(bal[a.id], a.currency)}</div>${a.currency !== S().currency ? `<div class="s num">≈ ${fmt(toBase(bal[a.id], a.currency))}</div>` : ''}</div></li>`).join('')}</ul></div>`).join('')}
  <button class="btn ghost" data-act="new-acc">+ Add account</button>
  ${archived.length ? `<div class="sec-h">Archived</div><div class="card flush"><ul class="list">${archived.map(a => `<li class="item tap" data-act="edit-acc" data-id="${a.id}"><div class="emoji">${a.emoji || '🏦'}</div><div class="grow t muted">${esc(a.name)}</div><div class="amt num muted">${fmt(bal[a.id], a.currency)}</div></li>`).join('')}</ul></div>` : ''}`;
};

function renderOnboarding() {
  document.body.classList.add('onboarding');
  $('#tabs').innerHTML = ''; $('#top').innerHTML = ''; $('#fab').style.display = 'none';
  const cur = guessCurrency();
  $('#view').innerHTML = `<div class="onboard"><img src="../icons/icon-192.png" alt=""><h2>Know what's safe to spend</h2>
    <p class="muted">A private budget tracker. No bank login, no sign-up. Your data stays on this device.</p></div>
    <div class="card">
      <label class="field"><span>Currency</span><select class="input" id="ob-cur">${CURRENCIES.map(c => `<option value="${c.code}" ${c.code === cur ? 'selected' : ''}>${c.code} — ${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Checking account balance right now</span><input class="input num" id="ob-bal" inputmode="decimal" placeholder="0.00"></label>
      <label class="field"><span>How do you get paid?</span><select class="input" id="ob-mode"><option value="recurring">A regular paycheck</option><option value="irregular">Irregular (freelance, gig, varies)</option></select></label>
      <div id="ob-pay">
        <div class="two"><label class="field"><span>Next payday</span><input class="input" type="date" id="ob-next" value="${addDays(today(), 14)}"></label>
        <label class="field"><span>Repeats</span><select class="input" id="ob-freq"><option value="week:1">Weekly</option><option value="week:2" selected>Every 2 weeks</option><option value="month:1">Monthly</option></select></label></div>
        <label class="field"><span>Take-home pay per paycheck</span><input class="input num" id="ob-amt" inputmode="decimal" placeholder="0.00"></label>
      </div>
      <div id="ob-irr" style="display:none"><label class="field"><span>Roughly how much do you earn in a month?</span><input class="input num" id="ob-exp" inputmode="decimal" placeholder="0.00"></label></div>
      <button class="btn" data-act="ob-start">Get started</button>
      <button class="btn ghost" data-act="ob-sample">Explore with sample data</button>
      <label class="btn ghost" style="text-align:center;cursor:pointer">Restore a backup<input type="file" accept=".json,application/json" id="ob-restore" hidden></label>
    </div>`;
  $('#ob-mode').onchange = e => { const irr = e.target.value === 'irregular'; $('#ob-pay').style.display = irr ? 'none' : ''; $('#ob-irr').style.display = irr ? '' : 'none'; };
  $('#ob-restore').onchange = e => restoreBackup(e.target.files[0]);
}
