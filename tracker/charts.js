'use strict';
/* Hand-rolled SVG charts. Colors come from CSS variables so they follow the theme. */
const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
const CHARTS = {}; // id -> data for interactive inspection

function donutSVG(segs, centerTop, centerBottom) {
  const total = sum(segs, s => s.v);
  const R = 70, C = 2 * Math.PI * R, W = 180;
  let off = 0;
  const arcs = total > 0 ? segs.map((s, i) => {
    const len = s.v / total * C;
    const gap = segs.length > 1 ? Math.min(3, len * .3) : 0;
    const el = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${s.color || PALETTE[i % 8]}" stroke-width="22" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"/>`;
    off += len; return el;
  }).join('') : `<circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--card2)" stroke-width="22"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${W}" style="max-width:200px;margin:0 auto" role="img">${arcs}
    <text x="90" y="86" text-anchor="middle" style="font-size:19px;font-weight:750;fill:var(--ink)">${esc(centerTop)}</text>
    <text x="90" y="106" text-anchor="middle" style="font-size:11px">${esc(centerBottom)}</text></svg>`;
}

/* series: [{points:[{x,label,v}], color, dash, area}] all with same length as first */
function lineSVG(id, series, opts = {}) {
  const W = 340, H = opts.h || 150, P = { l: 4, r: 4, t: 10, b: opts.noAxis ? 6 : 20 };
  const all = series.flatMap(s => s.points.map(p => p.v)).filter(v => v != null);
  if (!all.length) return '<div class="empty small">No data yet</div>';
  let min = Math.min(...all, opts.zero ? 0 : Infinity), max = Math.max(...all, opts.zero ? 0 : -Infinity);
  if (min === max) { min -= 1; max += 1; }
  const padY = (max - min) * .08; min -= padY; max += padY;
  const n = Math.max(...series.map(s => s.points.length));
  const X = i => P.l + (n <= 1 ? 0 : i / (n - 1)) * (W - P.l - P.r);
  const Y = v => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  let paths = '';
  series.forEach((s, si) => {
    const pts = s.points.map((p, i) => p.v == null ? null : [X(i), Y(p.v)]).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    if (s.area) paths += `<path d="${d}L${pts[pts.length - 1][0].toFixed(1)} ${H - P.b}L${pts[0][0].toFixed(1)} ${H - P.b}Z" fill="${s.color}" opacity=".12"/>`;
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.4}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="4 4" opacity=".7"' : ''}/>`;
  });
  let axis = '';
  if (!opts.noAxis) {
    const pts = series[0].points; const ticks = opts.ticks || 4;
    for (let k = 0; k < ticks; k++) {
      const i = Math.round(k / (ticks - 1) * (pts.length - 1));
      if (!pts[i]) continue;
      axis += `<text x="${X(i)}" y="${H - 4}" text-anchor="${k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle'}">${esc(pts[i].label)}</text>`;
    }
  }
  const zeroLine = min < 0 && max > 0 ? `<line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)" stroke-dasharray="2 3"/>` : '';
  CHARTS[id] = { series, X, Y, n, W, H, P, fmt: opts.fmt || (v => fmt(v)) };
  return `<svg class="chart" id="${id}" viewBox="0 0 ${W} ${H}" data-inspect="${id}">${zeroLine}${paths}${axis}
    <g class="cursor" style="display:none"><line y1="${P.t}" y2="${H - P.b}" stroke="var(--muted)" stroke-width="1"/>${series.map(s => `<circle r="4.5" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>`).join('')}</g>
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/></svg>`;
}
function attachInspect(root = document) {
  for (const svg of $$('svg[data-inspect]', root)) {
    const id = svg.dataset.inspect, c = CHARTS[id]; if (!c) continue;
    const out = document.getElementById(id + '-readout');
    const cur = svg.querySelector('.cursor');
    const show = e => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * c.W;
      const i = Math.max(0, Math.min(c.n - 1, Math.round((x - c.P.l) / (c.W - c.P.l - c.P.r) * (c.n - 1))));
      cur.style.display = '';
      const line = cur.querySelector('line'); line.setAttribute('x1', c.X(i)); line.setAttribute('x2', c.X(i));
      cur.querySelectorAll('circle').forEach((ci, si) => {
        const p = c.series[si].points[i];
        if (!p || p.v == null) { ci.style.display = 'none'; return; }
        ci.style.display = ''; ci.setAttribute('cx', c.X(i)); ci.setAttribute('cy', c.Y(p.v));
      });
      const p = c.series[0].points[i];
      if (out && p) out.innerHTML = `<b class="num">${esc(c.fmt(p.v))}</b>${esc(p.full || p.label)}${c.series[1] && c.series[1].points[i] && c.series[1].points[i].v != null ? ` · ${esc(c.series[1].name || 'Previous')}: ${esc(c.fmt(c.series[1].points[i].v))}` : ''}`;
    };
    const hide = () => { cur.style.display = 'none'; if (out) out.innerHTML = out.dataset.default || ''; };
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(hide, 1600); });
  }
}

/* Vertical bars, groups of up to two values: [{label, a, b}] */
function barsSVG(data, opts = {}) {
  const W = 340, H = opts.h || 150, P = { t: 8, b: 20 };
  const max = Math.max(1, ...data.flatMap(d => [d.a || 0, d.b || 0]));
  const n = data.length, slot = W / n, two = data.some(d => d.b != null);
  const bw = Math.min(two ? 11 : 20, slot * (two ? .34 : .6));
  let s = '';
  data.forEach((d, i) => {
    const cx = slot * i + slot / 2;
    const bar = (v, x, color) => { const h = (v || 0) / max * (H - P.t - P.b); return `<rect x="${x.toFixed(1)}" y="${(H - P.b - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, v ? 1.5 : 0).toFixed(1)}" rx="3" fill="${color}" ${d.dim ? 'opacity=".35"' : ''}><title>${esc(d.label)}: ${esc(fmt(v || 0))}</title></rect>`; };
    if (two) { s += bar(d.a, cx - bw - 1, opts.colorA || 'var(--c1)'); s += bar(d.b, cx + 1, opts.colorB || 'var(--c2)'); }
    else s += bar(d.a, cx - bw / 2, d.color || opts.colorA || 'var(--c1)');
    if (n <= 12 || i % Math.ceil(n / 8) === 0) s += `<text x="${cx}" y="${H - 5}" text-anchor="middle" ${d.hl ? 'style="fill:var(--ink);font-weight:700"' : ''}>${esc(d.label)}</text>`;
  });
  if (opts.avg != null) { const y = H - P.b - opts.avg / max * (H - P.t - P.b); s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--muted)" stroke-dasharray="3 3"/>`; }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

function hbars(rows, total) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="legend">${rows.map((r, i) => `<div>
    <div class="li"><span>${esc(r.emoji || '')}</span><span class="grow ellipsis">${esc(r.label)}</span><span class="num amt">${esc(fmt(r.v))}</span>${total ? `<span class="muted small num" style="width:38px;text-align:right">${pct(r.v / total)}</span>` : ''}</div>
    <div class="prog" style="margin-top:4px"><i style="width:${(r.v / max * 100).toFixed(1)}%;background:${r.color || PALETTE[i % 8]}"></i></div></div>`).join('')}</div>`;
}
