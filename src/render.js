/* BuildMe renderer v2 — plans, roof, bubble diagram */
(function (root) {
  'use strict';
  const P = root.BuildMe;
  const CAT = {
    drawing: 'pub', lounge: 'pub', dining: 'pub', flounge: 'pub', foyer: 'circ', passage: 'circ', stair: 'circ',
    bed: 'prv', dress: 'prv', study: 'prv',
    bath: 'wet', powder: 'wet', sbath: 'wet',
    kitchen: 'svc', store: 'svc', laundry: 'svc', servant: 'svc', shaft: 'svc',
    porch: 'open', terrace: 'open', court: 'open', proof: 'open',
  };
  const ABBR = { porch: 'CP', foyer: 'EN', drawing: 'DR', lounge: 'TV', dining: 'DN', kitchen: 'K', bed: 'BR', bath: 'B', dress: 'DS', powder: 'PW', stair: 'ST', store: 'S', passage: 'P', servant: 'SQ', sbath: 'SB', terrace: 'OT', flounge: 'FL', study: 'SD', shaft: 'D', court: 'CY', laundry: 'LD', proof: 'PR' };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = v => +(+v).toFixed(3);
  const dimText = r => P.fmt(r.w - P.WALL) + ' × ' + P.fmt(r.h - P.WALL);

  function defs(u) {
    return `<defs><pattern id="hatch${u}" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" fill="var(--f-open)"/><line x1="0" y1="0" x2="0" y2="1.2" stroke="var(--hatch)" stroke-width="0.14"/></pattern>
      <pattern id="roofh${u}" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.6" height="1.6" fill="var(--roof)"/><line x1="0" y1="0" x2="0" y2="1.6" stroke="var(--roof-line)" stroke-width="0.1"/></pattern>
      <pattern id="lawn${u}" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><rect width="2.4" height="2.4" fill="var(--lawn)"/><circle cx="0.6" cy="0.6" r="0.12" fill="var(--lawn-dot)"/><circle cx="1.8" cy="1.8" r="0.12" fill="var(--lawn-dot)"/></pattern></defs>`;
  }

  function site(plan, s, o, u, thumb, m, top) {
    const plot = plan.plot, E = plan.E, D = plan.D;
    s.push(`<rect x="${-m}" y="${-top + (thumb ? 0.5 : 1)}" width="${plot.w + 2 * m}" height="${thumb ? 4.5 : 9}" fill="var(--road)"/>`);
    if (!thumb) {
      s.push(`<line x1="${-m}" y1="${-top + 5.5}" x2="${plot.w + m}" y2="${-top + 5.5}" stroke="var(--road-line)" stroke-width="0.22" stroke-dasharray="2 1.6"/>`);
      s.push(`<text x="${plot.w / 2}" y="${-top + 4.4}" class="t-road" text-anchor="middle">${esc((o.facing || 'NORTH'))} ROAD</text>`);
    }
    s.push(`<rect x="0" y="0" width="${plot.w}" height="${plot.d}" fill="url(#lawn${u})"/>`);
    const porch = plan.floors[0].rooms.find(r => r.t === 'porch');
    if (porch) s.push(`<rect x="${f2(porch.x)}" y="0" width="${f2(porch.w)}" height="${f2(Math.max(0, porch.y))}" fill="var(--pave)"/>`);
    s.push(`<rect x="${E.x0}" y="${E.y0}" width="${E.W}" height="${D}" fill="var(--sheet)"/>`);
    return porch;
  }

  function renderFloor(plan, fi, o) {
    o = o || {};
    const fl = plan.floors[fi]; const plot = plan.plot, E = plan.E, D = plan.D;
    const thumb = !!o.thumb; const u = fi + (o.uid || '');
    const m = thumb ? 2 : 7, top = thumb ? 6 : 15;
    const vb = [-m, -top, plot.w + 2 * m, plot.d + top + (thumb ? 2 : 9)];
    const s = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" class="plan-svg${thumb ? ' thumb' : ''}" role="img" aria-label="${fi === 0 ? 'Ground' : 'First'} floor plan">`, defs(u)];
    const gp = site(plan, s, o, u, thumb, m, top);
    // FF: porch in setback below is a roof only
    if (fi === 1 && gp && gp.ext > 0) {
      s.push(`<rect x="${f2(gp.x)}" y="${f2(gp.y)}" width="${f2(gp.w)}" height="${f2(gp.ext)}" fill="url(#roofh${u})" stroke="var(--boundary)" stroke-width="0.12" stroke-dasharray="0.6 0.4"/>`);
      if (!thumb && gp.ext >= 3) s.push(`<text x="${f2(gp.x + gp.w / 2)}" y="${f2(gp.y + gp.ext / 2 + 0.35)}" class="t-open" text-anchor="middle">PORCH ROOF</text>`);
    }
    fl.rooms.forEach(r => {
      const c = CAT[r.t];
      const fill = r.t === 'proof' ? `url(#roofh${u})` : c === 'open' ? `url(#hatch${u})` : `var(--f-${c})`;
      const sel = o.sel && r.src === o.sel;
      s.push(`<rect class="rm${sel ? ' sel' : ''}" data-src="${esc(r.src || '')}" data-t="${r.t}" x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" fill="${fill}"/>`);
    });
    const wallW = thumb ? 0.5 : 0.42;
    fl.rooms.forEach(r => { if (CAT[r.t] !== 'open') s.push(`<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" fill="none" stroke="var(--wall)" stroke-width="${wallW}" pointer-events="none"/>`); });
    // exterior walls, drawn inside the external line (coverage is measured externally)
    const x1 = E.x0 + E.W, y1 = E.y0 + D, eps = 0.05, t = thumb ? 0.8 : 0.75, h = t / 2;
    fl.rooms.forEach(r => {
      if (CAT[r.t] === 'open') return; const seg = [];
      if (Math.abs(r.y - E.y0) < eps) seg.push([r.x, r.y + h, r.x + r.w, r.y + h]);
      if (Math.abs(r.y + r.h - y1) < eps) seg.push([r.x, y1 - h, r.x + r.w, y1 - h]);
      if (Math.abs(r.x - E.x0) < eps) seg.push([r.x + h, r.y, r.x + h, r.y + r.h]);
      if (Math.abs(r.x + r.w - x1) < eps) seg.push([x1 - h, r.y, x1 - h, r.y + r.h]);
      seg.forEach(q => s.push(`<line x1="${f2(q[0])}" y1="${f2(q[1])}" x2="${f2(q[2])}" y2="${f2(q[3])}" stroke="var(--wall)" stroke-width="${t}" stroke-linecap="square" pointer-events="none"/>`));
    });
    fl.rooms.forEach(r => {
      if (r.t === 'porch') [[r.x, r.y], [r.x + r.w, r.y]].forEach(([cx, cy]) => s.push(`<rect x="${f2(Math.min(Math.max(cx - 0.5, r.x), r.x + r.w - 1))}" y="${f2(cy)}" width="1" height="1" fill="var(--wall)"/>`));
      else if (r.t === 'terrace' || r.t === 'court') s.push(`<rect x="${f2(r.x + 0.2)}" y="${f2(r.y + 0.2)}" width="${f2(r.w - 0.4)}" height="${f2(r.h - 0.4)}" fill="none" stroke="var(--wall)" stroke-width="0.25" pointer-events="none"/>`);
    });
    if (!thumb) fl.windows.forEach(w => {
      const tt = 0.75;
      if (w.orient === 'h') { const yy = Math.abs(w.at - E.y0) < eps ? w.at + h : Math.abs(w.at - y1) < eps ? w.at - h : w.at; s.push(`<rect x="${f2(w.p0)}" y="${f2(yy - tt / 2)}" width="${f2(w.p1 - w.p0)}" height="${tt}" fill="var(--sheet)" stroke="var(--wall)" stroke-width="0.1"/><line x1="${f2(w.p0)}" y1="${f2(yy)}" x2="${f2(w.p1)}" y2="${f2(yy)}" stroke="var(--glass)" stroke-width="0.14"/>`); }
      else { const xx = Math.abs(w.at - E.x0) < eps ? w.at + h : Math.abs(w.at - x1) < eps ? w.at - h : w.at; s.push(`<rect x="${f2(xx - tt / 2)}" y="${f2(w.p0)}" width="${tt}" height="${f2(w.p1 - w.p0)}" fill="var(--sheet)" stroke="var(--wall)" stroke-width="0.1"/><line x1="${f2(xx)}" y1="${f2(w.p0)}" x2="${f2(xx)}" y2="${f2(w.p1)}" stroke="var(--glass)" stroke-width="0.14"/>`); }
    });
    fl.doors.forEach(d => {
      let tt = d.at; const a = d.p0, b = d.p1, len = b - a, gap = 0.95;
      if (d.orient === 'h' && Math.abs(tt - E.y0) < eps) tt += h; else if (d.orient === 'h' && Math.abs(tt - y1) < eps) tt -= h;
      if (d.orient === 'v' && Math.abs(tt - E.x0) < eps) tt += h; else if (d.orient === 'v' && Math.abs(tt - x1) < eps) tt -= h;
      if (d.orient === 'h') s.push(`<rect x="${f2(a)}" y="${f2(tt - gap / 2)}" width="${f2(len)}" height="${gap}" fill="var(--gap)" pointer-events="none"/>`);
      else s.push(`<rect x="${f2(tt - gap / 2)}" y="${f2(a)}" width="${gap}" height="${f2(len)}" fill="var(--gap)" pointer-events="none"/>`);
      if (thumb || d.kind === 'open') return;
      const hinge = d.hingeStart ? a : b, free = d.hingeStart ? b : a, dir = d.dir;
      let lx, ly, hx, hy, fx, fy;
      if (d.orient === 'h') { hx = hinge; hy = tt; lx = hinge; ly = tt + dir * len; fx = free; fy = tt; } else { hx = tt; hy = hinge; lx = tt + dir * len; ly = hinge; fx = tt; fy = free; }
      const sweep = ((lx - hx) * (fy - hy) - (ly - hy) * (fx - hx)) > 0 ? 1 : 0;
      s.push(`<line x1="${f2(hx)}" y1="${f2(hy)}" x2="${f2(lx)}" y2="${f2(ly)}" stroke="var(--wall)" stroke-width="0.16" pointer-events="none"/><path d="M ${f2(lx)} ${f2(ly)} A ${f2(len)} ${f2(len)} 0 0 ${sweep} ${f2(fx)} ${f2(fy)}" fill="none" stroke="var(--door-arc)" stroke-width="0.1" pointer-events="none"/>`);
    });
    fl.rooms.filter(r => r.t === 'stair').forEach(r => s.push(stairGlyph(r, fi, thumb)));
    if (!thumb) fl.rooms.filter(r => r.skylight).forEach(r => {
      const sw = Math.min(5, r.w * 0.4), sh = Math.min(5, r.h * 0.35);
      s.push(`<rect x="${f2(r.x + r.w / 2 - sw / 2)}" y="${f2(r.y + r.h * 0.64 - sh / 2)}" width="${f2(sw)}" height="${f2(sh)}" fill="none" stroke="var(--glass)" stroke-width="0.12" stroke-dasharray="0.5 0.35" pointer-events="none"/>`);
    });
    if (!thumb) fl.rooms.forEach(r => s.push(label(r)));
    s.push(`<rect x="0" y="0" width="${plot.w}" height="${plot.d}" fill="none" stroke="var(--boundary)" stroke-width="${thumb ? 0.45 : 0.35}" pointer-events="none"/>`);
    if (gp) s.push(`<line x1="${f2(gp.x + 0.5)}" y1="0" x2="${f2(gp.x + gp.w - 0.5)}" y2="0" stroke="var(--pave)" stroke-width="${thumb ? 0.8 : 0.6}"/>`);
    if (!thumb) s.push(dims(plan));
    s.push('</svg>');
    return s.join('');
  }

  function stairGlyph(r, fi, thumb) {
    const pad = 0.4, x = r.x + pad, y = r.y + pad, w = r.w - 2 * pad, h = r.h - 2 * pad;
    const land = Math.min(w / 2 + 0.6, h * 0.35), fw = w / 2, run = h - land, n = Math.max(4, Math.floor(run / 0.85));
    const L = []; for (let i = 0; i <= n; i++) { const yy = y + land + run * i / n; L.push(`M ${f2(x)} ${f2(yy)} H ${f2(x + w)}`); }
    let s = `<g pointer-events="none"><path d="${L.join(' ')}" stroke="var(--stair)" stroke-width="${thumb ? 0.18 : 0.1}" fill="none"/><line x1="${f2(x + fw)}" y1="${f2(y + land)}" x2="${f2(x + fw)}" y2="${f2(y + h)}" stroke="var(--wall)" stroke-width="0.22"/>`;
    if (!thumb) s += `<path d="M ${f2(x + fw / 2)} ${f2(y + h - 0.6)} V ${f2(y + land / 2)} H ${f2(x + fw * 1.5)} V ${f2(y + h - 1.4)}" fill="none" stroke="var(--accent)" stroke-width="0.14"/><path d="M ${f2(x + fw * 1.5 - 0.45)} ${f2(y + h - 2)} L ${f2(x + fw * 1.5)} ${f2(y + h - 1.2)} L ${f2(x + fw * 1.5 + 0.45)} ${f2(y + h - 2)}" fill="none" stroke="var(--accent)" stroke-width="0.14"/><text x="${f2(x + fw / 2)}" y="${f2(y + h - 1.1)}" class="t-tiny" text-anchor="middle">${fi === 0 ? 'UP' : 'DN'}</text>`;
    return s + '</g>';
  }

  function label(r) {
    if (r.t === 'shaft') return '';
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, mn = Math.min(r.w, r.h);
    const vertical = r.w < 5.2 && r.h > r.w * 1.6; const span = vertical ? r.h : r.w;
    let name = (r.name || '').toUpperCase();
    if (r.t === 'proof') name = 'PORCH ROOF';
    const small = span < 7.5 || mn < 4.2;
    if (small) name = r.t === 'dress' && r.wr ? 'W/R' : (span < 5.5 ? ABBR[r.t] : name.replace('BEDROOM', 'BED').replace('OPEN TERRACE', 'TERRACE'));
    if (r.t === 'stair') name = 'STAIR';
    const fs = Math.max(0.72, Math.min(1.35, span / Math.max(name.length, 4) * 1.35, mn * 0.2));
    const ty = r.t === 'stair' ? r.y + 0.4 + Math.min(r.w / 2 + 0.6, (r.h - 0.8) * 0.35) / 2 + 0.35 : cy;
    const tr = vertical ? ` transform="rotate(-90 ${f2(cx)} ${f2(ty)})"` : '';
    const showDims = !small && !['stair', 'passage', 'proof'].includes(r.t) && mn >= 5;
    let s = `<g pointer-events="none"${tr}><text x="${f2(cx)}" y="${f2(showDims ? ty - 0.15 : ty + fs * 0.35)}" class="t-room" style="font-size:${f2(fs)}px" text-anchor="middle">${esc(name)}</text>`;
    if (showDims) s += `<text x="${f2(cx)}" y="${f2(ty + fs * 0.95)}" class="t-dim" style="font-size:${f2(Math.max(0.62, fs * 0.72))}px" text-anchor="middle">${esc(dimText(r))}</text>`;
    return s + '</g>';
  }

  function dims(plan) {
    const plot = plan.plot, E = plan.E, D = plan.D, R = plan.rules; const s = [];
    s.push(dimH(0, plot.d + 3.2, plot.w, P.fmt(plot.w) + ' plot'));
    s.push(dimH(E.x0, plot.d + 6.2, E.x0 + E.W, P.fmt(E.W) + ' built'));
    s.push(dimV(-3.2, 0, plot.d, P.fmt(plot.d)));
    const porch = plan.floors[0].rooms.find(r => r.t === 'porch');
    const fx = porch ? (porch.x > plot.w / 2 ? porch.x / 2 : (porch.x + porch.w + plot.w) / 2) : plot.w / 2;
    if (E.y0 >= 3) s.push(`<text x="${f2(fx)}" y="${f2(E.y0 / 2 + 0.4)}" class="t-open" text-anchor="middle">FRONT ${P.fmt(E.y0)}</text>`);
    const rear = plot.d - (E.y0 + D);
    if (rear >= 3) s.push(`<text x="${plot.w / 2}" y="${f2(E.y0 + D + rear / 2 + 0.4)}" class="t-open" text-anchor="middle">REAR OPEN ${P.fmt(rear)} (MIN ${R.rear}')</text>`);
    if (E.x0 >= 3) s.push(`<text x="${f2(E.x0 / 2)}" y="${f2(E.y0 + D / 2)}" class="t-open" text-anchor="middle" transform="rotate(-90 ${f2(E.x0 / 2)} ${f2(E.y0 + D / 2)})">SIDE ${P.fmt(E.x0)}</text>`);
    const sr = plot.w - E.x0 - E.W;
    if (sr >= 3) s.push(`<text x="${f2(plot.w - sr / 2)}" y="${f2(E.y0 + D / 2)}" class="t-open" text-anchor="middle" transform="rotate(-90 ${f2(plot.w - sr / 2)} ${f2(E.y0 + D / 2)})">SIDE ${P.fmt(sr)}</text>`);
    return s.join('');
  }
  function dimH(xa, y, xb, label) {
    return `<g><line x1="${xa}" y1="${y}" x2="${xb}" y2="${y}" stroke="var(--dimc)" stroke-width="0.1"/><line x1="${xa}" y1="${y - 0.7}" x2="${xa}" y2="${y + 0.7}" stroke="var(--dimc)" stroke-width="0.1"/><line x1="${xb}" y1="${y - 0.7}" x2="${xb}" y2="${y + 0.7}" stroke="var(--dimc)" stroke-width="0.1"/><line x1="${xa - 0.4}" y1="${y + 0.4}" x2="${xa + 0.4}" y2="${y - 0.4}" stroke="var(--dimc)" stroke-width="0.16"/><line x1="${xb - 0.4}" y1="${y + 0.4}" x2="${xb + 0.4}" y2="${y - 0.4}" stroke="var(--dimc)" stroke-width="0.16"/><text x="${(xa + xb) / 2}" y="${y - 0.45}" class="t-dimline" text-anchor="middle">${label}</text></g>`;
  }
  function dimV(x, ya, yb, label) {
    const cy = (ya + yb) / 2;
    return `<g><line x1="${x}" y1="${ya}" x2="${x}" y2="${yb}" stroke="var(--dimc)" stroke-width="0.1"/><line x1="${x - 0.7}" y1="${ya}" x2="${x + 0.7}" y2="${ya}" stroke="var(--dimc)" stroke-width="0.1"/><line x1="${x - 0.7}" y1="${yb}" x2="${x + 0.7}" y2="${yb}" stroke="var(--dimc)" stroke-width="0.1"/><text x="${x - 0.5}" y="${cy}" class="t-dimline" text-anchor="middle" transform="rotate(-90 ${x - 0.5} ${cy})">${label}</text></g>`;
  }

  // roof plan: FF footprint, mumty over the stair, parapet
  function renderRoof(plan, o) {
    o = o || {}; const plot = plan.plot, E = plan.E; const u = 'r' + (o.uid || '');
    const m = 7, top = 15; const s = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-top} ${plot.w + 2 * m} ${plot.d + top + 9}" class="plan-svg" role="img" aria-label="Roof plan">`, defs(u)];
    site(plan, s, o, u, false, m, top);
    const ff = plan.floors[1] || plan.floors[0];
    ff.rooms.forEach(r => { if (!P.RT[r.t].open) s.push(`<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" fill="url(#roofh${u})"/>`); else s.push(`<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" fill="var(--f-open)"/>`); });
    s.push(`<rect x="${E.x0 + 0.4}" y="${E.y0 + 0.4}" width="${E.W - 0.8}" height="${plan.D - 0.8}" fill="none" stroke="var(--wall)" stroke-width="0.5"/>`);
    const st = plan.floors[0].rooms.find(r => r.t === 'stair');
    if (st) {
      s.push(`<rect x="${f2(st.x)}" y="${f2(st.y)}" width="${f2(st.w)}" height="${f2(st.h)}" fill="var(--f-circ)" stroke="var(--wall)" stroke-width="0.6"/>`);
      const tk = Math.min(4, st.w - 2); s.push(`<rect x="${f2(st.x + st.w / 2 - tk / 2)}" y="${f2(st.y + 1)}" width="${f2(tk)}" height="${f2(tk)}" fill="none" stroke="var(--glass)" stroke-width="0.18"/><text x="${f2(st.x + st.w / 2)}" y="${f2(st.y + 1 + tk / 2 + 0.3)}" class="t-tiny" text-anchor="middle">TANK</text>`);
      s.push(`<text x="${f2(st.x + st.w / 2)}" y="${f2(st.y + st.h / 2 + 1)}" class="t-room" style="font-size:1.05px" text-anchor="middle">MUMTY</text><text x="${f2(st.x + st.w / 2)}" y="${f2(st.y + st.h / 2 + 2.2)}" class="t-dim" style="font-size:.8px" text-anchor="middle">${Math.round(st.w * st.h)} ft²</text>`);
    }
    s.push(`<text x="${E.x0 + E.W / 2}" y="${E.y0 + plan.D - 1.2}" class="t-open" text-anchor="middle">3'-0" PARAPET ALL ROUND</text>`);
    s.push(`<rect x="0" y="0" width="${plot.w}" height="${plot.d}" fill="none" stroke="var(--boundary)" stroke-width="0.35"/>`);
    s.push(dims(plan)); s.push('</svg>');
    return s.join('');
  }

  // ---------- Bubble diagram (editable) ----------
  // lanes: GF rows; FF rows with the stair row split into left/right segments
  function lanes(plan, fi) {
    const E = plan.E, out = []; const S = plan.scheme;
    plan.rows.forEach(rr => {
      const id = S.gf.bands[rr.i].id;
      if (fi === 1 && S.ff && rr.i === S.ff.stairBand) {
        const st = plan.floors[1].rooms.find(r => r.t === 'stair');
        if (st.x - E.x0 > 0.5) out.push({ key: 's0', x: E.x0, y: rr.y, w: st.x - E.x0, h: rr.h, name: 'Beside stair' });
        out.push({ key: 'stair', x: st.x, y: rr.y, w: st.w, h: rr.h, name: 'Stair', fixed: true });
        const rx = st.x + st.w; if (E.x0 + E.W - rx > 0.5) out.push({ key: 's1', x: rx, y: rr.y, w: E.x0 + E.W - rx, h: rr.h, name: 'Beside stair' });
      } else out.push({ key: rr.i, x: E.x0, y: rr.y, w: E.W, h: rr.h, name: { F: 'Front row', M: 'Middle row', Q: 'Rear row 1', R: 'Rear row', C: 'Corridor' }[id], fixed: id === 'C' });
    });
    return out;
  }

  function bubbles(plan, fi) {
    // one bubble per scheme item (main room); satellites for owned rooms
    const fl = plan.floors[fi]; if (!fl) return { nodes: [], sats: [], edges: [] };
    const nodes = [], sats = [], byRoom = {};
    const locked = r => r.src === 'auto' || (fi === 1 && r.t === 'stair') || r.auto || r.t === 'passage';
    fl.rooms.forEach(r => {
      if (r.t === 'shaft') return;
      const isMain = r.main || r.src === 'auto' || r.auto || (fi === 1 && (r.t === 'stair'));
      if (isMain && !(r.t === 'foyer' && fl.rooms.some(o => o.t === 'porch' && o.src === r.src))) {
        const n = { id: r.src, room: r, x: r.x + r.w / 2, y: r.y + r.h / 2, rad: Math.max(1.4, Math.min(3.4, Math.sqrt(r.w * r.h) * 0.17)), t: r.t, name: r.name, locked: locked(r) };
        if (r.t === 'porch' && r.y < plan.E.y0) n.y = Math.max(plan.E.y0 + n.rad, r.y + r.h / 2);
        nodes.push(n); byRoom[r.id] = n;
      }
    });
    fl.rooms.forEach(r => { if (!byRoom[r.id] && r.t !== 'shaft') { const host = nodes.find(n => n.id === r.src && r.src !== 'auto'); const sat = { room: r, x: r.x + r.w / 2, y: r.y + r.h / 2, t: r.t, host }; sats.push(sat); byRoom[r.id] = host || sat; } });
    const seen = new Set(); const edges = [];
    fl.links.forEach(l => { const a = byRoom[l.a], b = byRoom[l.b]; if (!a || !b || a === b) return; const k = [a.x, a.y, b.x, b.y].join(); if (seen.has(k)) return; seen.add(k); edges.push({ a, b, kind: l.kind }); });
    return { nodes, sats, edges };
  }

  function renderBubbles(plan, fi, sel) {
    const E = plan.E, D = plan.D, pad = 2.5;
    const L = lanes(plan, fi); const B = bubbles(plan, fi);
    const s = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${E.x0 - pad} ${E.y0 - pad - 2} ${E.W + 2 * pad} ${D + 2 * pad + 2}" class="bubble-svg" data-floor="${fi}">`];
    s.push(`<text x="${E.x0 + E.W / 2}" y="${E.y0 - pad + 0.2}" class="t-lane" text-anchor="middle">ROAD SIDE ▲</text>`);
    L.forEach((ln, i) => {
      s.push(`<rect class="lane${ln.fixed ? ' fixed' : ''}" data-lane="${ln.key}" x="${f2(ln.x)}" y="${f2(ln.y)}" width="${f2(ln.w)}" height="${f2(ln.h)}"/>`);
      if (ln.w > 8) s.push(`<text x="${f2(ln.x + 0.6)}" y="${f2(ln.y + 1.3)}" class="t-lane">${esc(ln.name.toUpperCase())}</text>`);
    });
    B.edges.forEach(e => s.push(`<line x1="${f2(e.a.x)}" y1="${f2(e.a.y)}" x2="${f2(e.b.x)}" y2="${f2(e.b.y)}" class="edge ${e.kind}"/>`));
    B.sats.forEach(t => { if (t.host) s.push(`<line x1="${f2(t.host.x)}" y1="${f2(t.host.y)}" x2="${f2(t.x)}" y2="${f2(t.y)}" class="edge sat"/>`); s.push(`<circle cx="${f2(t.x)}" cy="${f2(t.y)}" r="0.8" fill="var(--n-${CAT[t.t]})" opacity="${t.host ? 0.9 : 0.5}"/>`); });
    B.nodes.forEach(n => {
      s.push(`<g class="bub${n.locked ? ' locked' : ''}${sel && n.id === sel ? ' sel' : ''}" data-id="${esc(n.id)}" data-t="${n.t}" transform="translate(${f2(n.x)} ${f2(n.y)})" tabindex="${n.locked ? -1 : 0}" role="button" aria-label="${esc(n.name || n.t)}">
        <circle r="${f2(n.rad)}" fill="var(--n-${CAT[n.t]})" ${CAT[n.t] === 'open' ? 'fill-opacity=".55"' : ''}/>
        <text y="${f2(Math.min(0.42, n.rad * 0.25))}" class="t-node" text-anchor="middle" style="font-size:${f2(Math.max(0.9, n.rad * 0.55))}px">${ABBR[n.t]}</text></g>`);
    });
    s.push('</svg>');
    return s.join('');
  }

  root.BuildMeRender = { renderFloor, renderRoof, renderBubbles, lanes, bubbles, CAT, ABBR, dimText };
})(this);
