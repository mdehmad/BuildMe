/* ============================================================
   BuildMe engine v2 — rule-based floor-plan generator for
   Islamabad (CDA) residential plots.
   - Bylaws: CDA Islamabad Residential Sectors Zoning (Building
     Control) Regulation 1993, Schedule A/B, cl. 10, 12.06, Annex 1.
   - Layout is deterministic: a "scheme" (ordered room items in
     front/middle/rear rows + row depths) is realised into a plan.
     Search only proposes schemes; users edit schemes directly.
   ============================================================ */
(function (root) {
  'use strict';

  // ---------- Plot catalogue ----------
  const PLOTS = [
    { id: '25x40', w: 25, d: 40, common: '4 Marla' },
    { id: '25x50', w: 25, d: 50, common: '5 Marla' },
    { id: '30x60', w: 30, d: 60, common: '8 Marla' },
    { id: '35x70', w: 35, d: 70, common: '10 Marla' },
    { id: '40x80', w: 40, d: 80, common: '14 Marla' },
    { id: '50x90', w: 50, d: 90, common: '1 Kanal' },
    { id: '50x100', w: 50, d: 100, common: '1 Kanal+' },
    { id: '60x120', w: 60, d: 120, common: '1.6 Kanal' },
    { id: '75x120', w: 75, d: 120, common: '2 Kanal' },
  ];
  PLOTS.forEach(p => { p.sqft = p.w * p.d; p.sqyd = Math.round(p.sqft / 9); });

  // ---------- CDA Schedule A (bulk & height) ----------
  const SCHED_A = [
    { cat: 'A', row: 'Terraced · up to 150 yd²', type: 'terraced', maxYd: 150, front: 5, rear: 7, side1: 0, side2: 0, far: 1.2, cov: 0.60, tower: 150 },
    { cat: 'A', row: 'Terraced · 151–200 yd²', type: 'terraced', maxYd: 200, front: 6, rear: 8, side1: 0, side2: 0, far: 1.2, cov: 0.60, tower: 150 },
    { cat: 'B', row: 'Terraced · 201–625 yd²', type: 'terraced', maxYd: 625, front: 10, rear: 10, side1: 0, side2: 0, far: 1.05, cov: 0.60, tower: 200 },
    { cat: 'C', row: 'Detached · frontage 50–59 ft', type: 'detached', fr: 50, front: 10, rear: 10, side1: 5, side2: 10, far: 0.90, cov: 0.50, tower: 250 },
    { cat: 'C', row: 'Detached · frontage 60–69 ft', type: 'detached', fr: 60, front: 10, rear: 10, side1: 10, side2: 10, far: 0.90, cov: 0.50, tower: 250 },
    { cat: 'C', row: 'Detached · frontage 70–79 ft', type: 'detached', fr: 70, front: 20, rear: 10, side1: 10, side2: 10, far: 0.90, cov: 0.50, tower: 250 },
    { cat: 'D', row: 'Detached · frontage 80–89 ft', type: 'detached', fr: 80, front: 20, rear: 15, side1: 10, side2: 10, far: 0.85, cov: 0.50, tower: 250 },
    { cat: 'D', row: 'Detached · frontage 90–99 ft', type: 'detached', fr: 90, front: 20, rear: 15, side1: 10, side2: 10, far: 0.85, cov: 0.50, tower: 250 },
    { cat: 'D', row: 'Detached · frontage 100 ft +', type: 'detached', fr: 100, front: 30, rear: 15, side1: 15, side2: 15, far: 0.85, cov: 0.50, tower: 250 },
  ];
  function cdaRules(plot) {
    const yd = plot.sqft / 9; let s;
    if (plot.w < 50) s = SCHED_A.find(x => x.type === 'terraced' && yd <= x.maxYd + 0.5) || SCHED_A[2];
    else s = SCHED_A.filter(x => x.type === 'detached' && plot.w >= x.fr).pop();
    // rear open space per current CDA practice: 5' up to 5 marla, 7' below 1 kanal, 10' from 1 kanal
    const rear = plot.sqft <= 1250 ? 5 : plot.sqft < 4500 ? 7 : 10;
    return {
      cat: s.cat, row: s.row, type: s.type, front: s.front, rear,
      sideL: s.side2, sideR: s.side1, far: s.far, cov: s.cov, tower: s.tower,
      storeys: 2, height: 30, units: yd >= 488 ? 2 : 1, servantRequired: yd >= 501,
    };
  }
  // cl. 12.06 porch allowance
  function porchRules(rules, cars) {
    if (rules.type === 'terraced') return { total: 180, inSetback: 80, maxLen: 99, openSides: 1, kind: 'single (terraced)' };
    const big = rules.front > 10;
    if (cars >= 2) return { total: big ? 400 : 300, inSetback: big ? 400 : 300, maxLen: 30, openSides: 2, kind: 'combined double' };
    return { total: big ? 300 : 200, inSetback: big ? 300 : 200, maxLen: 26, openSides: 2, kind: 'single' };
  }

  function defaultOpts(plot) {
    const yd = plot.sqft / 9;
    const o = { beds: 3, gfBeds: 1, storeys: 2, drawing: false, dining: false, servant: false, cars: 1, dress: false };
    if (yd > 140) Object.assign(o, { beds: 4, gfBeds: 1, drawing: true });
    if (yd > 250) Object.assign(o, { beds: 4, gfBeds: 2, dining: true });
    if (yd > 330) Object.assign(o, { beds: 5, dress: true });
    if (yd > 480) Object.assign(o, { cars: 2 });
    if (yd >= 501) Object.assign(o, { servant: true });
    if (yd > 750) Object.assign(o, { beds: 6, gfBeds: 2 });
    return o;
  }

  // ---------- Room types (min clear sizes from Annex 1) ----------
  const RT = {
    porch:   { n: 'Car Porch',     minS: 10,  ar: 9,    light: 0, open: true },
    foyer:   { n: 'Entrance',      minS: 4,   ar: 9,    light: 0, circ: true },
    drawing: { n: 'Drawing Room',  minS: 11,  ar: 1.65, light: 2, hab: true },
    lounge:  { n: 'TV Lounge',     minS: 10.5, ar: 1.9, light: 1, circ: true, hab: true },
    dining:  { n: 'Dining',        minS: 9.5, ar: 1.8,  light: 1, circ: true, hab: true },
    kitchen: { n: 'Kitchen',       minS: 7,   ar: 2.3,  light: 1, kit: true },
    bed:     { n: 'Bedroom',       minS: 10,  ar: 1.55, light: 3, hab: true },
    bath:    { n: 'Bath',          minS: 4.5, ar: 2.6,  light: 0, wet: true },
    dress:   { n: 'Dress',         minS: 3,   ar: 5,    light: 0 },
    powder:  { n: 'Powder',        minS: 3.75, ar: 3,   light: 0, wet: true },
    stair:   { n: 'Stair',         minS: 7,   ar: 9,    light: 0 },
    store:   { n: 'Store',         minS: 2.5, ar: 9,    light: 0 },
    passage: { n: 'Passage',       minS: 3.5, ar: 99,   light: 0, circ: true },
    servant: { n: 'Servant Room',  minS: 9.5, ar: 1.8,  light: 1, hab: true },
    sbath:   { n: 'S. Bath',       minS: 3.75, ar: 3,   light: 0, wet: true },
    terrace: { n: 'Open Terrace',  minS: 3,   ar: 99,   light: 0, open: true },
    proof:   { n: 'Porch Roof',    minS: 0,   ar: 99,   light: 0, open: true },
    flounge: { n: 'Family Lounge', minS: 9.5, ar: 2.2,  light: 1, circ: true, hab: true },
    study:   { n: 'Study',         minS: 9.5, ar: 2,    light: 1, hab: true },
    shaft:   { n: 'Duct',          minS: 0,   ar: 99,   light: 0 },
    court:   { n: 'Courtyard',     minS: 5,   ar: 9,    light: 0, open: true },
    laundry: { n: 'Laundry',       minS: 4,   ar: 4,    light: 0 },
  };
  const OPTIONAL = new Set(['bed', 'study', 'store', 'powder', 'laundry', 'court', 'dining', 'drawing', 'servant', 'flounge', 'foyer']);

  // ---------- Utilities ----------
  function rngFrom(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const snap = v => Math.round(v * 4) / 4;
  const snapH = v => Math.round(v * 2) / 2;
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function fmt(v) { const t = Math.round(v * 12); const f = Math.floor(t / 12), i = t % 12; return f + "'-" + i + '"'; }
  const WALL = 0.75;
  const clone = o => JSON.parse(JSON.stringify(o));
  let uidN = Date.now() % 100000;
  const uid = p => (p || 'i') + (uidN++).toString(36);

  function sizeClass(plot) { const a = plot.sqft; return a <= 1250 ? 0 : a <= 2450 ? 1 : a <= 4500 ? 2 : 3; }
  function targets(k) {
    return {
      bed: [140, 160, 200, 250][k], drawing: [150, 190, 280, 380][k], lounge: [170, 220, 320, 440][k],
      dining: [110, 140, 190, 250][k], kitchen: [75, 100, 140, 180][k], store: [30, 35, 45, 60][k],
      sideW: [4.5, 5, 6, 6.5][k], bathD: [7.5, 8, 9, 10][k], servant: [100, 100, 110, 120][k], flounge: [120, 160, 220, 300][k],
      study: [100, 100, 120, 140][k],
    };
  }

  // ---------- Items ----------
  const room = (t, a, extra) => Object.assign({ id: uid(t[0]), kind: 'room', t, a }, extra || {});
  const suite = (t, a, extra) => Object.assign({ id: uid('s'), kind: 'suite', t, a }, extra || {});
  const stack = (parts, extra) => Object.assign({ id: uid('k'), kind: 'stack', t: parts[0].t, parts }, extra || {});
  const stairCol = (sw, filler) => ({ id: uid('st'), kind: 'stairCol', t: 'stair', sw, filler, stairTop: false });

  function itemMinW(it, S) {
    if (it.fixW) return it.fixW;
    if (it.kind === 'room') return it.minW != null ? it.minW : RT[it.t].minS;
    if (it.kind === 'suite') return (it.minW || S.bedMin) + (it.sideW || S.T.sideW);
    if (it.kind === 'stack') return Math.max(...it.parts.map(p => p.minW != null ? p.minW : RT[p.t].minS));
    if (it.kind === 'stairCol') return it.sw;
    if (it.kind === 'porch') return it.dIn > 0 ? it.pw - 0.5 : 5.5;
    return 3;
  }
  function itemArea(it, S) {
    if (it.kind === 'room') return it.a;
    if (it.kind === 'suite') { const sw = it.sideW || S.T.sideW; return it.a + sw * (it.bathD || S.T.bathD) * (it.dress ? 1.6 : 1.15); }
    if (it.kind === 'stack') return it.parts.reduce((s, p) => s + p.a, 0);
    if (it.kind === 'stairCol') return it.sw * 13;
    if (it.kind === 'porch') return (it.dIn > 0 ? it.pw : 7) * 14;
    return 0;
  }
  function itemWant(it, h, S) {
    if (it.fixW) return it.fixW;
    if (it.kind === 'stairCol') return it.sw;
    if (it.kind === 'porch') return it.dIn > 0 ? it.pw : 6.5;
    return itemArea(it, S) / h;
  }

  // ---------- Row layout (deterministic) ----------
  function solveWidths(items, W, h, S) {
    const n = items.length; const w = new Array(n).fill(0); const locked = new Array(n).fill(false);
    const minW = items.map(it => itemMinW(it, S));
    const maxW = items.map(it => it.kind === 'porch' ? (it.dIn > 0 ? it.pw + 0.5 : 9) : (it.maxW || Infinity));
    const want = items.map(it => itemWant(it, h, S));
    let free = W;
    const isFix = it => it.fixW || it.kind === 'stairCol' || (it.kind === 'porch' && it.dIn > 0);
    items.forEach((it, i) => { if (isFix(it)) { w[i] = want[i]; free -= w[i]; locked[i] = true; } });
    if (free < -0.01) return null;
    for (let iter = 0; iter < 14; iter++) {
      const idx = []; let rem = free, sw = 0;
      for (let i = 0; i < n; i++) { if (locked[i]) { if (!isFix(items[i])) rem -= w[i]; } else { idx.push(i); sw += want[i]; } }
      if (!idx.length) break;
      let changed = false;
      for (const i of idx) w[i] = rem * want[i] / sw;
      for (const i of idx) {
        if (w[i] < minW[i] - 0.01) { w[i] = minW[i]; locked[i] = true; changed = true; }
        else if (w[i] > maxW[i]) { w[i] = maxW[i]; locked[i] = true; changed = true; }
      }
      if (!changed) break;
    }
    const tot = w.reduce((s, v) => s + v, 0);
    if (tot > W + 0.05) return null;
    if (tot < W - 0.05) {
      // everyone hit a max: give the slack to the most flexible non-porch item
      let bi = -1; for (let i = 0; i < n; i++) if (!isFix(items[i]) && items[i].kind !== 'porch' && (bi < 0 || want[i] > want[bi])) bi = i;
      if (bi < 0) return null; w[bi] += W - tot;
    }
    return w;
  }

  function layoutRow(items, x0, y0, W, h, S, ctx) {
    if (!items.length) return [];
    const w = solveWidths(items, W, h, S); if (!w) return null;
    const out = []; let cx = x0; const edges = [x0];
    for (let i = 0; i < items.length; i++) { cx += w[i]; edges.push(i === items.length - 1 ? x0 + W : snap(cx)); }
    for (let i = 0; i < items.length; i++) {
      const rs = placeItem(items[i], edges[i], y0, edges[i + 1] - edges[i], h, S, ctx);
      if (!rs) return null; out.push(...rs);
    }
    return out;
  }

  function placeItem(it, x, y, w, h, S, ctx) {
    const mk = (t, xx, yy, ww, hh, extra) => Object.assign({ id: uid('r'), t, x: xx, y: yy, w: ww, h: hh, src: it.id, band: ctx.band, floor: ctx.floor }, extra || {});
    if (w < 0.5) return null;
    if (it.kind === 'room') return [mk(it.t, x, y, w, h, { target: it.fixW ? null : it.a, main: true, auto: it.auto })];
    if (it.kind === 'suite') {
      const sw = it.sideW || S.T.sideW; if (w - sw < 6) return null;
      const mx = it.sideLeft ? x + sw : x, sx = it.sideLeft ? x : x + w - sw;
      const main = mk(it.t, mx, y, w - sw, h, { target: it.a, main: true });
      const out = [main];
      const bd = Math.min(it.bathD || S.T.bathD, h), rest = h - bd;
      const bathTop = ctx.ext === 'top' ? true : ctx.ext === 'bottom' ? false : !!it.bathTop;
      const bt = it.bathType || 'bath';
      if (rest < 3) out.push(mk(bt, sx, y, sw, h, { owner: main.id }));
      else {
        out.push(mk(bt, sx, bathTop ? y : y + rest, sw, bd, { owner: main.id }));
        out.push(mk(bt === 'powder' || bt === 'sbath' ? 'store' : 'dress', sx, bathTop ? y + bd : y, sw, rest, { owner: main.id, wr: !it.dress || rest < 5 }));
      }
      return out;
    }
    if (it.kind === 'stack') {
      const parts = it.flip ? it.parts.slice().reverse() : it.parts; const tot = parts.reduce((s, p) => s + p.a, 0);
      const pmin = p => (['sbath', 'bath', 'powder'].includes(p.t) ? 4.5 : p.t === 'store' ? 3 : 6.5);
      let cy = y; const out = [];
      parts.forEach((p, i) => {
        let hh = i === parts.length - 1 ? y + h - cy : snap(Math.max(pmin(p), h * p.a / tot));
        if (i < parts.length - 1) hh = Math.min(hh, h - (cy - y) - parts.slice(i + 1).reduce((s, q) => s + pmin(q), 0));
        out.push(mk(p.t, x, cy, w, hh, { target: p.a, main: p === it.parts[0] })); cy += hh;
      });
      const m = out.find(o => o.main); out.forEach(o => { if (o !== m) o.owner = m.id; });
      return out;
    }
    if (it.kind === 'stairCol') {
      const sd = Math.min(h, 13); const rest = h - sd; const out = [];
      if (rest >= 3.5) {
        out.push(mk('stair', x, it.stairTop ? y : y + rest, w, sd, { main: true }));
        out.push(mk(it.filler || 'store', x, it.stairTop ? y + sd : y, w, rest, { stairFiller: true }));
      } else out.push(mk('stair', x, y, w, h, { main: true }));
      return out;
    }
    if (it.kind === 'porch') {
      const out = [];
      if (it.dIn > 0) {
        const pd = h - it.dIn >= 3 ? it.dIn : h;
        let ext = it.ext;
        if (pd === h && it.allow) ext = Math.max(0, Math.min(it.ext, Math.floor((it.allow / w - h) * 2) / 2));
        out.push(mk('porch', x, y - ext, w, ext + pd, { main: true, inBand: pd, ext }));
        if (pd < h) out.push(mk('foyer', x, y + pd, w, h - pd, { owner: null }));
      } else {
        out.push(mk('foyer', x, y, w, h, {}));
        const pw = it.pw; let px = x + w / 2 - pw / 2; px = Math.max(0, Math.min(ctx.plotW - pw, px));
        out.push(mk('porch', snap(px), y - it.ext, pw, it.ext, { main: true, inBand: 0, ext: it.ext }));
      }
      return out;
    }
    return null;
  }

  // ---------- Envelope ----------
  function envelope(plot, rules) {
    const x0 = rules.sideL, W = plot.w - rules.sideL - rules.sideR;
    return { x0, y0: rules.front, W, Davail: plot.d - rules.front - rules.rear };
  }

  // ---------- Programme → initial scheme ----------
  function initialScheme(plot, opts, rules, r) {
    const S = { plot: { id: plot.id, w: plot.w, d: plot.d, sqft: plot.sqft, sqyd: plot.sqyd, common: plot.common, custom: plot.custom }, rules: clone(rules), opts: clone(opts), notes: [] };
    const k = sizeClass(plot); const T = targets(k); S.k = k; S.T = T;
    const E = envelope(plot, rules); S.E = E;
    const W = E.W; if (W < 16) return null;
    S.bedMin = k <= 1 ? 10 : 10.5; S.suiteMin = S.bedMin + T.sideW;
    S.sw = W >= 40 ? 8.5 : W >= 30 ? 8 : 7.5;
    const pr = porchRules(rules, opts.cars); S.porchRule = pr;
    const pw = opts.cars >= 2 ? 18.5 : 10.5;
    const pDepth = Math.max(15.5, Math.min(17.5, pr.maxLen, Math.floor(pr.total / pw * 2) / 2));
    let ext = Math.min(rules.front, Math.floor(pr.inSetback / pw * 2) / 2, pDepth);
    let dIn;
    if (ext >= pDepth - 0.01) { ext = pDepth; dIn = 0; }
    else dIn = Math.max(4, snapH(pDepth - ext));
    const R_ = r || (() => 0.5);
    const bedItem = (a) => suite('bed', a, { sideLeft: R_() < 0.5, bathTop: R_() < 0.5, dress: opts.dress && k >= 2 });

    const F = [], M = [], R = [];
    F.push({ id: uid('p'), kind: 'porch', t: 'porch', pw, ext, dIn, allow: pr.total });
    let fRoom = W - (dIn > 0 ? pw : 6.5);
    let gfBeds = opts.storeys === 1 ? opts.beds : Math.min(opts.gfBeds, opts.beds);
    if (opts.drawing) {
      const withPowder = fRoom >= 11 + T.sideW + 4 && k >= 1;
      F.push(withPowder ? suite('drawing', T.drawing, { sideLeft: R_() < 0.5, bathTop: false, bathType: 'powder', sideW: 4.5, bathD: 6.5 }) : room('drawing', T.drawing));
      fRoom -= withPowder ? 11 + 4.5 : 11;
    }
    let placed = 0;
    while (placed < gfBeds && fRoom >= S.suiteMin && (!opts.drawing || W >= 45)) { F.push(bedItem(T.bed)); fRoom -= S.suiteMin + 2; placed++; if (W < 40) break; }
    M.push(room('lounge', T.lounge));
    if (opts.dining && W >= 30) M.push(room('dining', T.dining));
    M.push(k >= 2 ? stack([room('kitchen', T.kitchen), room('store', T.store, { minW: 3 })], { flip: R_() < 0.5 }) : room('kitchen', T.kitchen));
    const st = stairCol(S.sw, !opts.drawing && W >= 30 ? 'powder' : 'store'); st.stairTop = R_() < 0.5; M.push(st);
    for (; placed < gfBeds; placed++) R.push(bedItem(T.bed));
    if (k >= 3 && (opts.storeys >= 2 || gfBeds <= 3)) R.push(room('study', T.study));
    if (opts.servant || rules.servantRequired) R.push(suite('servant', T.servant, { minW: 10, sideW: 5, bathD: 6.75, bathType: 'sbath', sideLeft: R_() < 0.5, bathTop: R_() < 0.5 }));

    // the front row must hold something beside the porch: bring the kitchen (or dining) forward
    if (F.length === 1) {
      const ki = M.findIndex(it => it.t === 'dining') >= 0 && fRoom >= 9.5 ? M.findIndex(it => it.t === 'dining') : M.findIndex(it => it.t === 'kitchen');
      if (ki >= 0) F.push(M.splice(ki, 1)[0]); else F.push(room('foyer', 60, { minW: 4 }));
    }
    const minF = Math.max(11.5, dIn), minM = k <= 1 ? 12.5 : 13, minR = k <= 1 ? 9.5 : 10.5;
    const covD = (rules.cov * plot.sqft + (dIn > 0 ? pw * dIn : 0)) / W;
    const Dmax = Math.floor(Math.min(E.Davail, covD) * 2) / 2; S.Dmax = Dmax;
    const wMin = its => its.reduce((s, it) => s + itemMinW(it, S), 0);
    let bands;
    if (R.length && Dmax >= minF + minM + minR) {
      if (wMin(R) > W && Dmax >= minF + minM + minR * 2) {
        // pack the rear rooms into as few rows as possible. Every rear row keeps a 4'-6" spine passage
        // except the last one, which opens straight onto the corridor in front of it.
        const corridors = n => 1 + Math.ceil((n - 1) / 2);
        let maxRows = 2; while ((maxRows + 1) * minR + corridors(maxRows + 1) * 4 <= Dmax - minF - minM) maxRows++;
        const sorted = R.slice().sort((a, b) => itemMinW(b, S) - itemMinW(a, S));
        const pack = n => {
          const caps = Array.from({ length: n }, (_, i) => i === n - 1 ? W : W - 4.5); const rws = caps.map(() => []); let over = false;
          sorted.forEach(it => { const wv = itemMinW(it, S); let bi = -1; rws.forEach((rw, i) => { if (wMin(rw) + wv <= caps[i] + 0.01 && (bi < 0 || caps[i] - wMin(rw) < caps[bi] - wMin(rws[bi]))) bi = i; }); if (bi < 0) { over = true; bi = n - 1; } rws[bi].push(it); });
          return { rws, over };
        };
        let rows = null;
        for (let n = 2; n <= maxRows; n++) { const pk = pack(n); rows = pk.rws; if (!pk.over) break; }
        if (!rows) rows = pack(2).rws;
        // keep the fullest rows at the front, the last (no-spine) row widest
        rows = rows.filter(rw => rw.length);
        while (rows.length < 2) rows.push([]);
        bands = [{ id: 'F', items: F }, { id: 'M', items: M }].concat(rows.map((rw, i) => ({ id: i === rows.length - 1 ? 'R' : 'Q', items: rw })));
      } else bands = [{ id: 'F', items: F }, { id: 'M', items: M }, { id: 'R', items: R }];
    } else bands = [{ id: 'F', items: F }, { id: 'M', items: M.concat(R) }];
    const mins = { F: minF, M: minM, Q: minR, R: minR, C: 4 };
    bands.forEach(b => b.minD = mins[b.id]);
    S.gf = { bands };
    S.gfBeds = gfBeds;
    return S;
  }

  // variation used by search (not by realise)
  function vary(S, r) {
    const b = S.gf.bands;
    const F = b[0]; const porch = F.items.find(i => i.kind === 'porch'); const rest = shuffle(F.items.filter(i => i !== porch), r);
    F.items = r() < 0.5 ? [porch].concat(rest) : rest.concat([porch]);
    if (b.length === 3) {
      const M = b[1], R = b[2];
      M.items.filter(it => it.kind !== 'stairCol' && it.t !== 'lounge' && r() < 0.2).forEach(it => { M.items.splice(M.items.indexOf(it), 1); R.items.push(it); });
      R.items.filter(() => r() < 0.12).forEach(it => { R.items.splice(R.items.indexOf(it), 1); M.items.push(it); });
    }
    const last = b[b.length - 1];
    const spare = S.E.W - last.items.reduce((s, it) => s + itemMinW(it, S), 0);
    if (spare >= 7 && r() < 0.6) { const p = r(); last.items.push(room(p < 0.55 ? 'court' : p < 0.8 ? 'laundry' : 'study', Math.min(spare, 12) * 11, { minW: p < 0.55 ? 6 : 5 })); }
    for (let i = 1; i < b.length; i++) b[i].items = shuffle(b[i].items, r);
    // either: circulation rooms in the middle with kitchen / stair on each side (all reachable) …
    const pick = r();
    if (pick < 0.45) {
      const Mi = b[1].items, isC = it => it.kind === 'room' && RT[it.t].circ;
      const circ = Mi.filter(isC), nc = Mi.filter(it => !isC(it));
      if (circ.length && nc.length >= 2) b[1].items = [nc[0]].concat(circ, nc.slice(1));
    } else if (pick < 0.85) {
    // … or the lounge behind the porch so the entrance opens straight into it
      const Mi = b[1].items, li = Mi.findIndex(it => it.t === 'lounge'); if (li >= 0) { const L = Mi.splice(li, 1)[0]; if (F.items[0] === porch) Mi.unshift(L); else Mi.push(L); } }
    if (b.length >= 4) {
      const Mi = b[1].items, li = Mi.findIndex(it => it.t === 'lounge');
      S.spine = li === 0 ? 'L' : li === Mi.length - 1 && li > 0 ? 'R' : (r() < 0.5 ? 'L' : 'R');
      for (let i = 2; i < b.length; i++) { const p = room('passage', 50, { fixW: 4.5, lockedItem: true }); if (S.spine === 'L') b[i].items.unshift(p); else b[i].items.push(p); }
      // corridors: one right behind the middle row (serves it and the first rear row),
      // then one between each later pair of rear rows — every room opens onto a corridor
      const mkC = () => ({ id: 'C', items: [room('passage', 4 * S.E.W, { minW: 3, lockedItem: true })], minD: 4, fixedD: 4 });
      const rear = b.splice(2); const minSum0 = b.reduce((s, x) => s + (x.fixedD || x.minD), 0) + rear.reduce((s, x) => s + x.minD, 0);
      const plan1 = [mkC(), rear[0]];
      for (let i = 1; i < rear.length; i += 2) { if (i + 1 < rear.length) plan1.push(rear[i], mkC(), rear[i + 1]); else plan1.push(mkC(), rear[i]); }
      const plan2 = []; rear.forEach((rw, i) => { plan2.push(rw); if (i % 2 === 0 && i < rear.length - 1) plan2.push(mkC()); });
      const cost = pl => pl.filter(x => x.id === 'C').length * 4;
      const pl = S.Dmax >= minSum0 + cost(plan1) ? plan1 : S.Dmax >= minSum0 + cost(plan2) ? plan2 : rear;
      b.push(...pl);
      const lb = b[b.length - 1]; if (b[b.length - 2].id === 'C') lb.items = lb.items.filter(it => !(it.t === 'passage' && it.lockedItem));
    } else if (r() < (b.length === 3 ? (b[2].items.length >= 3 ? 0.6 : 0.4) : 0.2)) {
      b.splice(b.length - 1, 0, { id: 'C', items: [room('passage', 4 * S.E.W, { minW: 3, lockedItem: true })], minD: 4, fixedD: 4 });
    }
    // depths
    const W = S.E.W;
    const fill = [1, 1, 0.95, 0.88][S.k];
    const demand = b.reduce((s, x) => s + x.items.reduce((a, it) => a + itemArea(it, S), 0), 0) / W;
    const minSum = b.reduce((s, x) => s + (x.fixedD || x.minD), 0);
    const D = snapH(Math.min(S.Dmax, Math.max(minSum + (r() < 0.5 ? 3 : 0), demand * (1.05 + r() * 0.2), S.Dmax * fill * (0.92 + r() * 0.08))));
    S.depths = allocDepths(b, W, D, S, r);
    return S.depths ? S : null;
  }

  const MAXD = { F: 19, M: 20, Q: 17, R: 17, C: 4 };
  function allocDepths(bands, W, D, S, r) {
    const cap = b => b.fixedD || Math.max(b.minD, (MAXD[b.id] || 18) * (W >= 50 ? 1.25 : W >= 35 ? 1.1 : 1));
    const d = bands.map(b => Math.min(cap(b), b.fixedD || Math.max(b.minD, b.items.reduce((s, it) => s + itemArea(it, S), 0) / W * (0.9 + (r ? r() : 0.5) * 0.2))));
    const mins = bands.map(b => b.fixedD || b.minD);
    if (mins.reduce((s, v) => s + v, 0) > D + 0.01) return null;
    let tot = d.reduce((s, v) => s + v, 0);
    if (tot > D) { const ex = d.map((v, i) => v - mins[i]); const exT = ex.reduce((s, v) => s + v, 0); for (let i = 0; i < d.length; i++) d[i] -= exT > 0 ? (tot - D) * ex[i] / exT : 0; }
    else if (tot < D) { const fT = d.reduce((s, v, i) => s + (bands[i].fixedD ? 0 : v), 0); const add = D - tot; for (let i = 0; i < d.length; i++) if (!bands[i].fixedD) d[i] = Math.min(cap(bands[i]), d[i] + add * d[i] / fT); }
    return d.map(snapH);
  }

  // ---------- Geometry ----------
  const EPS = 0.05;
  function shared(a, b) {
    if (Math.abs(a.x + a.w - b.x) < EPS || Math.abs(b.x + b.w - a.x) < EPS) {
      const at = Math.abs(a.x + a.w - b.x) < EPS ? b.x : a.x;
      const s0 = Math.max(a.y, b.y), s1 = Math.min(a.y + a.h, b.y + b.h);
      if (s1 - s0 > EPS) return { orient: 'v', at, s0, s1, len: s1 - s0 };
    }
    if (Math.abs(a.y + a.h - b.y) < EPS || Math.abs(b.y + b.h - a.y) < EPS) {
      const at = Math.abs(a.y + a.h - b.y) < EPS ? b.y : a.y;
      const s0 = Math.max(a.x, b.x), s1 = Math.min(a.x + a.w, b.x + b.w);
      if (s1 - s0 > EPS) return { orient: 'h', at, s0, s1, len: s1 - s0 };
    }
    return null;
  }
  function overlapArea(a, b) { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? w * h : 0; }
  function exteriorEdges(rm, E, D, open) {
    const out = [];
    if (Math.abs(rm.y - E.y0) < EPS) out.push({ side: 'front', orient: 'h', at: rm.y, s0: rm.x, s1: rm.x + rm.w });
    if (Math.abs(rm.y + rm.h - (E.y0 + D)) < EPS && open.rear) out.push({ side: 'rear', orient: 'h', at: rm.y + rm.h, s0: rm.x, s1: rm.x + rm.w });
    if (Math.abs(rm.x - E.x0) < EPS && open.left) out.push({ side: 'left', orient: 'v', at: rm.x, s0: rm.y, s1: rm.y + rm.h });
    if (Math.abs(rm.x + rm.w - (E.x0 + E.W)) < EPS && open.right) out.push({ side: 'right', orient: 'v', at: rm.x + rm.w, s0: rm.y, s1: rm.y + rm.h });
    return out;
  }

  // ---------- Doors & reachability ----------
  function connect(rooms, fi, E, D, open) {
    const byId = {}; rooms.forEach(r => byId[r.id] = r);
    const isCirc = r => RT[r.t].circ || (fi > 0 && r.t === 'stair');
    const adj = {}; rooms.forEach(r => adj[r.id] = []);
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
      const s = shared(rooms[i], rooms[j]); if (s) { adj[rooms[i].id].push({ o: rooms[j], s }); adj[rooms[j].id].push({ o: rooms[i], s }); }
    }
    const doors = [], links = [], G = {}; rooms.forEach(r => G[r.id] = []); const used = [];
    const link = (a, b, kind) => { G[a.id].push(b.id); G[b.id].push(a.id); links.push({ a: a.id, b: b.id, kind }); };
    function placeDoor(a, b, s, width, kind, intoId) {
      const len = s.s1 - s.s0; const dw = Math.min(width, len - 0.6); if (dw < 2) return false;
      const cands = kind === 'open' ? [(s.s0 + s.s1) / 2 - dw / 2] : [s.s0 + 0.5, s.s1 - 0.5 - dw, (s.s0 + s.s1) / 2 - dw / 2];
      for (const p0 of cands) {
        if (used.some(u => u.orient === s.orient && Math.abs(u.at - s.at) < EPS && p0 < u.p1 + 0.4 && p0 + dw > u.p0 - 0.4)) continue;
        used.push({ orient: s.orient, at: s.at, p0, p1: p0 + dw });
        const into = byId[intoId] || b;
        const dir = s.orient === 'v' ? (into.x >= s.at - EPS ? 1 : -1) : (into.y >= s.at - EPS ? 1 : -1);
        doors.push({ orient: s.orient, at: s.at, p0, p1: p0 + dw, dir, kind, hingeStart: p0 === s.s0 + 0.5, a: a.id, b: b.id });
        link(a, b, kind); return true;
      }
      return false;
    }
    const nb = (r, pred, minLen) => adj[r.id].filter(e => pred(e.o) && e.s.len >= (minLen || 3)).sort((p, q) => q.s.len - p.s.len);
    const done = new Set();
    rooms.filter(isCirc).forEach(a => nb(a, isCirc, 3.5).forEach(e => {
      const key = [a.id, e.o.id].sort().join('|'); if (done.has(key)) return; done.add(key);
      placeDoor(a, e.o, e.s, Math.min(6, e.s.len - 1), 'open', e.o.id);
    }));
    const porch = rooms.find(r => r.t === 'porch');
    if (porch) {
      // main entrance; fall back to the drawing room, then a kitchen door (common on small plots)
      const pref = ['foyer', 'lounge', 'dining', 'passage', 'drawing', 'kitchen'];
      const c = nb(porch, o => pref.includes(o.t), 3).sort((p, q) => pref.indexOf(p.o.t) - pref.indexOf(q.o.t));
      for (const e of c) if (placeDoor(porch, e.o, e.s, e.s.len >= 4.6 ? 4 : 3, 'entry', e.o.id)) { if (e.o.t === 'kitchen') porch.kitchenEntry = true; break; }
    }
    const circPref = ['passage', 'flounge', 'lounge', 'foyer', 'dining', 'stair'];
    for (const rm of rooms) {
      if (isCirc(rm) || rm.t === 'porch') continue;
      const own = rm.owner && byId[rm.owner]; let ok = false;
      if (rm.t === 'dress' && own) { const e = adj[rm.id].find(e => e.o.id === own.id); if (e) ok = placeDoor(own, rm, e.s, 2.5, 'door', rm.id); }
      else if (['bath', 'powder', 'sbath', 'store'].includes(rm.t) && own) {
        const dress = rooms.find(o => o.owner === own.id && o.t === 'dress' && !o.wr);
        const tgt = (rm.t === 'bath' && dress && adj[rm.id].some(e => e.o.id === dress.id)) ? dress : own;
        let e = adj[rm.id].find(e => e.o.id === tgt.id); if (e) ok = placeDoor(tgt, rm, e.s, 2.5, 'door', rm.id);
        if (!ok && tgt !== own) { e = adj[rm.id].find(e => e.o.id === own.id); if (e) ok = placeDoor(own, rm, e.s, 2.5, 'door', rm.id); }
      } else if (rm.t === 'drawing') {
        const ext = nb(rm, o => o.t === 'porch' || o.t === 'foyer', 3);
        if (ext.length) ok = placeDoor(ext[0].o, rm, ext[0].s, 3.5, 'door', rm.id);
        const inner = nb(rm, o => ['lounge', 'dining', 'passage'].includes(o.t), 3);
        if (inner.length) ok = placeDoor(inner[0].o, rm, inner[0].s, 3, 'door', rm.id) || ok;
        if (!ok && Math.abs(rm.y - E.y0) < EPS) { doors.push({ orient: 'h', at: rm.y, p0: rm.x + rm.w / 2 - 1.75, p1: rm.x + rm.w / 2 + 1.75, dir: 1, kind: 'door', hingeStart: true, a: 'out', b: rm.id }); rm.extDoor = true; ok = true; }
      } else if (rm.t === 'servant') {
        const e = nb(rm, o => o.t === 'porch', 3); if (e.length) ok = placeDoor(e[0].o, rm, e[0].s, 3, 'door', rm.id);
        if (!ok) { const ex = exteriorEdges(rm, E, D, open)[0]; if (ex) { const mid = (ex.s0 + ex.s1) / 2; doors.push({ orient: ex.orient, at: ex.at, p0: mid - 1.5, p1: mid + 1.5, dir: 1, kind: 'door', hingeStart: true, a: 'out', b: rm.id }); rm.extDoor = true; ok = true; } }
        if (!ok) { const c = nb(rm, isCirc, 3); if (c.length) ok = placeDoor(c[0].o, rm, c[0].s, 3, 'door', rm.id); }
      } else if (rm.t === 'kitchen') {
        const pref = ['dining', 'lounge', 'passage', 'foyer', 'flounge'];
        const c = nb(rm, o => pref.includes(o.t), 3).sort((p, q) => pref.indexOf(p.o.t) - pref.indexOf(q.o.t));
        for (const e of c) { ok = placeDoor(e.o, rm, e.s, 3, 'door', rm.id); if (ok) break; }
        if (!ok) { const pe = nb(rm, o => o.t === 'porch', 3); if (pe.length) ok = placeDoor(pe[0].o, rm, pe[0].s, 3, 'door', rm.id); }
      } else if (rm.t === 'terrace') {
        const c = nb(rm, o => isCirc(o) || o.t === 'bed' || o.t === 'study', 3).sort((p, q) => isCirc(q.o) - isCirc(p.o));
        if (c.length) ok = placeDoor(c[0].o, rm, c[0].s, 3, 'door', rm.id);
      } else if (rm.t === 'stair' && fi === 0) {
        const sp = ['lounge', 'passage', 'foyer', 'dining', 'porch'];
        const c = nb(rm, o => sp.includes(o.t), 3.5).sort((p, q) => sp.indexOf(p.o.t) - sp.indexOf(q.o.t));
        for (const e of c) { ok = placeDoor(e.o, rm, e.s, Math.min(rm.w - 0.75, 4), 'open', rm.id); if (ok) break; }
      } else if (rm.t === 'shaft' || rm.t === 'proof') ok = true;
      else if (rm.t === 'court') { const c = nb(rm, isCirc, 3); if (c.length) placeDoor(c[0].o, rm, c[0].s, 3, 'door', rm.id); ok = true; rm.extDoor = true; }
      else {
        const c = nb(rm, isCirc, 3).sort((p, q) => circPref.indexOf(p.o.t) - circPref.indexOf(q.o.t));
        if (rm.stairFiller) { const kk = nb(rm, o => o.t === 'kitchen', 3); if (kk.length) c.unshift(kk[0]); }
        for (const e of c) { ok = placeDoor(e.o, rm, e.s, rm.t === 'bed' || rm.t === 'study' ? 3 : 2.5, 'door', rm.id); if (ok) break; }
      }
    }
    const start = fi === 0 ? porch : rooms.find(r => r.t === 'stair');
    const seen = new Set();
    if (start) { const q = [start.id]; seen.add(start.id); while (q.length) { const c = q.shift(); for (const nx of G[c]) if (!seen.has(nx)) { seen.add(nx); q.push(nx); } } }
    rooms.forEach(r => { if (r.extDoor) seen.add(r.id); });
    let grew = true; while (grew) { grew = false; links.forEach(l => { if (seen.has(l.a) !== seen.has(l.b)) { seen.add(l.a); seen.add(l.b); grew = true; } }); }
    const unreachable = rooms.filter(r => !seen.has(r.id) && !['shaft', 'proof', 'terrace'].includes(r.t)).map(r => r.id);
    return { doors, links, unreachable };
  }

  function windowsAndLight(rooms, E, D, open, fi) {
    const wins = [];
    rooms.forEach(rm => {
      const spec = RT[rm.t]; rm.lit = 0; rm.skylight = false;
      if (spec.open || ['shaft', 'dress', 'store', 'porch'].includes(rm.t)) return;
      exteriorEdges(rm, E, D, open).forEach(e => {
        const len = e.s1 - e.s0; const big = spec.hab;
        const ww = big ? Math.min(len * 0.5, rm.t === 'drawing' || rm.t === 'lounge' ? 6 : 5) : Math.min(len * 0.45, 2.5);
        if (ww < 1.5) return; const mid = (e.s0 + e.s1) / 2;
        wins.push({ orient: e.orient, at: e.at, p0: mid - ww / 2, p1: mid + ww / 2, room: rm.id }); rm.lit = 1;
      });
      if (!rm.lit) {
        const os = rooms.filter(o => RT[o.t].open && o.t !== 'proof' && o !== rm).map(o => shared(rm, o)).filter(s => s && s.len >= 4);
        if (os.length) { const s = os[0]; const ww = Math.min(4, s.len * 0.4); const mid = (s.s0 + s.s1) / 2; wins.push({ orient: s.orient, at: s.at, p0: mid - ww / 2, p1: mid + ww / 2, room: rm.id }); rm.lit = 0.6; }
      }
      if (!rm.lit && fi === 0 && ['lounge', 'dining', 'flounge'].includes(rm.t)) rm.skylight = true;
    });
    return wins;
  }

  // ---------- CDA Annex-1 minimum space standards ----------
  function annex1(rm) {
    const cw = rm.w - WALL, ch = rm.h - WALL, a = cw * ch, sh = Math.min(cw, ch);
    const spec = RT[rm.t];
    if (spec.hab) return { ok: a >= 100 && sh >= 8.5, relax: a >= 90 && sh >= 8, need: '100 ft², 8\'-6" wide' };
    if (spec.kit) return { ok: a >= 45 && sh >= 5, relax: a >= 40.5 && sh >= 4.75, need: '45 ft², 5\'-0" wide' };
    if (rm.t === 'bath' || rm.t === 'sbath') return { ok: a >= 24 && sh >= 3, relax: a >= 21.6 && sh >= 2.75, need: '24 ft², 3\'-0" wide' };
    if (rm.t === 'powder') return { ok: a >= 15 && sh >= 3, relax: a >= 13.5 && sh >= 2.75, need: '15 ft², 3\'-0" wide' };
    return null;
  }

  function scoreFloor(rooms, conn, fi) {
    let s = 0; const issues = [];
    rooms.forEach(rm => {
      const spec = RT[rm.t]; if (spec.open || ['passage', 'foyer', 'shaft'].includes(rm.t)) return;
      const cw = rm.w - WALL, ch = rm.h - WALL; const sh = Math.min(cw, ch), lg = Math.max(cw, ch);
      const minS = spec.minS - WALL;
      if (sh < minS) s += (minS - sh) * 28;
      const ar = lg / Math.max(sh, 0.1); if (ar > spec.ar) s += (ar - spec.ar) * (rm.t === 'bed' || rm.t === 'drawing' ? 30 : 14);
      if (rm.target && !rm.stairFiller) s += Math.abs(rm.w * rm.h - rm.target) / rm.target * (rm.t === 'bed' ? 10 : 6);
      if (spec.light >= 2 && !rm.lit) { s += spec.light === 3 ? 45 : 22; issues.push((rm.name || spec.n) + ' has no window'); }
      else if (spec.light >= 2 && rm.lit < 1) s += 6;
      if (spec.light === 1 && !rm.lit) s += rm.t === 'kitchen' ? 10 : 5;
      const ax = annex1(rm); if (ax && !ax.ok) s += ax.relax ? 12 : 60;
    });
    s += conn.unreachable.length * 400;
    const has = (t1, t2) => conn.links.some(l => { const a = rooms.find(r => r.id === l.a), b = rooms.find(r => r.id === l.b); return a && b && ((a.t === t1 && b.t === t2) || (a.t === t2 && b.t === t1)); });
    if (fi === 0) {
      if (rooms.some(r => r.t === 'dining') && !has('kitchen', 'dining')) s += 14;
      if (rooms.some(r => r.t === 'dining') && !has('dining', 'lounge')) s += 8;
      if (!conn.links.some(l => l.kind === 'entry')) s += 60;
      if (rooms.some(r => r.kitchenEntry)) s += 40;
    }
    s += rooms.filter(r => r.t === 'passage').reduce((a, r) => a + r.w * r.h, 0) / 12;
    return { s, issues };
  }

  // ---------- First-floor scheme ----------
  function buildFF(S, gfRooms, r) {
    const opts = S.opts, T = S.T, E = S.E;
    let nBeds = Math.max(0, opts.beds - S.gfBeds);
    const bands = S.gf.bands; const stair = gfRooms.find(x => x.t === 'stair');
    const sb = bands.findIndex(b => b.items.some(it => it.kind === 'stairCol'));
    const R_ = r || (() => 0.5);
    const bedItem = (a) => suite('bed', a, { sideLeft: R_() < 0.5, bathTop: R_() < 0.5, dress: opts.dress && S.k >= 2 });
    const rows = {}; const rowIdx = [];
    bands.forEach((b, i) => { if (i !== sb && b.id !== 'C') { rows[i] = []; rowIdx.push(i); } });
    const hasSpine = i => S.spine && (bands[i].id === 'Q' || bands[i].id === 'R');
    // FAR budget: how many suites can the first floor carry?
    const budget = S.rules.far * S.plot.sqft - (S._gfCounted || S.rules.cov * S.plot.sqft);
    const suiteA = T.bed + T.sideW * T.bathD * 1.3;
    const fixedA = S.sw * 13 + (S.k >= 1 ? T.flounge * 0.8 : 60);
    const fit = Math.max(0, Math.floor((budget - fixedA) / suiteA));
    if (nBeds > fit) { S.notes.push(`First floor limited to ${fit} bedroom${fit === 1 ? '' : 's'} by FAR ${S.rules.far} (max ${Math.round(budget)} ft² upstairs).`); nBeds = fit; }
    const cap = i => Math.max(0, Math.floor((E.W - (hasSpine(i) ? 4.5 : 0) + 0.01) / S.suiteMin));
    const order = r ? shuffle(rowIdx, r) : rowIdx.slice().sort((a, b) => a - b);
    const caps = {}; order.forEach(i => caps[i] = Math.max(1, cap(i) - (r && cap(i) >= 2 && r() < 0.3 ? 1 : 0)));
    let left = nBeds, guard = 0;
    while (left > 0 && guard++ < 20) { let put = false; for (const i of order) if (left > 0 && rows[i].filter(x => x.t === 'bed').length < caps[i]) { rows[i].push(bedItem(T.bed)); left--; put = true; } if (!put) break; }
    const segs = [[], []];
    const sL = stair.x - E.x0, sR = E.x0 + E.W - (stair.x + stair.w);
    while (left > 0) { const it = bedItem(T.bed); const fL = sL - segs[0].reduce((s, x) => s + itemMinW(x, S), 0), fR = sR - segs[1].reduce((s, x) => s + itemMinW(x, S), 0); if (Math.max(fL, fR) < S.suiteMin) break; segs[fL >= fR ? 0 : 1].push(it); left--; }
    if (left > 0) S.notes.push(`${left} bedroom${left > 1 ? 's' : ''} did not fit upstairs.`);
    const fL = sL - segs[0].reduce((s, x) => s + itemMinW(x, S), 0), fR = sR - segs[1].reduce((s, x) => s + itemMinW(x, S), 0);
    const li = fL >= fR ? 0 : 1;
    if (Math.max(fL, fR) >= 9) segs[li].push(room('flounge', T.flounge, { minW: 9.5 }));
    rowIdx.forEach(i => { if (r) rows[i] = shuffle(rows[i], r); });
    rowIdx.forEach(i => { if (hasSpine(i)) { const p = room('passage', 50, { fixW: 4.5, lockedItem: true }); if (S.spine === 'L') rows[i].unshift(p); else rows[i].push(p); } });
    const pc = stair.x + stair.w / 2;
    S.ff = { stairBand: sb, rows, segs, cutSide: pc < E.x0 + E.W / 2 ? 'R' : 'L', cutOrder: r ? shuffle(rowIdx, r) : rowIdx.slice().reverse() };
  }

  // keep FF rows consistent when the GF stair moves to another row
  function syncFF(S) {
    const ff = S.ff; if (!ff) return;
    const sb = S.gf.bands.findIndex(b => b.items.some(it => it.kind === 'stairCol'));
    const valid = new Set(S.gf.bands.map((b, i) => (b.id !== 'C' && i !== sb) ? i : null).filter(v => v != null));
    if (sb !== ff.stairBand) {
      const moved = (ff.rows[sb] || []).filter(x => !x.lockedItem);
      const old = ff.segs[0].concat(ff.segs[1]);
      delete ff.rows[sb];
      if (ff.stairBand != null && ff.stairBand >= 0 && S.gf.bands[ff.stairBand] && S.gf.bands[ff.stairBand].id !== 'C') ff.rows[ff.stairBand] = (ff.rows[ff.stairBand] || []).concat(old);
      ff.segs = [[], []]; moved.forEach((it, i) => ff.segs[i % 2].push(it));
      ff.stairBand = sb;
    }
    Object.keys(ff.rows).forEach(k => { if (!valid.has(+k)) { const its = ff.rows[k]; delete ff.rows[k]; const tgt = [...valid][0]; if (tgt != null) ff.rows[tgt] = (ff.rows[tgt] || []).concat(its.filter(x => !x.lockedItem)); } });
    valid.forEach(i => { if (!ff.rows[i]) ff.rows[i] = []; });
    ff.cutOrder = (ff.cutOrder || []).filter(i => valid.has(i)); valid.forEach(i => { if (!ff.cutOrder.includes(i)) ff.cutOrder.push(i); });
  }

  const ROWN = { F: 'front row', M: 'middle row', Q: 'first rear row', R: 'rear row', C: 'corridor' };
  // ---------- Realise a scheme into a plan ----------
  function realise(S0) {
    const S = clone(S0); S.notes = S.notes || [];
    const plot = S.plot, rules = S.rules, E = S.E, bands = S.gf.bands;
    const ctx0 = { plotW: plot.w };
    if (!S.depths || S.depths.length !== bands.length) S.depths = allocDepths(bands, E.W, S.Dmax, S, null);
    if (!S.depths) return { error: 'The rows no longer fit the buildable depth.' };
    const D = snapH(S.depths.reduce((s, v) => s + v, 0));
    E.y0 = S.opts.yard === 'rear' ? rules.front : Math.max(rules.front, snapH(plot.d - rules.rear - D));
    const open = { rear: plot.d - rules.front - D > 0.5, left: rules.sideL > 0 || (S.corner && S.cornerSide === 'L'), right: rules.sideR > 0 || (S.corner && S.cornerSide !== 'L') };
    // ground floor
    let y = E.y0; const gfRooms = []; const rowRects = [];
    for (let i = 0; i < bands.length; i++) {
      const h = S.depths[i];
      const ext = i === 0 ? 'top' : i === bands.length - 1 ? 'bottom' : null;
      const rs = layoutRow(bands[i].items, E.x0, y, E.W, h, S, Object.assign({ band: i, floor: 0, ext }, ctx0));
      if (!rs) { const need = bands[i].items.reduce((a, it) => a + itemMinW(it, S), 0); return { error: `The ${ROWN[bands[i].id]} can't take that: its rooms need at least ${fmt(need)} across but the house is ${fmt(E.W)} wide.` }; }
      gfRooms.push(...rs); rowRects.push({ i, id: bands[i].id, y, h }); y += h;
    }
    const porch = gfRooms.find(r => r.t === 'porch');
    const gfEnclosed = gfRooms.filter(r => !RT[r.t].open).reduce((s, r) => s + r.w * r.h, 0);
    const porchArea = porch ? porch.w * porch.h : 0;
    const porchSet = porch ? porch.w * Math.min(porch.ext, porch.h) : 0;
    const pr = porchRules(rules, S.opts.cars);
    const setExcess = Math.max(0, porchSet - pr.inSetback);
    const porchExempt = Math.min(porchArea - setExcess, pr.total);
    const porchExcess = Math.max(0, porchArea - porchExempt);
    const gfCounted = gfEnclosed + porchExcess;
    S._gfCounted = gfCounted;
    const g = finishFloor(gfRooms, 0, E, D, open);
    // first floor
    const floors = [g]; let ffEnclosed = 0; let ffOk = true;
    if (S.opts.storeys >= 2) {
      if (!S.ff) buildFF(S, gfRooms, null);
      syncFF(S);
      const budget = rules.far * plot.sqft - gfCounted;
      const res = layoutFF(S, gfRooms, rowRects, D, budget, open, porch);
      if (res.error) { ffOk = false; S.notes.push('First floor: ' + res.error); }
      else { floors.push(res.floor); ffEnclosed = res.enclosed; }
    }
    labelRooms(floors);
    const stair = gfRooms.find(r => r.t === 'stair');
    const stats = {
      gf: gfEnclosed, ff: ffEnclosed, porch: porchArea, porchSet, porchExempt, porchExcess, gfCounted,
      far: gfCounted + ffEnclosed, farMax: rules.far * plot.sqft, covMax: rules.cov * plot.sqft,
      tower: stair ? stair.w * stair.h : 0, D, beds: floors.reduce((s, f) => s + f.rooms.filter(r => r.t === 'bed').length, 0),
      baths: floors.reduce((s, f) => s + f.rooms.filter(r => ['bath', 'powder', 'sbath'].includes(r.t)).length, 0),
    };
    stats.total = stats.gf + stats.ff + porchArea;
    const checks = bylawChecks(S, floors, stats, porch, pr, D, open);
    let score = floors.reduce((s, f) => s + f.score, 0);
    checks.forEach(c => { if (c.s === 'bad') score += c.w || 150; });
    if (!ffOk) score += 800;
    const want = S.opts.storeys >= 2 ? S.opts.beds : S.opts.beds;
    if (stats.beds < want) score += (want - stats.beds) * 140;
    return { scheme: S, plot, rules, E, D, open, floors, rows: rowRects, stats, checks, score, notes: S.notes, porchRule: pr };
  }

  function layoutFF(S, gfRooms, rowRects, D, budget, open, porch) {
    const E = S.E, ff = S.ff; const stair = gfRooms.find(x => x.t === 'stair'); const filler = gfRooms.find(x => x.stairFiller);
    const sb = ff.stairBand; const sL = stair.x - E.x0, sR = E.x0 + E.W - (stair.x + stair.w);
    const cut = {}; // auto open-terrace width per row
    // trim oversize rows: a row whose rooms would stretch far beyond their targets gets a terrace
    rowRects.forEach(rr => {
      if (rr.i === sb || rr.id === 'C') return;
      const its = ff.rows[rr.i] || []; if (!its.length) return;
      const want = its.reduce((s, it) => s + itemWant(it, rr.h, S), 0);
      const spare = E.W - want * 1.3; if (spare >= 5) cut[rr.i] = snapH(spare);
    });
    let last = null;
    for (let iter = 0; iter < 10; iter++) {
      const rooms = []; let fail = null;
      for (const rr of rowRects) {
        const ctx = { band: rr.i, floor: 1, plotW: S.plot.w, ext: rr.i === 0 ? 'top' : rr.i === rowRects.length - 1 ? 'bottom' : null };
        if (rr.id === 'C') { rooms.push({ id: uid('r'), t: 'passage', x: E.x0, y: rr.y, w: E.W, h: rr.h, band: rr.i, floor: 1, src: 'auto' }); continue; }
        if (rr.i === sb) {
          rooms.push(Object.assign({}, stair, { id: uid('r'), floor: 1 }));
          if (filler) rooms.push(Object.assign({}, filler, { id: uid('r'), floor: 1, t: filler.h >= 4.5 && filler.w >= 5 ? 'bath' : 'store', target: null, src: 'auto' }));
          const segW = [sL, sR];
          for (let s = 0; s < 2; s++) {
            if (segW[s] < 0.5) continue;
            let its = (ff.segs[s] || []).slice();
            if (!its.length) its = [room(segW[s] < 3 ? 'shaft' : segW[s] < 6 ? 'store' : 'terrace', 10, { minW: 0, auto: true })];
            else if (!its.some(x => x.t === 'flounge' || x.t === 'passage') && its.some(x => x.t !== 'terrace') && segW[s] - its.reduce((a, x) => a + itemMinW(x, S), 0) >= 3.5) {
              const lob = room('passage', 10, { fixW: 3.5, auto: true, lobby: true });
              if (s === 0) its.push(lob); else its.unshift(lob);
            }
            if (cut['s' + s]) its.push(room('terrace', 10, { fixW: Math.min(cut['s' + s], segW[s]), auto: true }));
            const x0 = s === 0 ? E.x0 : stair.x + stair.w;
            const rs = layoutRow(its, x0, rr.y, segW[s], rr.h, S, ctx); if (!rs) { fail = 'rooms beside the stair do not fit'; break; }
            rooms.push(...rs);
          }
          if (fail) break; continue;
        }
        let its = (ff.rows[rr.i] || []).slice();
        if (!its.length) its = [room('terrace', E.W * rr.h, { minW: 3, auto: true })];
        else if (cut[rr.i]) {
          const t = room('terrace', 10, { fixW: cut[rr.i], auto: true });
          const lockedEnd = its.findIndex(x => x.lockedItem);
          if (ff.cutSide === 'L') its.splice(lockedEnd === 0 ? 1 : 0, 0, t); else its.splice(lockedEnd === its.length - 1 && lockedEnd >= 0 ? its.length - 1 : its.length, 0, t);
        }
        const rs = layoutRow(its, E.x0, rr.y, E.W, rr.h, S, ctx); if (!rs) { fail = `the ${ROWN[S.gf.bands[rr.i].id]} has more rooms than fit in ${fmt(E.W)}`; break; }
        rooms.push(...rs);
      }
      if (fail) return last ? last : { error: fail };
      // porch roof may not be used as a terrace (cl. 12.06 vi)
      if (porch && porch.inBand > 0) {
        const pin = { x: porch.x, y: porch.y + porch.ext, w: porch.w, h: porch.inBand };
        rooms.forEach(r => { if (r.t === 'terrace' && overlapArea(r, pin) > 0.3 * r.w * r.h) { r.t = 'proof'; r.name = 'Porch Roof'; } });
      }
      const enclosed = rooms.filter(r => !RT[r.t].open).reduce((s, r) => s + r.w * r.h, 0);
      const f = finishFloor(rooms, 1, E, D, open);
      last = { floor: f, enclosed };
      const excess = enclosed - budget;
      if (excess <= 0.5) return last;
      // shed area into open roof terraces, following the cut order
      let grown = false;
      for (const i of ff.cutOrder.concat(['s0', 's1'])) {
        const rr = typeof i === 'string' ? rowRects.find(x => x.i === sb) : rowRects.find(x => x.i === i); if (!rr) continue;
        let its, W;
        if (typeof i === 'string') { const s = +i[1]; W = s ? sR : sL; its = ff.segs[s] || []; if (W < 0.5) continue; }
        else { W = E.W; its = ff.rows[i] || []; if (!its.length) continue; }
        const minItems = its.reduce((s, it) => s + itemMinW(it, S), 0);
        const cur = cut[i] || 0; const room_ = W - minItems - cur; if (room_ < 1) continue;
        const add = Math.min(room_, Math.max(1, snapH(excess / rr.h + 0.49)));
        cut[i] = cur + add; grown = true; break;
      }
      if (!grown) return last;
    }
    return last;
  }

  function finishFloor(rooms, fi, E, D, open) {
    const conn = connect(rooms, fi, E, D, open);
    const wins = windowsAndLight(rooms, E, D, open, fi);
    const sc = scoreFloor(rooms, conn, fi);
    return { rooms, doors: conn.doors, links: conn.links, windows: wins, unreachable: conn.unreachable, score: sc.s, issues: sc.issues };
  }

  function labelRooms(floors) {
    let bi = 1;
    floors.forEach((f, fi) => {
      const beds = f.rooms.filter(r => r.t === 'bed').sort((a, b) => b.w * b.h - a.w * a.h);
      beds.forEach((b, i) => { if (fi === 1 && i === 0) b.name = 'Master Bedroom'; else b.name = 'Bedroom ' + (bi++); });
      const hasDining = f.rooms.some(r => r.t === 'dining');
      f.rooms.forEach(r => { if (!r.name) r.name = r.t === 'dress' && r.wr ? 'W/R' : r.t === 'lounge' && !hasDining ? 'Lounge / Dining' : RT[r.t].n; });
    });
  }

  // ---------- Bylaw checks ----------
  function bylawChecks(S, floors, st, porch, pr, D, open) {
    const plot = S.plot, R = S.rules, E = S.E, A = plot.sqft; const out = [];
    const add = (s, label, detail, w) => out.push({ s, label, detail, w });
    const rear = plot.d - E.y0 - D, sideR = plot.w - E.x0 - E.W;
    const def = cdaRules(plot);
    add(E.y0 >= def.front - 0.01 && rear >= def.rear - 0.01 ? 'ok' : 'bad', 'Front & rear setbacks', `Front ${fmt(E.y0)} (min ${def.front}'), rear ${fmt(rear)} (min ${def.rear}')`);
    if (R.type === 'detached' || def.sideL + def.sideR > 0) add(E.x0 >= def.sideL && sideR >= def.sideR ? 'ok' : 'bad', 'Side setbacks', `${fmt(E.x0)} and ${fmt(sideR)} (min ${def.sideL}' / ${def.sideR}')`);
    else add('ok', 'Side setbacks', 'None required for terraced houses — party walls both sides');
    add(st.gfCounted <= st.covMax + 0.5 ? 'ok' : 'bad', 'Ground coverage', `${Math.round(st.gfCounted)} ft² = ${(st.gfCounted / A * 100).toFixed(1)}% (max ${Math.round(R.cov * 100)}% = ${Math.round(st.covMax)} ft²)`, 300);
    if (S.opts.storeys >= 2) add(st.far <= st.farMax + 0.5 ? 'ok' : 'bad', 'Floor area ratio', `${Math.round(st.far)} ft² = FAR ${(st.far / A).toFixed(2)} (max ${R.far} = ${Math.round(st.farMax)} ft²)`, 300);
    if (porch) {
      const pw = porch.w - WALL;
      const okA = st.porchExcess <= 0.5 && st.porchSet <= pr.inSetback + 0.5;
      add(okA ? 'ok' : 'warn', 'Car porch area', `${Math.round(st.porch)} ft² (${Math.round(st.porchSet)} in setback) — ${pr.kind} limit ${pr.total} ft²${R.type === 'terraced' ? ', 80 ft² in setback' : ''}${st.porchExcess > 0.5 ? `; ${Math.round(st.porchExcess)} ft² counted into coverage/FAR` : ''}`, 0);
      add(pw >= 9 ? 'ok' : 'bad', 'Porch width', `${fmt(pw)} clear (min 9'-0")`);
      if (R.type === 'detached') add(Math.max(porch.w, porch.h) <= pr.maxLen + 0.01 ? 'ok' : 'bad', 'Porch length', `${fmt(Math.max(porch.w, porch.h))} (max ${pr.maxLen}')`);
      const ffr = floors[1] ? floors[1].rooms.filter(r => r.t === 'proof').length : 0;
      add('ok', 'Porch roof', ffr ? 'Roof over porch kept inaccessible — no terrace (cl. 12.06 vi)' : 'Porch roof not used as terrace (cl. 12.06 vi)');
    }
    add(st.tower <= R.tower + 0.5 ? 'ok' : st.tower <= R.tower + 50 ? 'warn' : 'bad', 'Stair tower (mumty)', `${Math.round(st.tower)} ft² (max ${R.tower} ft², Schedule B; 7'-6" internal height)`);
    add(S.opts.storeys <= 2 ? 'ok' : 'bad', 'Storeys & height', `${S.opts.storeys} storey${S.opts.storeys > 1 ? 's' : ''}, max 2 and 30'-0" from road; parapet 3'-0"`);
    const srv = floors[0].rooms.some(r => r.t === 'servant') && floors[0].rooms.some(r => r.t === 'sbath');
    if (R.servantRequired) add(srv ? 'ok' : 'bad', 'Servant room', srv ? 'Servant room with bath provided (required from 501 yd², cl. 10)' : 'Required from 501 yd² (cl. 10) — add a servant room with bath');
    const bad = [], relax = [];
    floors.forEach((f, fi) => f.rooms.forEach(r => { const a = annex1(r); if (a && !a.ok) (a.relax ? relax : bad).push(`${fi ? 'FF' : 'GF'} ${r.name} (needs ${a.need})`); }));
    add(bad.length ? 'bad' : relax.length ? 'warn' : 'ok', 'Minimum room sizes', bad.length ? bad.join('; ') : relax.length ? 'Within 10% relaxation (with penalty): ' + relax.join('; ') : 'All rooms meet Annex 1 minimum areas and widths', 120);
    const stair = floors[0].rooms.find(r => r.t === 'stair');
    if (stair) add(stair.w / 2 - 0.4 >= 3.25 ? 'ok' : 'warn', 'Stair flight width', `${fmt(stair.w / 2 - 0.4)} per flight (min 3'-3")`);
    const unreach = floors.reduce((s, f) => s + f.unreachable.length, 0);
    add(unreach ? 'bad' : 'ok', 'Circulation', unreach ? `${unreach} room(s) cannot be reached` : 'Every room reachable from the porch / stair landing', 400);
    add('ok', 'Living units', `${R.units} unit${R.units > 1 ? 's' : ''} permitted on ${plot.sqyd} yd² (cl. 16)`);
    return out;
  }

  // ---------- Search (proposes schemes; not used for edits) ----------
  function generate(plot, opts, rules, seed, tries, diag) {
    const R0 = rngFrom(seed); tries = tries || 160;
    const why = (k) => { if (diag) diag[k] = (diag[k] || 0) + 1; };
    let o = clone(opts); if (o.storeys === 1) o.gfBeds = o.beds; o.gfBeds = Math.min(o.gfBeds, o.beds);
    const notesBase = []; let best = null; const moved = { up: 0, down: 0 };
    for (let attempt = 0; attempt < 16; attempt++) {
      const res = []; const nt = attempt < 2 ? tries : Math.ceil(tries / (attempt < 5 ? 2 : 3));
      for (let t = 0; t < nt; t++) {
        const r = rngFrom(Math.floor(R0() * 1e9));
        let S = initialScheme(plot, o, rules, r); if (!S) { why('scheme'); break; }
        S.corner = opts.corner; S.cornerSide = opts.cornerSide;
        S = vary(S, r); if (!S) { why('depth'); continue; }
        let P = realise(S); if (P.error) { why('row:' + P.error.replace(/\d[\d'"-]*/g, '#')); continue; }
        // pull depth back if ground coverage is exceeded
        for (let fix = 0; fix < 4 && P.stats.gfCounted > P.stats.covMax + 0.5; fix++) {
          const over = (P.stats.gfCounted - P.stats.covMax) / S.E.W + 0.25;
          const flex = S.gf.bands.map((b, i) => b.fixedD ? 0 : S.depths[i] - b.minD); const ft = flex.reduce((a, v) => a + v, 0); if (ft <= 0) break;
          S.depths = S.depths.map((d, i) => snapH(d - over * flex[i] / ft));
          P = realise(S); if (P.error) break;
        }
        if (P.error) continue;
        // first floor distribution variants
        if (o.storeys >= 2) {
          let bestF = null;
          for (let k = 0; k < 8; k++) {
            const S2 = clone(P.scheme); delete S2.ff; S2.notes = [];
            const gfR = P.floors[0].rooms; buildFF(S2, gfR, rngFrom(Math.floor(r() * 1e9)));
            const P2 = realise(S2); if (P2.error) continue;
            if (!bestF || P2.score < bestF.score) bestF = P2;
          }
          if (!bestF || bestF.floors.length < 2) { why('ff'); continue; } P = bestF;
        }
        if (P.floors.some(f => f.unreachable.length)) { why('unreach:' + P.floors.map(f => f.unreachable.map(u => (f.rooms.find(r => r.id === u) || {}).t || u).join(',')).join('/')); continue; }
        P.sig = P.floors[0].rooms.map(x => x.t[0] + Math.round(x.x) + ',' + Math.round(x.y)).join('');
        res.push(P);
      }
      // a plan that fails a bylaw only wins when nothing compliant was found
      res.forEach(p => { p.badN = p.checks.filter(c => c.s === 'bad').length; p.rank = p.score + p.badN * 1000; });
      res.sort((a, b) => a.rank - b.rank);
      const okFound = res.some(p => !p.badN);
      if (res.length) {
        // rank attempts against the ORIGINAL brief: every bedroom short costs 140, every relaxation 30
        const val = res[0].rank + Math.max(0, opts.beds - o.beds) * 140 + notesBase.length * 30;
        if (!best || val < best.val) best = { val, res, notes: notesBase.slice() };
        if (res[0].rank < 90) break;
      }
      if (best && best.res[0].stats.beds >= opts.beds && best.res[0].rank < 150) break;
      if (!relax(okFound, okFound && res[0].stats.beds < o.beds)) break;
    }
    function relax(found, short) {
      // gentlest change first; each step is explained to the user
      if (found && short && o.storeys >= 2 && !moved.down && o.gfBeds < Math.min(4, o.beds)) { o.gfBeds++; moved.up++; notesBase.push('One bedroom moved downstairs — the first floor could not hold them all.'); return true; }
      if (o.gfBeds > 0 && o.storeys >= 2 && !moved.up) { o.gfBeds--; moved.down++; notesBase.push('One ground-floor bedroom moved upstairs for a workable plan.'); return true; }
      if (o.dress) { o.dress = false; notesBase.push('Dressing rooms reduced to wardrobes — they did not fit.'); return true; }
      if (o.dining) { o.dining = false; notesBase.push('Separate dining merged into the lounge — it did not fit.'); return true; }
      if (o.drawing) { o.drawing = false; notesBase.push('Drawing room dropped — it did not fit.'); return true; }
      if (o.cars >= 2) { o.cars = 1; notesBase.push('Car porch reduced to one car — two did not fit.'); return true; }
      if (o.servant && !rules.servantRequired) { o.servant = false; notesBase.push('Servant room dropped — it did not fit.'); return true; }
      if (found) return false; // only give up bedrooms when nothing fits at all
      if (o.storeys === 1 && o.beds > 1) { o.beds--; o.gfBeds = o.beds; notesBase.push('One bedroom fewer — a single storey on this plot cannot hold more.'); return true; }
      if (o.storeys >= 2 && o.beds > 1) { o.beds--; notesBase.push('One bedroom fewer, to fit the plot.'); return true; }
      return false;
    }
    if (diag) { diag.tried = notesBase.slice(); diag.opts = o; }
    if (!best) { const none = []; none.diag = diag || null; return none; }
    const uniq = []; const seen = new Set();
    for (const p of best.res) { if (seen.has(p.sig)) continue; seen.add(p.sig); p.notes = best.notes.concat(p.notes.filter(n => !best.notes.includes(n))); p.scheme.notes = p.notes.slice(); uniq.push(p); if (uniq.length >= 6) break; }
    return uniq;
  }

  // ---------- Edits (all return a new scheme or {error}) ----------
  function locate(S, id) {
    for (let i = 0; i < S.gf.bands.length; i++) { const j = S.gf.bands[i].items.findIndex(it => it.id === id); if (j >= 0) return { floor: 0, list: S.gf.bands[i].items, i, j, band: i }; }
    if (S.ff) {
      for (const k of Object.keys(S.ff.rows)) { const j = S.ff.rows[k].findIndex(it => it.id === id); if (j >= 0) return { floor: 1, list: S.ff.rows[k], i: +k, j, band: +k }; }
      for (let s = 0; s < 2; s++) { const j = S.ff.segs[s].findIndex(it => it.id === id); if (j >= 0) return { floor: 1, list: S.ff.segs[s], i: 's' + s, j, band: S.ff.stairBand, seg: s }; }
    }
    return null;
  }
  function listFor(S, floor, lane) {
    if (floor === 0) return S.gf.bands[lane] ? S.gf.bands[lane].items : null;
    if (typeof lane === 'string') return S.ff.segs[+lane[1]];
    return S.ff.rows[lane] || null;
  }
  function guardMove(it, floor, lane, S) {
    if (it.lockedItem) return 'Passages are fixed.';
    if (it.kind === 'porch' && (floor !== 0 || lane !== 0)) return 'The car porch must stay on the road side.';
    if (it.kind === 'stairCol' && floor !== 0) return 'Move the stair on the ground floor; the first floor follows.';
    if (floor === 0 && S.gf.bands[lane] && S.gf.bands[lane].id === 'C') return 'The corridor row holds only the passage.';
    return null;
  }
  function checked(S2) {
    const P = realise(S2); if (P.error) return { error: P.error };
    if (S2.opts.storeys >= 2 && P.floors.length < 2) return { error: (P.notes.filter(n => n.startsWith('First floor:')).pop() || 'First floor no longer fits') + '.' };
    if (P.floors.some(f => f.unreachable.length)) return { error: 'That would leave a room with no way in.' };
    return { scheme: P.scheme, plan: P };
  }

  const edit = {
    swap(S, a, b) {
      const S2 = clone(S); const A = locate(S2, a), B = locate(S2, b);
      if (!A || !B) return { error: 'Pick two rooms on the same floor.' };
      if (A.floor !== B.floor) return { error: 'Rooms can only be swapped on the same floor.' };
      const ia = A.list[A.j], ib = B.list[B.j];
      const e = guardMove(ia, B.floor, B.i, S2) || guardMove(ib, A.floor, A.i, S2); if (e) return { error: e };
      A.list[A.j] = ib; B.list[B.j] = ia;
      return checked(S2);
    },
    move(S, id, floor, lane, index) {
      const S2 = clone(S); const A = locate(S2, id); if (!A) return { error: 'Room not found.' };
      if (A.floor !== floor) return { error: 'Rooms stay on their floor — use Add room upstairs instead.' };
      const it = A.list[A.j]; const e = guardMove(it, floor, lane, S2); if (e) return { error: e };
      const L = listFor(S2, floor, lane); if (!L) return { error: 'No row there.' };
      A.list.splice(A.j, 1); let ix = Math.max(0, Math.min(index, L.length));
      if (L === A.list && index > A.j) ix--;
      L.splice(Math.max(0, Math.min(ix, L.length)), 0, it);
      return checked(S2);
    },
    resize(S, id, f) {
      const S2 = clone(S); const A = locate(S2, id); if (!A) return { error: 'Room not found.' };
      const it = A.list[A.j];
      if (it.kind === 'stack') it.parts[0].a *= f; else if (it.kind === 'porch' || it.kind === 'stairCol' || it.lockedItem) return { error: 'This element has a fixed size.' }; else it.a *= f;
      return checked(S2);
    },
    flip(S, id) {
      const S2 = clone(S); const A = locate(S2, id); if (!A) return { error: 'Room not found.' };
      const it = A.list[A.j];
      if (it.kind === 'suite') it.sideLeft = !it.sideLeft; else if (it.kind === 'stack') it.flip = !it.flip; else if (it.kind === 'stairCol') it.stairTop = !it.stairTop; else return { error: 'Nothing to flip on this room.' };
      return checked(S2);
    },
    remove(S, id) {
      const S2 = clone(S); const A = locate(S2, id); if (!A) return { error: 'Room not found.' };
      const it = A.list[A.j];
      if (!OPTIONAL.has(it.t) || it.lockedItem) return { error: `The ${RT[it.t].n.toLowerCase()} is part of the core programme and can't be removed.` };
      if (it.t === 'servant' && S2.rules.servantRequired) return { error: 'A servant room is mandatory on plots of 501 yd² and above.' };
      A.list.splice(A.j, 1);
      if (it.t === 'bed') { S2.opts.beds = Math.max(0, S2.opts.beds - 1); if (A.floor === 0) S2.gfBeds = Math.max(0, S2.gfBeds - 1); }
      return checked(S2);
    },
    add(S, type, floor, lane) {
      const S2 = clone(S); const T = S2.T; let it;
      if (type === 'bed') it = suite('bed', T.bed, { sideLeft: false, bathTop: false, dress: S2.opts.dress && S2.k >= 2 });
      else if (type === 'servant') it = suite('servant', T.servant, { minW: 10, sideW: 5, bathD: 6.75, bathType: 'sbath' });
      else if (type === 'drawing') it = room('drawing', T.drawing);
      else if (type === 'dining') it = room('dining', T.dining);
      else if (type === 'study') it = room('study', T.study);
      else if (type === 'flounge') it = room('flounge', T.flounge, { minW: 9.5 });
      else if (type === 'court') it = room('court', 70, { minW: 6 });
      else it = room(type, type === 'powder' ? 24 : 35, { minW: RT[type].minS });
      if (floor === 1 && !S2.ff) return { error: 'This is a single-storey plan.' };
      const L = listFor(S2, floor, lane); if (!L) return { error: 'No row there.' };
      if (floor === 0 && S2.gf.bands[lane].id === 'C') return { error: 'Add rooms to a front, middle or rear row.' };
      L.push(it);
      if (type === 'bed') { S2.opts.beds++; if (floor === 0) S2.gfBeds++; }
      const out = checked(S2); if (!out.error) out.added = it.id; return out;
    },
    depth(S, lane, delta) {
      const S2 = clone(S); const b = S2.gf.bands[lane]; if (!b) return { error: 'No row there.' };
      if (b.fixedD) return { error: 'The corridor row has a fixed 4 ft depth.' };
      const nd = snapH(S2.depths[lane] + delta);
      if (nd < b.minD) return { error: `This row can't be shallower than ${fmt(b.minD)}.` };
      const D = S2.depths.reduce((s, v) => s + v, 0) + delta;
      if (D > S2.E.Davail + 0.01) return { error: `No depth left — the rear setback of ${S2.rules.rear}' would be breached.` };
      S2.depths[lane] = nd;
      const out = checked(S2); if (out.error) return out;
      if (out.plan.stats.gfCounted > out.plan.stats.covMax + 0.5 && delta > 0) return { error: `That would exceed the ${Math.round(S2.rules.cov * 100)}% ground coverage limit.` };
      return out;
    },
    mirror(S) {
      const S2 = clone(S);
      S2.gf.bands.forEach(b => { b.items.reverse(); b.items.forEach(it => { if (it.kind === 'suite') it.sideLeft = !it.sideLeft; }); });
      if (S2.ff) { Object.values(S2.ff.rows).forEach(L => { L.reverse(); L.forEach(it => { if (it.kind === 'suite') it.sideLeft = !it.sideLeft; }); }); S2.ff.segs = [S2.ff.segs[1].reverse(), S2.ff.segs[0].reverse()]; S2.ff.segs.forEach(L => L.forEach(it => { if (it.kind === 'suite') it.sideLeft = !it.sideLeft; })); S2.ff.cutSide = S2.ff.cutSide === 'L' ? 'R' : 'L'; }
      if (S2.spine) S2.spine = S2.spine === 'L' ? 'R' : 'L';
      return checked(S2);
    },
  };

  const api = { PLOTS, SCHED_A, RT, cdaRules, porchRules, defaultOpts, generate, realise, edit, locate, fmt, WALL, annex1, _dbg: { initialScheme: (...a) => initialScheme(...a), vary: (...a) => vary(...a), rngFrom: (...a) => rngFrom(...a) } };
  if (typeof module !== 'undefined') module.exports = api; else root.BuildMe = api;
})(this);
