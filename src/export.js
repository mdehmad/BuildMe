/* BuildMe export — cost estimate, PDF report, DXF drawings, PNG plans, GLB model, ZIP bundle */
(function (root) {
  'use strict';
  const P = root.BuildMe, V = root.BuildMeRender;

  // ---------- Cost (Islamabad, 2026 market rates per ft² of covered area) ----------
  const FINISH = {
    grey:     { name: 'Grey structure', lo: 2800, hi: 3800, note: 'Structure, brickwork, roof, plaster, plumbing & wiring rough-in' },
    standard: { name: 'Standard finish', lo: 5000, hi: 6500, note: 'Turnkey: tiles, doors, windows, kitchen, baths, paint, fittings' },
    premium:  { name: 'Premium finish', lo: 6500, hi: 9000, note: 'Turnkey with imported fittings, stone floors, high-end kitchen' },
  };
  function cost(plan, finishKey, styleKey) {
    const f = FINISH[finishKey] || FINISH.standard; const st = plan.stats;
    const style = root.BuildMe3D && root.BuildMe3D.STYLES[styleKey];
    const prem = style ? style.premium || 0 : 0;
    const rows = [
      { item: 'Ground floor (covered)', area: st.gf, factor: 1 },
      { item: 'First floor (covered)', area: st.ff, factor: 1 },
      { item: 'Stair tower (mumty)', area: plan.floors.length > 1 ? st.tower : st.tower, factor: 1 },
      { item: 'Car porch (open sided, at 50%)', area: st.porch, factor: 0.5 },
    ].filter(r => r.area > 0);
    rows.forEach(r => { r.lo = r.area * r.factor * f.lo; r.hi = r.area * r.factor * f.hi; });
    const base = { lo: rows.reduce((s, r) => s + r.lo, 0), hi: rows.reduce((s, r) => s + r.hi, 0) };
    const premPart = finishKey === 'grey' ? prem / 2 : prem;
    const elev = { item: `Elevation allowance — ${style ? style.name : 'plain'} (${Math.round(premPart * 100)}%)`, lo: base.lo * premPart, hi: base.hi * premPart };
    const total = { lo: base.lo + elev.lo, hi: base.hi + elev.hi };
    return { finish: f, finishKey, rows, elev, total, area: rows.reduce((s, r) => s + r.area * r.factor, 0) };
  }
  function pkr(v) {
    if (v >= 1e7) return 'PKR ' + (v / 1e7).toFixed(2) + ' crore';
    if (v >= 1e5) return 'PKR ' + (v / 1e5).toFixed(1) + ' lakh';
    return 'PKR ' + Math.round(v).toLocaleString('en-PK');
  }
  const pkrRange = c => `${pkr(c.lo)} – ${pkr(c.hi).replace('PKR ', '')}`;

  // ---------- Light palette for print/export ----------
  const VARS = ['paper', 'sheet', 'ink', 'muted', 'line', 'soft', 'accent', 'f-pub', 'f-prv', 'f-wet', 'f-svc', 'f-circ', 'f-open', 'n-pub', 'n-prv', 'n-wet', 'n-svc', 'n-circ', 'n-open', 'hatch', 'lawn', 'lawn-dot', 'pave', 'road', 'road-line', 'wall', 'boundary', 'glass', 'door-arc', 'gap', 'stair', 'dimc', 'g-edge', 'roof', 'roof-line'];
  function lightPalette() {
    const el = document.documentElement; const prev = el.getAttribute('data-theme');
    el.setAttribute('data-theme', 'light'); const cs = getComputedStyle(el); const pal = {};
    VARS.forEach(v => pal[v] = cs.getPropertyValue('--' + v).trim());
    if (prev == null) el.removeAttribute('data-theme'); else el.setAttribute('data-theme', prev);
    return pal;
  }
  function printableSVG(svg, pal, pxW) {
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg); const w = +vb[3], h = +vb[4];
    const W = pxW, H = Math.round(pxW * h / w);
    const css = `<style>.t-room{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:${pal.ink};letter-spacing:.03em}.t-dim{font-family:'Courier New',monospace;fill:${pal.muted}}.t-tiny{font:700 .62px Arial,sans-serif;fill:${pal.muted}}.t-road{font:700 1.5px Arial,sans-serif;fill:${pal.muted};letter-spacing:.2em}.t-open{font:700 1.05px Arial,sans-serif;fill:${pal.muted};letter-spacing:.12em}.t-dimline{font:500 1.05px 'Courier New',monospace;fill:${pal.dimc}}.t-node{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>`;
    svg = svg.replace(/var\(--([a-z0-9-]+)\)/g, (m, v) => pal[v] || '#000');
    svg = svg.replace(/<svg ([^>]*)>/, (m, a) => `<svg ${a} width="${W}" height="${H}">` + css + `<rect x="${vb[1]}" y="${vb[2]}" width="${w}" height="${h}" fill="#ffffff"/>`);
    return { svg, W, H };
  }
  function svgToCanvas(svg, pxW, pal) {
    const o = printableSVG(svg, pal, pxW);
    return new Promise((res, rej) => {
      const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = o.W; c.height = o.H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, o.W, o.H); g.drawImage(img, 0, 0); res(c); };
      img.onerror = () => rej(new Error('Could not draw the plan image'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(o.svg);
    });
  }
  const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || 'image/png', q));
  const dataURLBlob = u => fetch(u).then(r => r.blob());

  // ---------- DXF (R12 ASCII; inches; opens in AutoCAD, BricsCAD, LibreCAD — save as DWG there) ----------
  function dxf(plan, fi) {
    const fl = plan.floors[fi]; const D = plan.plot.d; const k = 12;
    const X = x => (x * k).toFixed(3), Y = y => ((D - y) * k).toFixed(3);
    const out = []; const L = (...a) => out.push(...a);
    const layers = [['A-PLOT', 8, 'CONTINUOUS'], ['A-SETBACK', 9, 'DASHED'], ['A-WALL', 7, 'CONTINUOUS'], ['A-DOOR', 4, 'CONTINUOUS'], ['A-GLAZ', 5, 'CONTINUOUS'], ['A-TEXT', 2, 'CONTINUOUS'], ['A-STAIR', 3, 'CONTINUOUS'], ['A-PORCH', 6, 'DASHED'], ['A-DIMS', 1, 'CONTINUOUS']];
    L('0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '1', '9', '$EXTMIN', '10', '-120', '20', '-120', '9', '$EXTMAX', '10', String(plan.plot.w * k + 120), '20', String(D * k + 120), '0', 'ENDSEC');
    L('0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LTYPE', '70', '2',
      '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
      '0', 'LTYPE', '2', 'DASHED', '70', '0', '3', 'Dashed __ __ __', '72', '65', '73', '2', '40', '18.0', '49', '12.0', '49', '-6.0', '0', 'ENDTAB');
    L('0', 'TABLE', '2', 'LAYER', '70', String(layers.length)); layers.forEach(([n, c, lt]) => L('0', 'LAYER', '2', n, '70', '0', '62', String(c), '6', lt)); L('0', 'ENDTAB', '0', 'ENDSEC');
    L('0', 'SECTION', '2', 'ENTITIES');
    const line = (ly, x1, y1, x2, y2) => L('0', 'LINE', '8', ly, '10', X(x1), '20', Y(y1), '30', '0', '11', X(x2), '21', Y(y2), '31', '0');
    const rect = (ly, x, y, w, h) => { line(ly, x, y, x + w, y); line(ly, x + w, y, x + w, y + h); line(ly, x + w, y + h, x, y + h); line(ly, x, y + h, x, y); };
    const text = (ly, x, y, hgt, s) => L('0', 'TEXT', '8', ly, '10', X(x), '20', Y(y), '30', '0', '40', (hgt * k).toFixed(2), '1', s.replace(/[^\x20-\x7E]/g, 'x'), '72', '1', '11', X(x), '21', Y(y), '31', '0');
    const arc = (ly, cx, cy, r, a1, a2) => L('0', 'ARC', '8', ly, '10', X(cx), '20', Y(cy), '30', '0', '40', (r * k).toFixed(3), '50', a1.toFixed(3), '51', a2.toFixed(3));
    const E = plan.E, W2 = P.WALL / 2;
    rect('A-PLOT', 0, 0, plan.plot.w, D);
    rect('A-SETBACK', E.x0, E.y0, E.W, plan.D);
    fl.rooms.forEach(r => {
      const open = P.RT[r.t].open;
      if (open) rect('A-PORCH', r.x, r.y, r.w, r.h);
      else { rect('A-WALL', r.x + W2 / 2, r.y + W2 / 2, r.w - W2, r.h - W2); }
      if (r.t !== 'shaft') { text('A-TEXT', r.x + r.w / 2, r.y + r.h / 2 - 0.6, Math.min(1, Math.max(0.5, Math.min(r.w, r.h) * 0.09)), (r.name || r.t).toUpperCase()); if (!open && Math.min(r.w, r.h) >= 5) text('A-TEXT', r.x + r.w / 2, r.y + r.h / 2 + 0.9, 0.55, V.dimText(r).replace(/×/g, 'x')); }
      if (r.t === 'stair') { const n = Math.floor((r.h - 2) / 0.85); for (let i = 0; i <= n; i++) line('A-STAIR', r.x + 0.4, r.y + 1 + i * 0.85, r.x + r.w - 0.4, r.y + 1 + i * 0.85); line('A-STAIR', r.x + r.w / 2, r.y + 1, r.x + r.w / 2, r.y + r.h - 0.4); }
    });
    // outer face of the external walls
    const enc = fl.rooms.filter(r => !P.RT[r.t].open);
    enc.forEach(r => {
      if (Math.abs(r.y - E.y0) < 0.05) line('A-WALL', r.x, r.y, r.x + r.w, r.y);
      if (Math.abs(r.y + r.h - (E.y0 + plan.D)) < 0.05) line('A-WALL', r.x, r.y + r.h, r.x + r.w, r.y + r.h);
      if (Math.abs(r.x - E.x0) < 0.05) line('A-WALL', r.x, r.y, r.x, r.y + r.h);
      if (Math.abs(r.x + r.w - (E.x0 + E.W)) < 0.05) line('A-WALL', r.x + r.w, r.y, r.x + r.w, r.y + r.h);
    });
    fl.windows.forEach(w => { if (w.orient === 'h') { line('A-GLAZ', w.p0, w.at - 0.2, w.p1, w.at - 0.2); line('A-GLAZ', w.p0, w.at + 0.2, w.p1, w.at + 0.2); } else { line('A-GLAZ', w.at - 0.2, w.p0, w.at - 0.2, w.p1); line('A-GLAZ', w.at + 0.2, w.p0, w.at + 0.2, w.p1); } });
    fl.doors.forEach(d => {
      if (d.kind === 'open') return; const len = d.p1 - d.p0; const hinge = d.hingeStart ? d.p0 : d.p1, free = d.hingeStart ? d.p1 : d.p0;
      let hx, hy, lx, ly, fx, fy;
      if (d.orient === 'h') { hx = hinge; hy = d.at; lx = hinge; ly = d.at + d.dir * len; fx = free; fy = d.at; } else { hx = d.at; hy = hinge; lx = d.at + d.dir * len; ly = hinge; fx = d.at; fy = free; }
      line('A-DOOR', hx, hy, lx, ly);
      const ang = (x, y) => Math.atan2(-(y - hy), x - hx) * 180 / Math.PI; // DXF y is flipped
      let a1 = ang(lx, ly), a2 = ang(fx, fy); if (((a2 - a1) % 360 + 360) % 360 > 180) [a1, a2] = [a2, a1];
      arc('A-DOOR', hx, hy, len, (a1 + 360) % 360, (a2 + 360) % 360);
    });
    // overall dimensions as text
    text('A-DIMS', plan.plot.w / 2, D + 3, 1, `PLOT ${plan.plot.w}' x ${plan.plot.d}'  (${plan.plot.sqyd} SQ YD)`);
    text('A-DIMS', plan.plot.w / 2, -3, 0.9, `${fi ? 'FIRST' : 'GROUND'} FLOOR PLAN - ROAD SIDE`);
    L('0', 'ENDSEC', '0', 'EOF');
    return out.join('\r\n');
  }

  // ---------- PDF report ----------
  async function pdf(ctx) {
    const { jsPDF } = root.jspdf; const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const p = ctx.plan, plot = p.plot, R = p.rules, st = p.stats; const pal = ctx.pal;
    const _t = doc.text.bind(doc); const fx = s => typeof s === 'string' ? s.replace(/ft²/g, 'sq ft').replace(/[−]/g, '-') : Array.isArray(s) ? s.map(fx) : s; doc.text = (s, ...a) => _t(fx(s), ...a);
    const W = 297, H = 210, M = 14; const ink = [15, 42, 67], muted = [93, 117, 144], accent = [30, 111, 217];
    const header = (title, sub) => {
      doc.setFillColor(...accent); doc.rect(0, 0, W, 3, 'F');
      doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(title, M, 15);
      if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...muted); doc.text(sub, M, 21); }
      doc.setFontSize(8); doc.setTextColor(...muted); doc.text(`BuildMe · ${plot.w}' x ${plot.d}' · ${ctx.date}`, W - M, 15, { align: 'right' });
    };
    const footer = n => { doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text('Indicative concept under CDA Islamabad Residential Sectors Zoning (Building Control) Regulation 1993. Costs are estimates from 2026 Islamabad market rates. Have a licensed architect prepare approval drawings.', M, H - 7); doc.text(String(n), W - M, H - 7, { align: 'right' }); };
    let page = 1;
    // --- page 1: summary
    header(`House concept — ${plot.w}' x ${plot.d}' (${plot.common})`, `${plot.sqyd} sq yd · CDA category ${R.cat} (${R.row}) · ${p.floors.length > 1 ? 'double' : 'single'} storey · ${ctx.styleName} elevation · road on the ${ctx.road}`);
    if (ctx.front) { const iw = 168, ih = iw * 0.62; doc.addImage(ctx.front, 'JPEG', M, 27, iw, ih); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(`Front view — ${ctx.styleName}`, M, 27 + ih + 5); }
    else { doc.setFontSize(10); doc.setTextColor(...muted); doc.text('3D render unavailable in this browser.', M, 40); }
    let y = 30; const x2 = M + 176;
    const kv = (k, v) => { doc.setFontSize(8); doc.setTextColor(...muted); doc.setFont('helvetica', 'normal'); doc.text(k.toUpperCase(), x2, y); doc.setFontSize(10.5); doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.text(String(v), x2, y + 5); y += 11.5; };
    kv('Bedrooms / bathrooms', `${st.beds} / ${st.baths}`);
    kv('Covered area', `GF ${Math.round(st.gf).toLocaleString()} · FF ${Math.round(st.ff).toLocaleString()} ft²`);
    kv('Ground coverage', `${(st.gfCounted / plot.sqft * 100).toFixed(1)}% of ${Math.round(R.cov * 100)}% allowed`);
    kv('Total built (FAR)', `${Math.round(st.far).toLocaleString()} of ${Math.round(st.farMax).toLocaleString()} ft² (${(st.far / plot.sqft).toFixed(2)} / ${R.far})`);
    kv('Setbacks', `Front ${P.fmt(p.E.y0)} · Rear ${P.fmt(plot.d - p.E.y0 - p.D)} · Sides ${P.fmt(p.E.x0)} / ${P.fmt(plot.w - p.E.x0 - p.E.W)}`);
    const fails = p.checks.filter(c => c.s === 'bad').length;
    kv('CDA bylaw check', fails ? `${fails} issue(s) — see page ${p.floors.length + 4}` : `All ${p.checks.length} checks pass`);
    // cost box
    const c = ctx.cost; y += 1;
    doc.setFillColor(234, 242, 252); doc.roundedRect(x2 - 4, y - 4, W - M - x2 + 4, 52, 2, 2, 'F');
    doc.setFontSize(8); doc.setTextColor(...muted); doc.setFont('helvetica', 'normal'); doc.text(`APPROXIMATE CONSTRUCTION COST — ${c.finish.name.toUpperCase()}`, x2, y + 1);
    doc.setFontSize(15); doc.setTextColor(...accent); doc.setFont('helvetica', 'bold'); doc.text(pkrRange(c.total), x2, y + 9);
    doc.setFontSize(8); doc.setTextColor(...ink); doc.setFont('helvetica', 'normal');
    let cy = y + 16; ['grey', 'standard', 'premium'].forEach(fk => { const cc = cost(p, fk, ctx.styleKey); doc.text(`${cc.finish.name}`, x2, cy); doc.text(pkrRange(cc.total), W - M - 2, cy, { align: 'right' }); cy += 5; });
    doc.setTextColor(...muted); doc.setFontSize(7); doc.text(doc.splitTextToSize(`Rates per ft² of covered area: grey ${FINISH.grey.lo.toLocaleString()}–${FINISH.grey.hi.toLocaleString()}, standard ${FINISH.standard.lo.toLocaleString()}–${FINISH.standard.hi.toLocaleString()}, premium ${FINISH.premium.lo.toLocaleString()}–${FINISH.premium.hi.toLocaleString()} (Islamabad, 2026). Excludes land, CDA fees, architect, boundary wall, furniture, solar.`, W - M - x2 - 2), x2, cy + 1);
    footer(page++);
    // --- plan pages
    const names = ['Ground floor plan', 'First floor plan'];
    for (let i = 0; i < ctx.planImgs.length; i++) {
      doc.addPage(); const im = ctx.planImgs[i];
      header(im.title, im.sub);
      const maxW = W - 2 * M, maxH = H - 38; let w = maxW, h = w * im.h / im.w; if (h > maxH) { h = maxH; w = h * im.w / im.h; }
      doc.addImage(im.url, 'JPEG', (W - w) / 2, 26, w, h, undefined, 'FAST'); footer(page++);
    }
    // --- renders page
    if (ctx.renders.length) {
      doc.addPage(); header('Elevation styles', 'Same layout rendered in different Pakistani elevation styles (front view)');
      const cols = ctx.renders.length > 2 ? 2 : ctx.renders.length, rows = Math.ceil(ctx.renders.length / cols);
      const gw = (W - 2 * M - (cols - 1) * 6) / cols; let gh = gw * 0.62; const avail = H - 40; if (rows * (gh + 8) > avail) { gh = avail / rows - 8; }
      const gwAdj = gh / 0.62;
      ctx.renders.forEach((r, i) => { const cx = M + (i % cols) * (gwAdj + 6), cyy = 27 + Math.floor(i / cols) * (gh + 8); doc.addImage(r.url, 'JPEG', cx, cyy, gwAdj, gh); doc.setFontSize(8.5); doc.setTextColor(...ink); doc.text(r.name, cx, cyy + gh + 4.5); });
      footer(page++);
    }
    // --- schedule + checks + cost breakdown
    doc.addPage(); header('Rooms, bylaws and cost', `${plot.w}' x ${plot.d}' · ${ctx.styleName}`);
    let ty = 30; const colA = M, colB = M + 140;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ink); doc.text('Room schedule (clear sizes)', colA, ty); ty += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6);
    p.floors.forEach((f, fi) => {
      doc.setTextColor(...accent); doc.text(fi ? 'FIRST FLOOR' : 'GROUND FLOOR', colA, ty); ty += 4; doc.setTextColor(...ink);
      f.rooms.filter(r => !['shaft', 'passage'].includes(r.t)).forEach(r => {
        if (ty > H - 14) { footer(page++); doc.addPage(); header('Rooms, bylaws and cost (continued)'); ty = 30; doc.setFontSize(7.6); }
        doc.text(r.name, colA, ty); doc.text(V.dimText(r).replace(/×/g, 'x'), colA + 70, ty); doc.text(String(Math.round((r.w - P.WALL) * (r.h - P.WALL))) + ' ft²', colA + 118, ty, { align: 'right' }); ty += 3.8;
      });
      ty += 2;
    });
    let by = 30; doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('CDA bylaw check', colB, by); by += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6);
    p.checks.forEach(ch => {
      const col = ch.s === 'ok' ? [31, 122, 77] : ch.s === 'warn' ? [168, 106, 18] : [178, 58, 46];
      doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.text(ch.s === 'ok' ? 'PASS' : ch.s === 'warn' ? 'NOTE' : 'FAIL', colB, by);
      doc.setTextColor(...ink); doc.setFont('helvetica', 'normal'); const lines = doc.splitTextToSize(`${ch.label}. ${ch.detail}`, W - M - colB - 12); doc.text(lines, colB + 11, by); by += lines.length * 3.6 + 1.2;
    });
    by += 4; doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text(`Cost breakdown — ${c.finish.name}`, colB, by); by += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6);
    c.rows.forEach(r => { doc.text(`${r.item}: ${Math.round(r.area).toLocaleString()} ft²`, colB, by); doc.text(pkrRange(r), W - M, by, { align: 'right' }); by += 4; });
    doc.text(c.elev.item, colB, by); doc.text(pkrRange(c.elev), W - M, by, { align: 'right' }); by += 5;
    doc.setFont('helvetica', 'bold'); doc.text('Total', colB, by); doc.text(pkrRange(c.total), W - M, by, { align: 'right' });
    footer(page++);
    return doc.output('blob');
  }

  root.BuildMeExport = { FINISH, cost, pkr, pkrRange, lightPalette, svgToCanvas, canvasBlob, dataURLBlob, dxf, pdf };
})(this);
