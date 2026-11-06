/* BuildMe interiors — construction-level room detail: dimensioned furniture plan, four wall elevations,
   reflected ceiling plan with lights, electrical layout, flooring layout, specifications and bill of quantities.
   Pure logic + SVG strings (no DOM). Needs BuildMeInterior. Exposes window.BuildMeDetail / module.exports. */
(function (root) {
  'use strict';
  const I = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./interior.js') : root.BuildMeInterior;
  const { F, ft, f2, esc, CEIL } = I;
  const INK = '#1F2D3D', MUTE = '#6A7F96', DIM = '#C27C1E', ACC = '#1E6FD9', WALLC = '#18293B';
  const T_ = (x, y, s, size, o) => `<text x="${f2(x)}" y="${f2(y)}" font-family="Arial,Helvetica,sans-serif" font-size="${size || 0.6}" fill="${(o && o.fill) || INK}"${o && o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o && o.weight ? ` font-weight="${o.weight}"` : ''}${o && o.rot ? ` transform="rotate(${o.rot} ${f2(x)} ${f2(y)})"` : ''}>${esc(s)}</text>`;
  const svgOpen = (vb, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f2).join(' ')}" role="img" aria-label="${esc(label)}">`;

  // ---------- room services: false ceiling, lights, electrical points ----------
  const MAIN = new Set(['bed', 'lounge', 'flounge', 'drawing', 'dining', 'study']);
  function ceiling(g, items) {
    const W = g.W, H = g.H; const lights = []; let fc = null; const wet = I.WET.has(g.t) || g.t === 'kitchen';
    if (g.open) { lights.push({ type: 'wall', x: W * 0.25, y: 0.1 }, { type: 'wall', x: W * 0.75, y: 0.1 }); return { fc: null, lights, note: 'Open to sky — wall lights on the building face.' }; }
    if (MAIN.has(g.t) && g.area >= 80) {
      const b = g.area > 250 ? 2 : 1.5; fc = { kind: 'peripheral', band: b, low: 9, high: CEIL, cove: true };
      // downlights at ~4' centres in the bulkhead band
      const per = (len, fixed, horiz) => { const n = Math.max(1, Math.round((len - 2) / 4.2)); for (let i = 0; i < n; i++) { const t = (len / n) * (i + 0.5); lights.push(horiz ? { type: 'down', x: t, y: fixed } : { type: 'down', x: fixed, y: t }); } };
      per(W, b / 2, true); per(W, H - b / 2, true); per(H - 2 * b, b / 2, false); per(H - 2 * b, W - b / 2, false);
      lights.forEach(l => { if (!l.horiz && l.y !== b / 2 && l.y !== H - b / 2) l.y += 0; });
      lights.filter(l => l.type === 'down' && (l.x === b / 2 || l.x === W - b / 2)).forEach(l => { l.y += b; });
      const table = items.find(i => /^dining|^round4/.test(i.k));
      if (g.t === 'dining' && table) lights.push({ type: 'pendant', x: table.cx, y: table.cy });
      else if (g.t === 'drawing') lights.push({ type: 'chandelier', x: W / 2, y: H / 2 });
      else lights.push({ type: 'fan', x: W / 2, y: H / 2 });
      if (g.t === 'lounge') { const t2 = items.find(i => /^dining|^round4/.test(i.k)); if (t2) lights.push({ type: 'pendant', x: t2.cx, y: t2.cy }); }
      lights.push({ type: 'cove', x: b, y: b, w: W - 2 * b, h: H - 2 * b });
    } else if (wet || g.t === 'laundry') {
      fc = { kind: 'flat', low: g.t === 'kitchen' ? 9 : 8.5, high: CEIL, mr: true };
      const n = Math.max(2, Math.round(g.area / 22)); const cols = Math.max(1, Math.round(Math.sqrt(n * W / H))), rows = Math.max(1, Math.ceil(n / cols));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) lights.push({ type: 'down', x: W * (i + 0.5) / cols, y: H * (j + 0.5) / rows });
      if (g.t !== 'kitchen') lights.push({ type: 'exhaust', x: W * 0.8, y: H * 0.2 });
      else { const hob = items.find(i => i.hob); if (hob) lights.push({ type: 'hood', x: hob.cx, y: hob.cy }); }
    } else {
      fc = null; const n = Math.max(1, Math.round(g.area / 35));
      for (let i = 0; i < n; i++) lights.push({ type: g.t === 'store' ? 'batten' : 'down', x: W * (i + 0.5) / n, y: H / 2 });
      if (g.t === 'servant') lights.push({ type: 'fan', x: W / 2, y: H / 2 + 1 });
    }
    return { fc, lights, note: fc ? (fc.kind === 'peripheral' ? `Gypsum-board bulkhead ${ft(fc.band)} wide at ${ft(fc.low)}, centre at slab ${ft(fc.high)} with concealed LED cove` : `Flat moisture-resistant gypsum ceiling at ${ft(fc.low)}`) : 'Plastered and painted slab soffit at ' + ft(CEIL) };
  }
  // electrical points on walls: { type, side, t (along the wall, viewer's left→right not applied), h, label }
  function electrical(g, items) {
    const P = []; const add = (type, side, t, h, label) => { const len = side === 'N' || side === 'S' ? g.W : g.H; P.push({ type, side, t: Math.max(0.4, Math.min(len - 0.4, t)), h, label }); };
    const along = it => (it.wall === 'N' || it.wall === 'S' ? it.cx : it.cy);
    const doors = g.ops.filter(o => o.kind !== 'window'); const main = doors.find(o => o.kind === 'door') || doors[0];
    if (!g.open && main) {
      const len = main.side === 'N' || main.side === 'S' ? g.W : g.H; const latchB = main.hingeA !== false; let t = latchB ? main.b + 0.45 : main.a - 0.45; if (t > len - 0.3 || t < 0.3) t = latchB ? main.a - 0.45 : main.b + 0.45;
      add('switch', main.side, t, 4, 'SB1 main switchboard');
      doors.filter(o => o !== main && o.kind === 'door').forEach((o, i) => add('switch', o.side, o.b + 0.45, 4, `SB${i + 2} two-way`));
    }
    items.forEach(it => {
      const s = F[it.k]; if (!s || !it.wall) return; const t = along(it);
      if (/^bed_/.test(it.k) && !/bunk/.test(it.k)) { [-1, 1].forEach(sg => { add('socket', it.wall, t + sg * (it.w / 2 + 0.9), 1.75, 'Bedside socket + USB'); if (it.w > 4) add('switch', it.wall, t + sg * (it.w / 2 + 0.9), 2.6, 'Bedside 2-way switch'); }); }
      if (/^tv/.test(it.k)) { add('socket', it.wall, t - 0.8, it.k === 'tvwall' ? 4.2 : 1.5, 'TV power ×2'); add('tv', it.wall, t + 0.3, it.k === 'tvwall' ? 4.2 : 1.5, 'TV / HDMI'); add('data', it.wall, t + 1, it.k === 'tvwall' ? 4.2 : 1.5, 'Data (LAN)'); }
      if (/desk/.test(it.k)) { add('socket', it.wall, t - 0.8, 3.3, 'Desk socket ×2 + USB'); add('data', it.wall, t + 0.6, 3.3, 'Data (LAN)'); }
      if (/^dresser/.test(it.k)) add('socket', it.wall, t + it.w / 2 - 0.3, 4, 'Dressing socket');
      if (it.k === 'ac') { add('ac', it.wall, t + it.w / 2 + 0.6, 7.6, '20 A AC point + isolator'); }
      if (it.k === 'counter') { const n = Math.max(1, Math.floor(it.w / 4)); for (let i = 0; i < n; i++) add('socket20', it.wall, t - it.w / 2 + (i + 0.5) * it.w / n, 3.6, 'Counter socket 15 A'); if (it.hob) add('hood', it.wall, t + it.w / 2 - 1.4, 7, 'Hood point'); if (it.sink) add('socket', it.wall, t - it.w / 2 + 1.3, 1.2, 'Water-filter / under-sink socket'); }
      if (/^fridge/.test(it.k)) add('socket20', it.wall, t + it.w / 2 - 0.4, 1, 'Fridge socket 15 A');
      if (it.k === 'ovencol') { add('socket20', it.wall, t, 2.5, 'Oven 20 A'); add('socket20', it.wall, t, 5.2, 'Microwave 15 A'); }
      if (it.k === 'dispenser') add('socket', it.wall, t, 1, 'Dispenser socket');
      if (/washer|dryer/.test(it.k)) add('socket20', it.wall, t, 3.5, 'Washing-machine 15 A');
      if (it.k === 'geyser') add('geyser', it.wall, t + 0.9, 6.6, 'Geyser 20 A point');
      if (/^basin/.test(it.k)) add('socket', it.wall, t + it.w / 2 + 0.3, 4.5, 'Shaver / mirror-light socket');
      if (/^sofa|floorseat/.test(it.k)) add('socket', it.wall, t + it.w / 2 + 0.4, 1, 'Sofa-side socket');
      if (it.k === 'floorlamp') add('socket', it.wall || 'N', t, 1, 'Lamp socket');
    });
    // exhaust fan point in wet rooms; a convenience socket on long empty walls
    if (I.WET.has(g.t)) add('exhaust', 'N', g.W * 0.8, 8, 'Exhaust-fan point');
    if (!g.open && !I.WET.has(g.t) && g.t !== 'store') ['N', 'E', 'S', 'W'].forEach(side => { const len = side === 'N' || side === 'S' ? g.W : g.H; if (len < 8 || P.some(p => p.side === side && p.type !== 'switch')) return; if (g.ops.some(o => o.side === side && o.kind !== 'window' && o.a < len / 2 + 1 && o.b > len / 2 - 1)) return; add('socket', side, len / 2, 1, 'Convenience socket'); });
    return P;
  }

  // ---------- drawings ----------
  // room outline with walls, openings and door swings, in room-local feet
  function shell(g, s, opts) {
    opts = opts || {}; const W = g.W, H = g.H, t = 0.5;
    if (g.open) { s.push(`<rect x="0" y="0" width="${f2(W)}" height="${f2(H)}" fill="none" stroke="${MUTE}" stroke-width="0.1" stroke-dasharray="0.5 0.3"/>`); return; }
    const segs = { N: [], S: [], E: [], W: [] }; g.ops.forEach(o => segs[o.side].push(o));
    ['N', 'S', 'W', 'E'].forEach(side => {
      const len = side === 'N' || side === 'S' ? W : H; const list = segs[side].slice().sort((a, b) => a.a - b.a); let p = -t;
      const draw = (a, b) => { if (b - a < 0.01) return; if (side === 'N') s.push(`<rect x="${f2(a)}" y="${-t}" width="${f2(b - a)}" height="${t}" fill="${WALLC}"/>`); else if (side === 'S') s.push(`<rect x="${f2(a)}" y="${f2(H)}" width="${f2(b - a)}" height="${t}" fill="${WALLC}"/>`); else if (side === 'W') s.push(`<rect x="${-t}" y="${f2(a)}" width="${t}" height="${f2(b - a)}" fill="${WALLC}"/>`); else s.push(`<rect x="${f2(W)}" y="${f2(a)}" width="${t}" height="${f2(b - a)}" fill="${WALLC}"/>`); };
      list.forEach(o => {
        draw(p, o.a); p = o.b; const win = o.kind === 'window'; const col = win ? '#2C86D1' : '#FFFFFF';
        if (side === 'N' || side === 'S') { const y = side === 'N' ? -t / 2 : H + t / 2; s.push(`<line x1="${f2(o.a)}" y1="${f2(y)}" x2="${f2(o.b)}" y2="${f2(y)}" stroke="${col}" stroke-width="${win ? 0.16 : 0.5}"/>`); if (win) s.push(`<line x1="${f2(o.a)}" y1="${f2(y - 0.12)}" x2="${f2(o.b)}" y2="${f2(y - 0.12)}" stroke="#2C86D1" stroke-width="0.05"/><line x1="${f2(o.a)}" y1="${f2(y + 0.12)}" x2="${f2(o.b)}" y2="${f2(y + 0.12)}" stroke="#2C86D1" stroke-width="0.05"/>`);
          if (o.kind === 'door' && opts.swing !== false) { const r = o.b - o.a; const yy = side === 'N' ? 0 : H; const sg = side === 'N' ? 1 : -1; const hx = o.hingeA !== false ? o.a : o.b, fx = o.hingeA !== false ? o.b : o.a; s.push(`<path d="M${f2(hx)} ${f2(yy)} L${f2(hx)} ${f2(yy + sg * r)} A${f2(r)} ${f2(r)} 0 0 ${(side === 'N') === (hx === o.a) ? 0 : 1} ${f2(fx)} ${f2(yy)}" fill="none" stroke="#7D8FA3" stroke-width="0.06"/><line x1="${f2(hx)}" y1="${f2(yy)}" x2="${f2(hx)}" y2="${f2(yy + sg * r)}" stroke="${INK}" stroke-width="0.09"/>`); } }
        else { const x = side === 'W' ? -t / 2 : W + t / 2; s.push(`<line x1="${f2(x)}" y1="${f2(o.a)}" x2="${f2(x)}" y2="${f2(o.b)}" stroke="${col}" stroke-width="${win ? 0.16 : 0.5}"/>`); if (win) s.push(`<line x1="${f2(x - 0.12)}" y1="${f2(o.a)}" x2="${f2(x - 0.12)}" y2="${f2(o.b)}" stroke="#2C86D1" stroke-width="0.05"/><line x1="${f2(x + 0.12)}" y1="${f2(o.a)}" x2="${f2(x + 0.12)}" y2="${f2(o.b)}" stroke="#2C86D1" stroke-width="0.05"/>`);
          if (o.kind === 'door' && opts.swing !== false) { const r = o.b - o.a; const xx = side === 'W' ? 0 : W; const sg = side === 'W' ? 1 : -1; const hy = o.hingeA !== false ? o.a : o.b, fy = o.hingeA !== false ? o.b : o.a; s.push(`<path d="M${f2(xx)} ${f2(hy)} L${f2(xx + sg * r)} ${f2(hy)} A${f2(r)} ${f2(r)} 0 0 ${(side === 'W') === (hy === o.a) ? 1 : 0} ${f2(xx)} ${f2(fy)}" fill="none" stroke="#7D8FA3" stroke-width="0.06"/><line x1="${f2(xx)}" y1="${f2(hy)}" x2="${f2(xx + sg * r)}" y2="${f2(hy)}" stroke="${INK}" stroke-width="0.09"/>`); } }
      });
      draw(p, len + t);
    });
  }
  const dimH = (x1, x2, y, label, up) => `<g stroke="${DIM}" stroke-width="0.045"><line x1="${f2(x1)}" y1="${f2(y)}" x2="${f2(x2)}" y2="${f2(y)}"/><line x1="${f2(x1)}" y1="${f2(y - 0.25)}" x2="${f2(x1)}" y2="${f2(y + 0.25)}"/><line x1="${f2(x2)}" y1="${f2(y - 0.25)}" x2="${f2(x2)}" y2="${f2(y + 0.25)}"/></g>` + T_((x1 + x2) / 2, y + (up ? -0.18 : 0.62), label, 0.5, { anchor: 'middle', fill: DIM });
  const dimV = (y1, y2, x, label, left) => `<g stroke="${DIM}" stroke-width="0.045"><line x1="${f2(x)}" y1="${f2(y1)}" x2="${f2(x)}" y2="${f2(y2)}"/><line x1="${f2(x - 0.25)}" y1="${f2(y1)}" x2="${f2(x + 0.25)}" y2="${f2(y1)}"/><line x1="${f2(x - 0.25)}" y1="${f2(y2)}" x2="${f2(x + 0.25)}" y2="${f2(y2)}"/></g>` + T_(x + (left ? -0.18 : 0.5), (y1 + y2) / 2, label, 0.5, { anchor: 'middle', fill: DIM, rot: -90 });
  // numbered tags shared by plan, elevations and schedules
  function tags(items) { const map = new Map(); let n = 0; const keyOf = it => it.k + (F[it.k] && F[it.k].var ? ':' + it.w : '') + (it.sink ? 's' : '') + (it.hob ? 'h' : ''); items.forEach(it => { const k = keyOf(it); if (!map.has(k)) map.set(k, ++n); }); return it => map.get(keyOf(it)); }
  const tagSym = (x, y, n) => `<g><circle cx="${f2(x)}" cy="${f2(y)}" r="0.36" fill="#fff" stroke="${ACC}" stroke-width="0.06"/>${T_(x, y + 0.17, String(n), 0.42, { anchor: 'middle', fill: ACC, weight: 'bold' })}</g>`;

  function planSVG(g, items, theme, fin) {
    const W = g.W, H = g.H, m = 3.2; const tag = tags(items); const s = [svgOpen([-m, -m, W + 2 * m, H + 2 * m], `${g.name} furniture plan`)];
    const fl = I.FLOORS[(fin || {}).floor] || I.FLOORS.porcelain;
    s.push(`<rect x="0" y="0" width="${f2(W)}" height="${f2(H)}" fill="${fl.color}" opacity="0.32"/>`);
    // clear zones (faint) so the space planning is visible
    items.filter(it => !/rug|prayer/.test(it.k) && F[it.k] && F[it.k].mount !== 'wall').forEach(it => I.clearZones(it).forEach(z => { if (z.ring) return; s.push(`<rect x="${f2(Math.max(0, z.x))}" y="${f2(Math.max(0, z.y))}" width="${f2(Math.min(W, z.x + z.w) - Math.max(0, z.x))}" height="${f2(Math.min(H, z.y + z.h) - Math.max(0, z.y))}" fill="#8CC2FF" opacity="0.12"/>`); }));
    shell(g, s);
    s.push(I.symbols(items, theme));
    items.forEach(it => { if (it.k === 'rug') return; s.push(tagSym(it.cx, it.cy, tag(it))); });
    // overall + opening dimensions
    s.push(dimH(0, W, -1.6, ft(W), true), dimV(0, H, -1.6, ft(H), true));
    g.ops.filter(o => o.side === 'S' || o.side === 'E').forEach(o => { if (o.side === 'S') s.push(dimH(o.a, o.b, H + 1.4, `${o.kind === 'window' ? 'W' : 'D'} ${ft(o.b - o.a)}`)); else s.push(dimV(o.a, o.b, W + 1.4, `${o.kind === 'window' ? 'W' : 'D'} ${ft(o.b - o.a)}`)); });
    g.ops.filter(o => o.side === 'N' || o.side === 'W').forEach(o => { if (o.side === 'N') s.push(T_((o.a + o.b) / 2, -0.75, `${o.kind === 'window' ? 'W' : o.kind === 'door' ? 'D' : 'OP'} ${ft(o.b - o.a)}`, 0.42, { anchor: 'middle', fill: MUTE })); else s.push(T_(-0.75, (o.a + o.b) / 2, `${o.kind === 'window' ? 'W' : o.kind === 'door' ? 'D' : 'OP'} ${ft(o.b - o.a)}`, 0.42, { anchor: 'middle', fill: MUTE, rot: -90 })); });
    // walkway dimensions in front of the main pieces
    items.filter(it => /^bed_|^sofa|counter|wardrobe|^dining/.test(it.k)).slice(0, 4).forEach(it => {
      const r = I.rectOf(it), fv = I.front(it); const ahead = (() => { let best = fv[1] > 0 ? H - (r.y + r.h) : fv[1] < 0 ? r.y : fv[0] > 0 ? W - (r.x + r.w) : r.x;
        items.forEach(p => { if (p === it || !F[p.k] || /rug|prayer/.test(p.k) || F[p.k].mount === 'wall' || F[it.k].ok.includes(p.k)) return; const q = I.rectOf(p);
          if (fv[1]) { if (q.x + q.w <= r.x || q.x >= r.x + r.w) return; const d = fv[1] > 0 ? q.y - (r.y + r.h) : r.y - (q.y + q.h); if (d >= 0) best = Math.min(best, d); } else { if (q.y + q.h <= r.y || q.y >= r.y + r.h) return; const d = fv[0] > 0 ? q.x - (r.x + r.w) : r.x - (q.x + q.w); if (d >= 0) best = Math.min(best, d); } }); return best; })();
      if (ahead < 0.6) return;
      if (fv[1]) { const x = r.x + r.w * 0.8, y0 = fv[1] > 0 ? r.y + r.h : r.y - ahead; s.push(`<g stroke="${ACC}" stroke-width="0.04" stroke-dasharray="0.15 0.1"><line x1="${f2(x)}" y1="${f2(y0)}" x2="${f2(x)}" y2="${f2(y0 + ahead)}"/></g>` + T_(x + 0.25, y0 + ahead / 2 + 0.15, ft(ahead), 0.42, { fill: ACC })); }
      else { const y = r.y + r.h * 0.8, x0 = fv[0] > 0 ? r.x + r.w : r.x - ahead; s.push(`<g stroke="${ACC}" stroke-width="0.04" stroke-dasharray="0.15 0.1"><line x1="${f2(x0)}" y1="${f2(y)}" x2="${f2(x0 + ahead)}" y2="${f2(y)}"/></g>` + T_(x0 + ahead / 2, y - 0.2, ft(ahead), 0.42, { anchor: 'middle', fill: ACC })); }
    });
    s.push('</svg>'); return s.join('');
  }

  // ---------- elevations ----------
  const VIEW = { N: 'A', E: 'B', S: 'C', W: 'D' };
  // horizontal position as seen from inside the room, looking at the wall
  function viewT(g, side, t) { return side === 'N' ? t : side === 'S' ? g.W - t : side === 'W' ? g.H - t : t; }
  function onWall(g, it, side) {
    const r = I.rectOf(it); const tol = 0.65;
    if (side === 'N') return r.y <= tol ? [r.x, r.x + r.w, r.y] : null; if (side === 'S') return r.y + r.h >= g.H - tol ? [r.x, r.x + r.w, g.H - (r.y + r.h)] : null;
    if (side === 'W') return r.x <= tol ? [r.y, r.y + r.h, r.x] : null; return r.x + r.w >= g.W - tol ? [r.y, r.y + r.h, g.W - (r.x + r.w)] : null;
  }
  function elevItem(it, x0, x1, T) {
    const s = F[it.k]; const w = x1 - x0; const y0 = (it.y0 != null ? it.y0 : s.y0); const h = s.h; const Y = v => CEIL - v; const out = [];
    const R = (x, y, ww, hh, fill, extra) => out.push(`<rect x="${f2(x)}" y="${f2(Y(y + hh))}" width="${f2(ww)}" height="${f2(hh)}" fill="${fill}" stroke="${INK}" stroke-width="0.05"${extra || ''}/>`);
    const L = (xa, ya, xb, yb, c) => out.push(`<line x1="${f2(xa)}" y1="${f2(Y(ya))}" x2="${f2(xb)}" y2="${f2(Y(yb))}" stroke="${c || INK}" stroke-width="0.04"/>`);
    const k = it.k; const sideOn = (it.rot % 180 === 0) !== (it._side === 'N' || it._side === 'S');
    if (/^bed_/.test(k) && k !== 'bed_bunk') { if (!sideOn) { R(x0, 0, w, s.hb || 3.5, T.wood); R(x0 + 0.15, 1.1, w - 0.3, 0.75, '#FFFFFF'); R(x0 + 0.4, 1.85, (w - 1) / 2, 0.5, T.light, ' rx="0.15"'); R(x0 + w / 2 + 0.1, 1.85, (w - 1) / 2, 0.5, T.light, ' rx="0.15"'); } else { R(x0, 0, w, 1.1, T.wood); R(x0, 1.1, w, 0.75, '#FFFFFF'); R(x0, 0, 0.3, s.hb || 3.5, T.wood); } }
    else if (k === 'bed_bunk') { R(x0, 0, w, 5.6, 'none'); R(x0, 1, w, 0.6, '#fff'); R(x0, 4, w, 0.6, '#fff'); }
    else if (/wardrobe|crockery|bookshelf|shelf|shoe/.test(k)) { R(x0, 0, w, h, k === 'shelf' ? '#E3E6EA' : T.wood); const n = Math.max(1, Math.round(w / (k === 'wardrobe_slide' ? 3 : 1.6))); for (let i = 1; i < n; i++) L(x0 + i * w / n, 0.2, x0 + i * w / n, h - 0.2); if (/bookshelf|shelf|crockery/.test(k)) for (let y = 1.4; y < h - 0.3; y += 1.3) L(x0 + 0.1, y, x1 - 0.1, y); else for (let i = 0; i < n; i++) L(x0 + (i + 0.5) * w / n + (i % 2 ? -0.3 : 0.3), 3.2, x0 + (i + 0.5) * w / n + (i % 2 ? -0.3 : 0.3), 4.2, '#555'); L(x0, 0.35, x1, 0.35); }
    else if (/^dresser$|chest|sideboard|console|nightstand$|tvunit|toybox/.test(k)) { R(x0, 0.3, w, h - 0.3, T.wood); L(x0, 0.3, x1, 0.3); if (/chest|nightstand/.test(k)) for (let y = 0.9; y < h - 0.2; y += 0.7) L(x0 + 0.1, y, x1 - 0.1, y); if (k === 'dresser') R(x0 + w * 0.2, h + 0.2, w * 0.6, 3, '#DDE8EE'); if (k === 'tvunit') R(x0 + w / 2 - 2.4, h + 0.6, 4.8, 2.7, '#222'); if (k === 'nightstand') { L(x0 + w / 2, h, x0 + w / 2, h + 0.9); R(x0 + w / 2 - 0.5, h + 0.9, 1, 0.7, T.light); } }
    else if (k === 'tvwall') { R(x0, 0.8, w, 6.6, T.wood, ''); for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.35) L(x, 0.9, x, 7.3, 'rgba(0,0,0,.25)'); R(x0 + 0.5, 0.8, w - 1, 1.2, T.wood); R(x0 + w / 2 - 2.8, 3, 5.6, 3.2, '#1D1F22'); }
    else if (/^sofa|armchair|recliner|floorseat|bench|ottoman/.test(k)) { R(x0, 0.3, w, Math.min(h, 1.5) - 0.3, T.soft, ' rx="0.2"'); if (!/bench|ottoman|floorseat/.test(k)) { R(x0, 0.3, 0.55, 2.1, T.soft, ' rx="0.2"'); R(x1 - 0.55, 0.3, 0.55, 2.1, T.soft, ' rx="0.2"'); R(x0 + 0.5, 1.5, w - 1, 1.3, T.soft, ' rx="0.25"'); } }
    else if (/^dining|round4|desk|kidsdesk|otable|island|coffee/.test(k)) { R(x0, h - 0.15, w, 0.15, T.wood); if (k === 'island') R(x0 + 0.2, 0, w - 0.4, h - 0.15, T.light); else { L(x0 + 0.2, 0, x0 + 0.2, h - 0.15); L(x1 - 0.2, 0, x1 - 0.2, h - 0.15); } }
    else if (k === 'counter' || k === 'utsink' || k === 'bbq') { R(x0, 0.35, w, 2.4, T.light); R(x0, 2.75, w, 0.15, '#3B3F45'); L(x0, 0.35, x1, 0.35); const n = Math.max(1, Math.round(w / 1.6)); for (let i = 1; i < n; i++) L(x0 + i * w / n, 0.4, x0 + i * w / n, 2.7); if (k === 'counter') { if (sideOn) R(x0, 4.6, Math.min(w, 1.15), 2.3, T.wood); else { R(x0, 4.6, w, 2.3, T.wood); for (let i = 1; i < n; i++) L(x0 + i * w / n, 4.65, x0 + i * w / n, 6.85); R(x0, 2.9, w, 1.7, '#EFEAE2'); if (it.hob) R(x1 - 2.6, 5.4, 2.2, 1.4, '#9AA3AD'); } } }
    else if (/^fridge|ovencol|dispenser|washer|dryer/.test(k)) { R(x0, 0, w, h, '#E5E8EB'); if (/fridge/.test(k)) L(x0, 4, x1, 4); if (k === 'ovencol') { R(x0 + 0.2, 2.2, w - 0.4, 1.5, '#2A2D31'); R(x0 + 0.2, 4.1, w - 0.4, 1.1, '#2A2D31'); } }
    else if (/^wc/.test(k)) { if (sideOn) { R(x0, 0, w, 1.4, '#fff', ' rx="0.3"'); R(x0, 0, 0.5, 3, '#fff'); } else { R(x0 + 0.1, 0, w - 0.2, 1.4, '#fff', ' rx="0.3"'); R(x0, 2.6, w, 0.6, '#EEE'); } }
    else if (/^basin/.test(k)) { R(x0, 0.6, w, 2.2, T.wood); R(x0 - 0.05, 2.75, w + 0.1, 0.12, '#fff'); R(x0 + 0.1, 3.4, w - 0.2, 2.6, '#DDE8EE'); }
    else if (k === 'shower') { R(x0, 0, w, 0.25, '#fff'); out.push(`<rect x="${f2(x0)}" y="${f2(Y(7))}" width="${f2(w)}" height="${f2(6.75)}" fill="#BFE3F2" fill-opacity="0.35" stroke="${INK}" stroke-width="0.04"/>`); L(x0 + w / 2, 7, x0 + w / 2, 6.6); }
    else if (k === 'showerzone') { out.push(`<rect x="${f2(x0)}" y="${f2(Y(7))}" width="${f2(0.1)}" height="7" fill="#BFE3F2"/>`); L(x0 + w / 2, 7.2, x0 + w / 2, 6.7); out.push(`<ellipse cx="${f2(x0 + w / 2)}" cy="${f2(Y(6.65))}" rx="0.45" ry="0.08" fill="#9AA3AD"/>`); }
    else if (k === 'bathtub') { R(x0, 0, w, 1.9, '#fff', ' rx="0.2"'); }
    else if (k === 'ac') { R(x0, y0, w, h, '#F4F4F2', ' rx="0.12"'); L(x0 + 0.2, y0 + 0.2, x1 - 0.2, y0 + 0.2, '#888'); }
    else if (k === 'geyser') { R(x0, y0, w, h, '#F4F4F2', ' rx="0.15"'); }
    else if (k === 'art') { R(x0, y0, w, h, T.wood); R(x0 + 0.15, y0 + 0.15, w - 0.3, h - 0.3, T.accent); out.push(`<circle cx="${f2(x0 + w * 0.4)}" cy="${f2(Y(y0 + h * 0.55))}" r="${f2(h * 0.18)}" fill="${T.light}"/>`); }
    else if (/^mirror/.test(k)) { R(x0, y0, w, h, '#DDE8EE'); L(x0 + 0.3, y0 + h - 0.6, x0 + 0.9, y0 + h - 0.2, '#fff'); }
    else if (k === 'nightstand_float' || k === 'dresser_wall') { R(x0, y0, w, h, T.wood); if (k === 'dresser_wall') R(x0 + 0.2, y0 + h + 0.4, w - 0.4, 2.8, '#DDE8EE'); }
    else if (k === 'towel') { L(x0, y0, x1, y0, '#888'); }
    else if (/plant|planter/.test(k)) { R(x0 + w * 0.2, 0, w * 0.6, 1.4, '#B5835A'); out.push(`<ellipse cx="${f2(x0 + w / 2)}" cy="${f2(Y(1.4 + (h - 1.4) / 2))}" rx="${f2(w / 2)}" ry="${f2((h - 1.4) / 2)}" fill="#7FA86E"/>`); }
    else if (k === 'floorlamp') { L(x0 + w / 2, 0, x0 + w / 2, h - 0.8); R(x0 + w / 2 - 0.6, h - 0.9, 1.2, 0.9, T.light); }
    else if (k === 'swing') { L(x0, 0, x0, 6.5); L(x1, 0, x1, 6.5); L(x0, 6.5, x1, 6.5); R(x0 + 1, 1.3, w - 2, 1.2, T.soft); }
    else if (k !== 'rug' && k !== 'prayer' && k !== 'car') R(x0, y0, w, Math.max(0.1, h), '#EEE');
    return out.join('');
  }
  function elevations(g, items, theme, fin, elec) {
    const T = I.THEMES[theme] || I.THEMES.modern; const tag = tags(items); const cl = ceiling(g, items); const res = [];
    const wallCol = (I.WALLS[(fin || {}).wall] || I.WALLS.ivory).color; const fl = I.FLOORS[(fin || {}).floor] || I.FLOORS.porcelain;
    ['N', 'E', 'S', 'W'].forEach(side => {
      const L = side === 'N' || side === 'S' ? g.W : g.H; const m = 2.2; const Y = v => CEIL - v;
      const span = Math.max(g.W, g.H, 12); const s = [svgOpen([-m - (span - L) / 2, -1.6, span + 2 * m, CEIL + 3.6], `Elevation ${VIEW[side]}`)];
      s.push(`<rect x="0" y="0" width="${f2(L)}" height="${CEIL}" fill="${g.open ? '#F7FAFD' : wallCol}" stroke="${INK}" stroke-width="0.08"/>`);
      if (cl.fc && !g.open) { const low = cl.fc.low; s.push(`<rect x="0" y="0" width="${f2(L)}" height="${f2(CEIL - low)}" fill="#FFFFFF" stroke="${MUTE}" stroke-width="0.04" stroke-dasharray="0.25 0.15"/>`); if (cl.fc.kind === 'peripheral') s.push(`<line x1="${f2(cl.fc.band)}" y1="${f2(CEIL - low)}" x2="${f2(cl.fc.band)}" y2="0" stroke="${MUTE}" stroke-width="0.03"/><line x1="${f2(L - cl.fc.band)}" y1="${f2(CEIL - low)}" x2="${f2(L - cl.fc.band)}" y2="0" stroke="${MUTE}" stroke-width="0.03"/><line x1="${f2(cl.fc.band)}" y1="${f2(CEIL - low - 0.08)}" x2="${f2(L - cl.fc.band)}" y2="${f2(CEIL - low - 0.08)}" stroke="#F2C14E" stroke-width="0.08"/>`); }
      if (!g.open && !I.WET.has(g.t)) s.push(`<rect x="0" y="${f2(Y(0.33))}" width="${f2(L)}" height="0.33" fill="${fl.color}" stroke="${INK}" stroke-width="0.03"/>`);
      if (I.WET.has(g.t) || g.t === 'kitchen') { const dado = I.WET.has(g.t) ? 7 : 0; if (dado) { s.push(`<rect x="0" y="${f2(Y(dado))}" width="${f2(L)}" height="${dado}" fill="#E4E8EC"/>`); for (let y = 1; y < dado; y += 1) s.push(`<line x1="0" y1="${f2(Y(y))}" x2="${f2(L)}" y2="${f2(Y(y))}" stroke="#C9D1D9" stroke-width="0.02"/>`); for (let x = 2; x < L; x += 2) s.push(`<line x1="${f2(x)}" y1="${f2(Y(dado))}" x2="${f2(x)}" y2="${CEIL}" stroke="#C9D1D9" stroke-width="0.02"/>`); } }
      // openings
      g.ops.filter(o => o.side === side).forEach(o => { const a = viewT(g, side, o.a), b = viewT(g, side, o.b); const x0 = Math.min(a, b), x1 = Math.max(a, b);
        if (o.kind === 'window') { s.push(`<rect x="${f2(x0)}" y="${f2(Y(7))}" width="${f2(x1 - x0)}" height="4" fill="#CFE6F5" stroke="${INK}" stroke-width="0.06"/><line x1="${f2((x0 + x1) / 2)}" y1="${f2(Y(7))}" x2="${f2((x0 + x1) / 2)}" y2="${f2(Y(3))}" stroke="${INK}" stroke-width="0.05"/><rect x="${f2(x0 - 0.1)}" y="${f2(Y(3))}" width="${f2(x1 - x0 + 0.2)}" height="0.12" fill="#BBB"/>`);
          if (!I.WET.has(g.t) && !g.open && g.t !== 'kitchen') s.push(`<line x1="${f2(x0 - 0.8)}" y1="${f2(Y(7.6))}" x2="${f2(x1 + 0.8)}" y2="${f2(Y(7.6))}" stroke="#555" stroke-width="0.06"/><path d="M${f2(x0 - 0.8)} ${f2(Y(7.6))} q0.2 3.6 0 7.3 h0.9 q-0.2 -3.6 0 -7.3z" fill="${T.light}" stroke="${MUTE}" stroke-width="0.03"/><path d="M${f2(x1 + 0.8)} ${f2(Y(7.6))} q-0.2 3.6 0 7.3 h-0.9 q0.2 -3.6 0 -7.3z" fill="${T.light}" stroke="${MUTE}" stroke-width="0.03"/>`); }
        else { s.push(`<rect x="${f2(x0)}" y="${f2(Y(7))}" width="${f2(x1 - x0)}" height="7" fill="${o.kind === 'door' ? T.wood : '#FFFFFF'}" stroke="${INK}" stroke-width="0.07" ${o.kind === 'door' ? '' : 'stroke-dasharray="0.3 0.2"'}/>`); if (o.kind === 'door') s.push(`<rect x="${f2(x0 + 0.25)}" y="${f2(Y(6.6))}" width="${f2(x1 - x0 - 0.5)}" height="6.3" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="0.03"/><circle cx="${f2(o.hingeA !== false === (side === 'N' || side === 'E') ? x1 - 0.35 : x0 + 0.35)}" cy="${f2(Y(3.4))}" r="0.09" fill="#555"/>`); }
      });
      // items against this wall
      const vis = items.filter(it => F[it.k] && onWall(g, it, side)).sort((a, b) => (F[a.k].mount === 'wall') - (F[b.k].mount === 'wall'));
      vis.forEach(it => { const [a, b] = onWall(g, it, side); const p = viewT(g, side, a), q = viewT(g, side, b); it._side = side; s.push(elevItem(it, Math.min(p, q), Math.max(p, q), T)); delete it._side;
        const ty = Math.min(CEIL - 0.5, (it.y0 || F[it.k].y0 || 0) + (F[it.k].hb || F[it.k].h) + 0.55); s.push(tagSym((p + q) / 2, Y(ty), tag(it))); });
      // electrical points on this wall
      (elec || []).filter(e => e.side === side).forEach(e => { const x = viewT(g, side, e.t); const y = Y(e.h); s.push(elecSym(e.type, x, y, 0.32)); });
      // floor + dimensions
      s.push(`<line x1="${-m + 0.4}" y1="${CEIL}" x2="${f2(L + m - 0.4)}" y2="${CEIL}" stroke="${INK}" stroke-width="0.12"/>`);
      s.push(dimH(0, L, CEIL + 1.1, ft(L)));
      s.push(dimV(0, CEIL, L + 1.2, `${ft(CEIL)} slab`));
      if (cl.fc && !g.open) s.push(T_(L + 0.25, CEIL - cl.fc.low + 0.35, `FC ${ft(cl.fc.low)}`, 0.42, { fill: MUTE }));
      if (g.ops.some(o => o.side === side && o.kind === 'window')) s.push(T_(-0.25, Y(3) + 0.15, 'sill 3\'-0"', 0.4, { anchor: 'end', fill: MUTE }), T_(-0.25, Y(7) + 0.15, 'head 7\'-0"', 0.4, { anchor: 'end', fill: MUTE }));
      s.push(T_(0, -0.6, `ELEVATION ${VIEW[side]} — ${({ N: 'north', E: 'east', S: 'south', W: 'west' })[side]} wall`, 0.62, { weight: 'bold' }));
      s.push('</svg>');
      res.push({ side, label: `Elevation ${VIEW[side]}`, svg: s.join(''), items: vis.length });
    });
    return res;
  }
  function elecSym(type, x, y, r) {
    r = r || 0.32; const c = { switch: '#1E6FD9', socket: '#16865A', socket20: '#B7700E', tv: '#7C6BD6', data: '#7C6BD6', ac: '#C2392D', geyser: '#C2392D', hood: '#B7700E', exhaust: '#6A7F96' }[type] || INK;
    const lbl = { switch: 'S', socket: '', socket20: '15', tv: 'TV', data: 'D', ac: 'AC', geyser: 'G', hood: 'H', exhaust: 'EF' }[type];
    if (type === 'socket' || type === 'socket20') return `<g><circle cx="${f2(x)}" cy="${f2(y)}" r="${r}" fill="#fff" stroke="${c}" stroke-width="0.07"/><line x1="${f2(x - r * 0.4)}" y1="${f2(y - r * 0.2)}" x2="${f2(x - r * 0.4)}" y2="${f2(y + r * 0.3)}" stroke="${c}" stroke-width="0.06"/><line x1="${f2(x + r * 0.4)}" y1="${f2(y - r * 0.2)}" x2="${f2(x + r * 0.4)}" y2="${f2(y + r * 0.3)}" stroke="${c}" stroke-width="0.06"/>${lbl ? T_(x, y - r - 0.08, lbl, 0.3, { anchor: 'middle', fill: c, weight: 'bold' }) : ''}</g>`;
    return `<g><rect x="${f2(x - r)}" y="${f2(y - r)}" width="${f2(2 * r)}" height="${f2(2 * r)}" rx="0.06" fill="#fff" stroke="${c}" stroke-width="0.07"/>${T_(x, y + r * 0.38, lbl, lbl.length > 1 ? 0.28 : 0.38, { anchor: 'middle', fill: c, weight: 'bold' })}</g>`;
  }
  // point on plan for a wall point
  function wallXY(g, side, t, inset) { inset = inset || 0.45; return side === 'N' ? [t, inset] : side === 'S' ? [t, g.H - inset] : side === 'W' ? [inset, t] : [g.W - inset, t]; }

  function ceilingSVG(g, items, cl) {
    const W = g.W, H = g.H, m = 3; const s = [svgOpen([-m, -m, W + 2 * m, H + 2 * m + 1.5], `${g.name} reflected ceiling plan`)];
    s.push(`<rect x="0" y="0" width="${f2(W)}" height="${f2(H)}" fill="#FFFFFF"/>`);
    if (cl.fc && cl.fc.kind === 'peripheral') { const b = cl.fc.band; s.push(`<path d="M0 0H${f2(W)}V${f2(H)}H0Z M${f2(b)} ${f2(b)}V${f2(H - b)}H${f2(W - b)}V${f2(b)}Z" fill="#EEF2F6" fill-rule="evenodd"/><rect x="${f2(b)}" y="${f2(b)}" width="${f2(W - 2 * b)}" height="${f2(H - 2 * b)}" fill="none" stroke="#F2C14E" stroke-width="0.12" stroke-dasharray="0.4 0.2"/>`); s.push(T_(W / 2, b / 2 + 0.2, `FC ${ft(cl.fc.low)}`, 0.45, { anchor: 'middle', fill: MUTE }), T_(W / 2, H / 2 + 1.6, `Slab ${ft(cl.fc.high)} · cove LED`, 0.45, { anchor: 'middle', fill: MUTE })); }
    else if (cl.fc) { s.push(`<rect x="0" y="0" width="${f2(W)}" height="${f2(H)}" fill="#EEF2F6"/>`); for (let x = 2; x < W; x += 2) s.push(`<line x1="${f2(x)}" y1="0" x2="${f2(x)}" y2="${f2(H)}" stroke="#D7DEE6" stroke-width="0.03"/>`); s.push(T_(W / 2, 0.8, `Flat MR gypsum ceiling ${ft(cl.fc.low)}`, 0.45, { anchor: 'middle', fill: MUTE })); }
    shell(g, s, { swing: false });
    items.filter(it => F[it.k] && !/rug|prayer/.test(it.k)).forEach(it => { const r = I.rectOf(it); s.push(`<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" fill="none" stroke="#C3CDD8" stroke-width="0.04" stroke-dasharray="0.2 0.12"/>`); });
    cl.lights.forEach(l => {
      if (l.type === 'down') s.push(`<g><circle cx="${f2(l.x)}" cy="${f2(l.y)}" r="0.32" fill="#FFF7D6" stroke="#B7700E" stroke-width="0.06"/><path d="M${f2(l.x - 0.22)} ${f2(l.y - 0.22)}L${f2(l.x + 0.22)} ${f2(l.y + 0.22)}M${f2(l.x + 0.22)} ${f2(l.y - 0.22)}L${f2(l.x - 0.22)} ${f2(l.y + 0.22)}" stroke="#B7700E" stroke-width="0.04"/></g>`);
      else if (l.type === 'fan') s.push(`<g stroke="${INK}" stroke-width="0.06" fill="none"><circle cx="${f2(l.x)}" cy="${f2(l.y)}" r="0.35"/>${[0, 120, 240].map(a => `<path d="M${f2(l.x)} ${f2(l.y)} l${f2(Math.cos(a * Math.PI / 180) * 2)} ${f2(Math.sin(a * Math.PI / 180) * 2)}" stroke-width="0.18" stroke-linecap="round"/>`).join('')}</g>`);
      else if (l.type === 'pendant' || l.type === 'chandelier') s.push(`<g><circle cx="${f2(l.x)}" cy="${f2(l.y)}" r="${l.type === 'chandelier' ? 1.1 : 0.6}" fill="#FFF7D6" stroke="#B7700E" stroke-width="0.07"/><circle cx="${f2(l.x)}" cy="${f2(l.y)}" r="0.2" fill="#B7700E"/></g>`);
      else if (l.type === 'exhaust' || l.type === 'hood') s.push(`<g><rect x="${f2(l.x - 0.4)}" y="${f2(l.y - 0.4)}" width="0.8" height="0.8" fill="#fff" stroke="${MUTE}" stroke-width="0.06"/>${T_(l.x, l.y + 0.14, l.type === 'hood' ? 'H' : 'EF', 0.34, { anchor: 'middle', fill: MUTE, weight: 'bold' })}</g>`);
      else if (l.type === 'batten') s.push(`<rect x="${f2(l.x - 1)}" y="${f2(l.y - 0.15)}" width="2" height="0.3" fill="#FFF7D6" stroke="#B7700E" stroke-width="0.05"/>`);
      else if (l.type === 'wall') s.push(`<path d="M${f2(l.x - 0.4)} ${f2(l.y)}h0.8l-0.4 0.6z" fill="#FFF7D6" stroke="#B7700E" stroke-width="0.05"/>`);
    });
    const ac = items.find(i => i.k === 'ac'); if (ac) { const r = I.rectOf(ac); s.push(`<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" fill="#fff" stroke="#C2392D" stroke-width="0.06"/>` + T_(ac.cx, ac.cy + 0.15, 'AC', 0.35, { anchor: 'middle', fill: '#C2392D', weight: 'bold' })); }
    s.push(dimH(0, W, -1.6, ft(W), true), dimV(0, H, -1.6, ft(H), true));
    // legend
    const n = t => cl.lights.filter(l => l.type === t).length; const leg = [n('down') && `${n('down')} × LED downlight`, n('fan') && `${n('fan')} × ceiling fan`, n('pendant') && `${n('pendant')} × pendant`, n('chandelier') && `${n('chandelier')} × chandelier`, cl.lights.some(l => l.type === 'cove') && 'warm-white cove strip', n('exhaust') && 'exhaust fan'].filter(Boolean).join(' · ');
    s.push(T_(0, H + 2.2, leg, 0.48, { fill: MUTE }));
    s.push('</svg>'); return s.join('');
  }
  function electricalSVG(g, items, theme, elec, cl) {
    const W = g.W, H = g.H, m = 3; const s = [svgOpen([-m, -m, W + 2 * m, H + 2 * m + 1.5], `${g.name} electrical layout`)];
    s.push(`<rect x="0" y="0" width="${f2(W)}" height="${f2(H)}" fill="#FFFFFF"/>`); shell(g, s);
    s.push(`<g opacity="0.35">${I.symbols(items, theme)}</g>`);
    const sb = elec.find(e => e.type === 'switch');
    if (sb) { const [sx, sy] = wallXY(g, sb.side, sb.t); (cl.lights || []).filter(l => l.type !== 'cove').forEach(l => s.push(`<path d="M${f2(sx)} ${f2(sy)} Q${f2((sx + l.x) / 2 + 0.8)} ${f2((sy + l.y) / 2 - 0.8)} ${f2(l.x)} ${f2(l.y)}" fill="none" stroke="#1E6FD9" stroke-width="0.035" stroke-dasharray="0.25 0.15"/>`)); }
    (cl.lights || []).forEach(l => { if (l.type === 'cove') return; s.push(`<circle cx="${f2(l.x)}" cy="${f2(l.y)}" r="0.25" fill="#FFF7D6" stroke="#B7700E" stroke-width="0.05"/>`); });
    elec.forEach(e => { const [x, y] = wallXY(g, e.side, e.t); s.push(elecSym(e.type, x, y, 0.34)); });
    s.push(dimH(0, W, -1.6, ft(W), true), dimV(0, H, -1.6, ft(H), true));
    const cnt = t => elec.filter(e => e.type === t).length;
    s.push(T_(0, H + 2.2, [cnt('switch') && `${cnt('switch')} switchboard(s) at 4'-0"`, cnt('socket') && `${cnt('socket')} × 5 A socket`, cnt('socket20') && `${cnt('socket20')} × 15/20 A`, cnt('tv') && 'TV', cnt('data') && `${cnt('data')} × data`, cnt('ac') && 'AC point', cnt('geyser') && 'geyser'].filter(Boolean).join(' · '), 0.48, { fill: MUTE }));
    s.push('</svg>'); return s.join('');
  }
  function flooring(g, fin) {
    const fl = I.FLOORS[(fin || {}).floor] || I.FLOORS.porcelain; const W = g.W, H = g.H; const [tl, tw] = fl.tile; const long = W >= H;
    const area = W * H, waste = fl.plank ? 1.08 : 1.07; const perTile = tl * tw; const pieces = Math.ceil(area * waste / perTile);
    const skirting = g.open || I.WET.has(g.t) ? 0 : Math.max(0, 2 * (W + H) - g.ops.filter(o => o.kind !== 'window').reduce((a, o) => a + (o.b - o.a), 0));
    const m = 3; const s = [svgOpen([-m, -m, W + 2 * m, H + 2 * m + 1.5], `${g.name} flooring layout`)];
    s.push(`<clipPath id="fc${esc(g.id)}"><rect x="0" y="0" width="${f2(W)}" height="${f2(H)}"/></clipPath><rect x="0" y="0" width="${f2(W)}" height="${f2(H)}" fill="${fl.color}"/>`);
    const g1 = [`<g clip-path="url(#fc${esc(g.id)})" stroke="rgba(40,40,40,.35)" stroke-width="0.035">`];
    // set out from the room centre lines so cut tiles are equal on both sides
    const a = long ? tl : tw, b = long ? tw : tl; const ox = W / 2 - Math.ceil(W / 2 / a) * a, oy = H / 2 - Math.ceil(H / 2 / b) * b;
    if (fl.plank) { for (let y = oy, row = 0; y < H; y += b, row++) { g1.push(`<line x1="0" y1="${f2(y)}" x2="${f2(W)}" y2="${f2(y)}"/>`); const off = (row % 3) * a / 3; for (let x = ox + off; x < W; x += a) g1.push(`<line x1="${f2(x)}" y1="${f2(y)}" x2="${f2(x)}" y2="${f2(y + b)}"/>`); } }
    else if (tl < 3.9 || fl.tile[0] !== 4 || !/terrazzo/.test(fin.floor)) { for (let x = ox; x < W; x += a) g1.push(`<line x1="${f2(x)}" y1="0" x2="${f2(x)}" y2="${f2(H)}"/>`); for (let y = oy; y < H; y += b) g1.push(`<line x1="0" y1="${f2(y)}" x2="${f2(W)}" y2="${f2(y)}"/>`); }
    else { for (let x = ox; x < W; x += 4) g1.push(`<line x1="${f2(x)}" y1="0" x2="${f2(x)}" y2="${f2(H)}" stroke="#B08D3C"/>`); for (let y = oy; y < H; y += 4) g1.push(`<line x1="0" y1="${f2(y)}" x2="${f2(W)}" y2="${f2(y)}" stroke="#B08D3C"/>`); }
    g1.push('</g>'); s.push(g1.join(''));
    s.push(`<line x1="${f2(W / 2)}" y1="-0.8" x2="${f2(W / 2)}" y2="${f2(H + 0.8)}" stroke="${ACC}" stroke-width="0.04" stroke-dasharray="0.6 0.2 0.1 0.2"/><line x1="-0.8" y1="${f2(H / 2)}" x2="${f2(W + 0.8)}" y2="${f2(H / 2)}" stroke="${ACC}" stroke-width="0.04" stroke-dasharray="0.6 0.2 0.1 0.2"/>`);
    if (skirting) s.push(`<rect x="0.08" y="0.08" width="${f2(W - 0.16)}" height="${f2(H - 0.16)}" fill="none" stroke="${INK}" stroke-width="0.12"/>`);
    shell(g, s, { swing: false });
    g.ops.filter(o => o.kind !== 'window').forEach(o => { const [x, y] = wallXY(g, o.side, (o.a + o.b) / 2, 0.05); const hz = o.side === 'N' || o.side === 'S'; s.push(`<rect x="${f2(hz ? x - (o.b - o.a) / 2 : x - 0.12)}" y="${f2(hz ? y - 0.12 : y - (o.b - o.a) / 2)}" width="${f2(hz ? o.b - o.a : 0.24)}" height="${f2(hz ? 0.24 : o.b - o.a)}" fill="#B08D3C"/>`); });
    s.push(dimH(0, W, -1.6, ft(W), true), dimV(0, H, -1.6, ft(H), true));
    s.push(T_(0, H + 2.2, `${fl.n}: ${fl.plank ? 'planks run along the long side, staggered by 1/3' : `${ft(tl)} × ${ft(tw)} modules set out from the centre lines`}; brass threshold strips at doors`, 0.46, { fill: MUTE }));
    s.push('</svg>');
    return { svg: s.join(''), area, order: area * waste, pieces, perTile, skirting, fl };
  }

  // ---------- specifications ----------
  function specs(g, items, fin, theme) {
    const T = I.THEMES[theme] || I.THEMES.modern; const fl = I.FLOORS[fin.floor] || I.FLOORS.porcelain; const wl = I.WALLS[fin.wall] || I.WALLS.ivory; const cl = ceiling(g, items); const wet = I.WET.has(g.t);
    const rows = [
      ['Floor', fl.spec],
      ['Skirting', g.open || wet ? '—' : `4" (100 mm) ${fl.plank ? 'MDF skirting, painted to match the door frames' : fl.n.toLowerCase() + ' skirting, flush with plaster'}`],
      ['Walls', g.open ? 'External finish as per elevation' : wet ? `Ceramic wall tiles 12" × 24" to 7'-0" (dado); above: ${wl.n} anti-fungal emulsion` : `Wall putty 2 coats, primer, ${wl.n} (${wl.color}) washable matt emulsion, 2 coats`],
      ['Ceiling', cl.note + (cl.fc ? '; 12.5 mm gypsum board on galvanised steel channels, jointed, primed and painted white' : '')],
      ['Doors', g.ops.some(o => o.kind === 'door') ? `Solid deodar/kail wood frame 5" × 2.5"; 1-3/4" flush door, ${theme === 'traditional' ? 'carved sheesham' : theme === 'classic' ? 'walnut veneer' : theme === 'minimal' ? 'white lacquer' : 'oak veneer'} finish; stainless-steel hinges, mortise lock, door stopper` : '—'],
      ['Windows', g.ops.some(o => o.kind === 'window') ? 'Powder-coated aluminium (or uPVC) sliding frames, 5 mm clear glass, insect mesh; marble window sills' : '—'],
      ['Window dressing', g.ops.some(o => o.kind === 'window') && !g.open ? (wet || g.t === 'kitchen' ? 'PVC / aluminium roller blinds' : `Blackout curtains + sheer layer in ${T.n.toLowerCase()} palette, ceiling-mounted track`) : '—'],
      ['Lighting', cl.lights.length ? `${cl.lights.filter(l => l.type === 'down').length} × 9 W LED downlights 3000 K${cl.lights.some(l => l.type === 'cove') ? ', 12 W/m LED cove strip 3000 K' : ''}${cl.lights.some(l => l.type === 'fan') ? ', 56" ceiling fan' : ''}${cl.lights.some(l => l.type === 'pendant') ? ', pendant over table' : ''}${cl.lights.some(l => l.type === 'chandelier') ? ', feature chandelier' : ''}` : '—'],
      ['Electrical', 'Modular switches and sockets (white / brushed-steel plates); copper wiring 1.5 mm² lights, 2.5 mm² sockets, 4 mm² AC/geyser; MCB per circuit'],
    ];
    if (wet) rows.push(['Waterproofing', 'Two-coat cementitious waterproofing on floor and 1\'-0" up the walls (4\'-0" in the shower area); floor falls 1:100 to the drain']);
    if (g.t === 'kitchen') rows.push(['Backsplash', 'Ceramic / glass splash panel 24" high between counter and wall cabinets']);
    return { surfaces: rows, furniture: I.schedule(items, theme) };
  }

  // ---------- bill of quantities ----------
  const RATE = {
    skirting: { marble: [250, 450], porcelain: [150, 300], largeslab: [180, 340], wood: [180, 350], laminate: [120, 220], terrazzo: [120, 220] },
    paint: [70, 110], dado: [260, 450], fcPeri: [190, 290], fcFlat: [200, 320], cpaint: [35, 55],
    switch: [4500, 9000], socket: [3000, 6000], socket20: [4500, 8000], tv: [3500, 7000], data: [3500, 7000], ac: [7000, 12000], geyser: [6000, 10000], hood: [5000, 9000], exhaust: [5000, 9000],
    down: [1800, 4000], cove: [450, 900], fan: [14000, 28000], pendant: [25000, 90000], chandelier: [60000, 250000], exhaustFan: [4500, 9000], batten: [1500, 3500], wall: [5000, 15000],
    door: [55000, 140000], window: [1300, 2400], curtain: [3000, 7000], blind: [2000, 4500],
  };
  function boq(g, items, fin, theme) {
    const rows = []; const add = (code, trade, desc, unit, qty, rate) => { if (!qty || qty < 0.01) return; rows.push({ code, trade, desc, unit, qty: Math.round(qty * 10) / 10, rate, amt: [qty * rate[0], qty * rate[1]] }); };
    const fl = flooring(g, fin); const cl = ceiling(g, items); const el = electrical(g, items); const wet = I.WET.has(g.t);
    add('FL-01', 'Flooring', `${fl.fl.n} — supply & lay incl. 7–8% wastage`, 'ft²', fl.order, fl.fl.rate);
    if (fl.skirting) add('FL-02', 'Flooring', '4" skirting', 'rft', fl.skirting, RATE.skirting[fin.floor] || [150, 300]);
    if (!g.open) {
      const openingsArea = g.ops.reduce((a, o) => a + (o.b - o.a) * (o.kind === 'window' ? 4 : 7), 0); const gross = 2 * (g.W + g.H) * (cl.fc ? cl.fc.low : CEIL);
      if (wet) { add('WL-01', 'Walls', 'Ceramic wall tiles to 7\'-0" dado', 'ft²', Math.max(0, 2 * (g.W + g.H) * 7 - openingsArea * 0.8), RATE.dado); add('WL-02', 'Walls', 'Anti-fungal emulsion above dado', 'ft²', Math.max(0, gross - 2 * (g.W + g.H) * 7), RATE.paint); }
      else add('WL-01', 'Walls', `Putty, primer + 2 coats emulsion (${(I.WALLS[fin.wall] || I.WALLS.ivory).n})`, 'ft²', Math.max(0, gross - openingsArea), RATE.paint);
      if (cl.fc && cl.fc.kind === 'peripheral') add('CL-01', 'Ceiling', `Gypsum bulkhead ${ft(cl.fc.band)} wide with cove pocket (incl. drop)`, 'ft²', (g.area - (g.W - 2 * cl.fc.band) * (g.H - 2 * cl.fc.band)) * 1.35, RATE.fcPeri);
      else if (cl.fc) add('CL-01', 'Ceiling', 'Flat moisture-resistant gypsum ceiling', 'ft²', g.area, RATE.fcFlat);
      add('CL-02', 'Ceiling', 'Ceiling paint, white', 'ft²', g.area * (cl.fc ? 1.15 : 1), RATE.cpaint);
    }
    const cnt = t => el.filter(e => e.type === t).length; const lc = t => cl.lights.filter(l => l.type === t);
    add('EL-01', 'Electrical', 'Modular switchboard incl. wiring & conduit', 'nos', cnt('switch'), RATE.switch);
    add('EL-02', 'Electrical', '5 A socket point incl. wiring', 'nos', cnt('socket'), RATE.socket);
    add('EL-03', 'Electrical', '15/20 A power point incl. wiring', 'nos', cnt('socket20'), RATE.socket20);
    add('EL-04', 'Electrical', 'TV / data points', 'nos', cnt('tv') + cnt('data'), RATE.tv);
    add('EL-05', 'Electrical', 'AC / geyser / hood / exhaust points', 'nos', cnt('ac') + cnt('geyser') + cnt('hood') + cnt('exhaust'), RATE.ac);
    add('LT-01', 'Lighting', '9 W LED downlight 3000 K', 'nos', lc('down').length, RATE.down);
    const cove = lc('cove')[0]; if (cove) add('LT-02', 'Lighting', 'LED cove strip with driver', 'rft', 2 * (cove.w + cove.h), RATE.cove);
    add('LT-03', 'Lighting', '56" ceiling fan', 'nos', lc('fan').length, RATE.fan);
    add('LT-04', 'Lighting', 'Pendant light', 'nos', lc('pendant').length, RATE.pendant);
    add('LT-05', 'Lighting', 'Chandelier', 'nos', lc('chandelier').length, RATE.chandelier);
    add('LT-06', 'Lighting', 'Exhaust fan', 'nos', lc('exhaust').length, RATE.exhaustFan);
    add('LT-07', 'Lighting', 'LED batten', 'nos', lc('batten').length, RATE.batten);
    add('LT-08', 'Lighting', 'Outdoor wall light', 'nos', lc('wall').length, RATE.wall);
    const doors = g.ops.filter(o => o.kind === 'door' && (o.into || o.entry)); add('DW-01', 'Doors & windows', 'Door: wood frame, flush/veneer leaf, hardware', 'nos', doors.length, RATE.door);
    const winA = g.ops.filter(o => o.kind === 'window').reduce((a, o) => a + (o.b - o.a) * 4, 0); add('DW-02', 'Doors & windows', 'Aluminium/uPVC window with glass & mesh', 'ft²', winA, RATE.window);
    if (!g.open) { const winW = g.ops.filter(o => o.kind === 'window').reduce((a, o) => a + (o.b - o.a) + 2, 0); add('DW-03', 'Doors & windows', wet || g.t === 'kitchen' ? 'Roller blinds' : 'Curtains (blackout + sheer) with track', 'rft', winW, wet || g.t === 'kitchen' ? RATE.blind : RATE.curtain); }
    I.schedule(items, theme).forEach((r, i) => { if (!r.hi) return; rows.push({ code: (r.appliance ? 'AP-' : 'FF-') + String(i + 1).padStart(2, '0'), trade: r.appliance ? 'Appliances' : 'Furniture & fittings', desc: `${r.name} (${r.size})`, unit: 'nos', qty: r.qty, rate: [r.lo / r.qty, r.hi / r.qty], amt: [r.lo, r.hi] }); });
    const total = rows.reduce((a, r) => [a[0] + r.amt[0], a[1] + r.amt[1]], [0, 0]);
    const byTrade = {}; rows.forEach(r => { const t = byTrade[r.trade] || (byTrade[r.trade] = [0, 0]); t[0] += r.amt[0]; t[1] += r.amt[1]; });
    return { rows, total, byTrade };
  }
  function boqCSV(blocks) { // blocks: [{room, rows}]
    const q = v => `"${String(v).replace(/"/g, '""')}"`; const out = ['Room,Code,Trade,Description,Unit,Qty,Rate low (PKR),Rate high (PKR),Amount low (PKR),Amount high (PKR)'];
    blocks.forEach(b => b.rows.forEach(r => out.push([q(b.room), r.code, q(r.trade), q(r.desc), r.unit, r.qty, Math.round(r.rate[0]), Math.round(r.rate[1]), Math.round(r.amt[0]), Math.round(r.amt[1])].join(','))));
    return out.join('\r\n');
  }

  const api = { ceiling, electrical, planSVG, elevations, ceilingSVG, electricalSVG, flooring, specs, boq, boqCSV, tags, elecSym, RATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BuildMeDetail = api;
})(typeof window !== 'undefined' ? window : globalThis);
