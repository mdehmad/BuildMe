/* BuildMe interiors — realistic 3D rooms (three.js r128), furnished-house GLB and the room-by-room design package.
   Depends on window.THREE (+ OrbitControls, GLTFExporter), BuildMeInterior, BuildMeDetail, and for the package jsPDF/JSZip.
   Room-local plan coordinates map to three as x → x, y → z, height → y (feet). All geometry UVs are in feet,
   so procedural textures (wood grain, fabric, tiles, marble) keep a real-world scale on every surface. */
(function (root) {
  'use strict';
  const I = root.BuildMeInterior; const D = () => root.BuildMeDetail;
  const WALL_H = 9.5, WALL_T = 0.4, DEG = Math.PI / 180;

  // ---------- small utilities ----------
  const rng = seed => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const shade = (hex, f) => { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f))); return '#' + c.getHexString(); };
  const canvas = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };

  // ---------- procedural textures (cached; one canvas each) ----------
  const TEX = {};
  function texOf(key, size, ftW, ftH, draw) {
    if (!TEX[key]) { const c = canvas(size); draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.userData = { ftW, ftH }; TEX[key] = t; }
    const t = TEX[key]; t.repeat.set(1 / t.userData.ftW, 1 / t.userData.ftH); return t;
  }
  const woodTex = col => texOf('wood' + col, 512, 4, 4, (g, n) => {
    const R = rng(hash(col)); g.fillStyle = col; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 140; i++) { const y = R() * n; g.strokeStyle = `rgba(${R() < 0.6 ? '60,35,15' : '255,240,220'},${0.03 + R() * 0.06})`; g.lineWidth = 0.6 + R() * 1.6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= n; x += 32) g.lineTo(x, y + Math.sin(x / (40 + R() * 60) + i) * (2 + R() * 4)); g.stroke(); }
    for (let i = 0; i < 6; i++) { const x = R() * n, y = R() * n; g.strokeStyle = 'rgba(60,35,15,.10)'; for (let r = 2; r < 14; r += 3) { g.beginPath(); g.ellipse(x, y, r * 2.6, r * 0.7, 0, 0, Math.PI * 2); g.stroke(); } }
  });
  const fabricTex = col => texOf('fab' + col, 256, 1.5, 1.5, (g, n) => {
    const R = rng(hash(col + 'f')); g.fillStyle = col; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.04})`; g.fillRect(0, y, n, 1); }
    for (let x = 0; x < n; x += 2) { g.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.04})`; g.fillRect(x, 0, 1, n); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},.05)`; g.fillRect(R() * n, R() * n, 2, 1); }
  });
  const marbleTex = col => texOf('mar' + col, 512, 4, 4, (g, n) => {
    const R = rng(hash(col + 'm')); g.fillStyle = col; g.fillRect(0, 0, n, n); const dark = shade(col, 0.55) === col ? '#777' : shade(col, col < '#888888' ? 1.8 : 0.62);
    for (let v = 0; v < 9; v++) { g.strokeStyle = dark; g.globalAlpha = 0.08 + R() * 0.22; g.lineWidth = 0.6 + R() * 2.2; g.beginPath(); let x = R() * n, y = 0; g.moveTo(x, y); while (y < n) { x += (R() - 0.45) * 40; y += 12 + R() * 24; g.lineTo(x, y); } g.stroke(); }
    g.globalAlpha = 1;
  });
  const terrazzoTex = col => texOf('ter' + col, 512, 3, 3, (g, n) => { const R = rng(9); g.fillStyle = col; g.fillRect(0, 0, n, n); const cs = ['#8B8F94', '#C9B79C', '#5E6266', '#E9E3D8', '#A35D3C']; for (let i = 0; i < 1600; i++) { g.fillStyle = cs[Math.floor(R() * cs.length)]; g.globalAlpha = 0.7; const s = 1 + R() * 5; g.beginPath(); g.ellipse(R() * n, R() * n, s, s * (0.5 + R() * 0.5), R() * 3, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; });
  function floorTex(fin) {
    const key = fin.floor; const fl = I.FLOORS[key] || I.FLOORS.porcelain; const [tl, tw] = fl.tile || [2, 2];
    if (fl.plank) return texOf('fl' + key, 512, tl, tw * 4, (g, n) => { const R = rng(4); const h = n / 4; for (let r = 0; r < 4; r++) { const off = (r % 2) * n / 2; for (let k = -1; k < 2; k++) { g.fillStyle = shade(fl.color, 0.88 + R() * 0.24); g.fillRect(off + k * n, r * h, n, h); g.strokeStyle = 'rgba(70,40,15,.12)'; for (let i = 0; i < 10; i++) { const y = r * h + R() * h; g.lineWidth = 0.5 + R(); g.beginPath(); g.moveTo(off + k * n, y); g.bezierCurveTo(off + k * n + n / 3, y + (R() - 0.5) * 6, off + k * n + 2 * n / 3, y + (R() - 0.5) * 6, off + k * n + n, y); g.stroke(); } g.fillStyle = 'rgba(50,30,10,.35)'; g.fillRect(off + k * n, r * h, 2, h); } g.fillStyle = 'rgba(50,30,10,.3)'; g.fillRect(0, r * h, n, 1.5); } });
    if (key === 'terrazzo') return terrazzoTex(fl.color);
    return texOf('fl' + key, 512, tl, tw, (g, n) => {
      const R = rng(hash(key)); g.fillStyle = fl.color; g.fillRect(0, 0, n, n);
      if (key === 'marble' || key === 'largeslab') { const veins = key === 'marble' ? 7 : 3; for (let v = 0; v < veins; v++) { g.strokeStyle = 'rgba(120,115,110,.35)'; g.globalAlpha = 0.25 + R() * 0.4; g.lineWidth = 0.5 + R() * 1.6; g.beginPath(); let x = R() * n, y = 0; g.moveTo(x, y); while (y < n) { x += (R() - 0.5) * 50; y += 18 + R() * 30; g.lineTo(x, y); } g.stroke(); } g.globalAlpha = 1; }
      else if (key === 'pavers') { for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.06})`; g.fillRect(R() * n, R() * n, 3, 3); } }
      else { for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.05})`; g.fillRect(R() * n, R() * n, 4, 4); } }
      g.strokeStyle = key === 'pavers' ? 'rgba(60,60,60,.55)' : 'rgba(110,105,100,.55)'; g.lineWidth = key === 'pavers' ? 6 : 3; g.strokeRect(0, 0, n, n);
    });
  }
  const wallTileTex = () => texOf('wtile', 256, 1, 2, (g, n) => { g.fillStyle = '#E9ECEF'; g.fillRect(0, 0, n, n); const R = rng(3); for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(160,165,170,.25)'; g.beginPath(); g.moveTo(R() * n, 0); g.lineTo(R() * n, n); g.stroke(); } g.strokeStyle = 'rgba(150,155,160,.8)'; g.lineWidth = 3; g.strokeRect(0, 0, n, n); });
  const subwayTex = () => texOf('subway', 256, 1, 0.5, (g, n) => { g.fillStyle = '#F3F1EC'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(150,150,150,.8)'; g.lineWidth = 4; g.strokeRect(0, 0, n, n / 2); g.beginPath(); g.moveTo(0, n / 2); g.lineTo(n, n / 2); g.moveTo(n / 2, n / 2); g.lineTo(n / 2, n); g.stroke(); });
  const paintTex = col => texOf('paint' + col, 256, 3, 3, (g, n) => { const R = rng(hash(col)); g.fillStyle = col; g.fillRect(0, 0, n, n); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},.025)`; g.fillRect(R() * n, R() * n, 2, 2); } });
  const rugTex = (T, kind) => texOf('rug' + kind + T.accent + T.light, 512, 1, 1, (g, n) => {
    const R = rng(hash(kind)); g.fillStyle = T.light; g.fillRect(0, 0, n, n);
    if (kind === 'prayer') { g.fillStyle = shade(T.accent, 0.8); g.fillRect(0, 0, n, n); g.fillStyle = T.light; g.fillRect(24, 24, n - 48, n - 48); g.fillStyle = shade(T.accent, 1.1); g.beginPath(); g.moveTo(60, n - 40); g.lineTo(60, 160); g.quadraticCurveTo(n / 2, 30, n - 60, 160); g.lineTo(n - 60, n - 40); g.closePath(); g.fill(); g.fillStyle = T.light; g.fillRect(90, n - 120, n - 180, 40); }
    else { g.fillStyle = T.accent; g.fillRect(0, 0, n, n); g.fillStyle = T.light; g.fillRect(18, 18, n - 36, n - 36); g.strokeStyle = T.accent; g.lineWidth = 3; g.strokeRect(34, 34, n - 68, n - 68); g.globalAlpha = 0.35; for (let i = 0; i < 9; i++) { g.strokeStyle = shade(T.accent, 0.8 + R() * 0.6); g.lineWidth = 6 + R() * 18; g.beginPath(); g.moveTo(R() * n, R() * n); g.bezierCurveTo(R() * n, R() * n, R() * n, R() * n, R() * n, R() * n); g.stroke(); } g.globalAlpha = 1; }
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},.05)`; g.fillRect(R() * n, R() * n, 1.5, 1.5); }
  });
  const artTex = (T, seed) => texOf('art' + seed + T.accent, 512, 1, 1, (g, n) => {
    const R = rng(seed * 7919 + 1); const pal = [T.accent, T.light, T.wood, shade(T.accent, 1.5), shade(T.wood, 0.6), '#E8C07A', '#2B3A4A'];
    g.fillStyle = pal[1]; g.fillRect(0, 0, n, n); const style = seed % 3;
    if (style === 0) for (let i = 0; i < 7; i++) { g.fillStyle = pal[Math.floor(R() * pal.length)]; g.globalAlpha = 0.75; g.beginPath(); g.arc(R() * n, R() * n, 30 + R() * 150, 0, Math.PI * 2); g.fill(); }
    else if (style === 1) { for (let i = 0; i < 5; i++) { g.fillStyle = pal[Math.floor(R() * pal.length)]; g.globalAlpha = 0.85; g.fillRect(R() * n * 0.7, R() * n * 0.7, 60 + R() * 220, 40 + R() * 220); } }
    else { g.globalAlpha = 1; for (let b = 0; b < 4; b++) { g.fillStyle = pal[(b + 2) % pal.length]; g.beginPath(); g.moveTo(0, n * (0.45 + b * 0.14)); for (let x = 0; x <= n; x += 16) g.lineTo(x, n * (0.45 + b * 0.14) - Math.sin(x / 70 + b * 2 + R()) * 30 - 40 * Math.exp(-((x - n * R()) ** 2) / 9000)); g.lineTo(n, n); g.lineTo(0, n); g.fill(); } g.fillStyle = '#F4D58D'; g.beginPath(); g.arc(n * 0.72, n * 0.22, 36, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  });
  const screenTex = () => texOf('screen', 256, 5.4, 3.1, (g, n) => { const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, '#0E1726'); gr.addColorStop(0.5, '#16233A'); gr.addColorStop(1, '#090C12'); g.fillStyle = gr; g.fillRect(0, 0, n, n); g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(n * 0.6, 0); g.lineTo(0, n * 0.8); g.fill(); });

  // ---------- materials ----------
  function kit(T, cache) {
    const M = cache || {};
    const std = (key, o) => M[key] || (M[key] = new THREE.MeshStandardMaterial(o));
    const C = c => new THREE.Color(c).convertSRGBToLinear();
    const withMap = (t, w, h) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(1 / (w || t.userData.ftW), 1 / (h || t.userData.ftH)); return c; };
    return {
      M, C,
      col: (c, o) => std('c' + c + JSON.stringify(o || {}), Object.assign({ color: C(c), roughness: 0.75, metalness: 0 }, o || {})),
      wood: std('wood' + T.wood, { map: woodTex(T.wood), roughness: 0.55 }),
      woodD: std('woodD' + T.wood, { map: woodTex(shade(T.wood, 0.62)), roughness: 0.5 }),
      woodL: std('woodL' + T.wood, { map: woodTex(shade(T.wood, 1.25)), roughness: 0.6 }),
      soft: std('soft' + T.soft, { map: fabricTex(T.soft), roughness: 0.95 }),
      softD: std('softD' + T.soft, { map: fabricTex(shade(T.soft, 0.82)), roughness: 0.95 }),
      lightF: std('lightF' + T.light, { map: fabricTex(T.light), roughness: 0.95 }),
      accent: std('acc' + T.accent, { map: fabricTex(T.accent), roughness: 0.9 }),
      linen: std('linen', { map: fabricTex('#F7F5F0'), roughness: 0.95 }),
      metal: std('metal' + T.metal, { color: C(T.metal), metalness: 0.75, roughness: 0.32 }),
      chrome: std('chrome', { color: C('#E6E9EC'), metalness: 1, roughness: 0.12 }),
      steel: std('steel', { color: C('#B9C0C6'), metalness: 0.85, roughness: 0.28 }),
      white: std('white', { color: C('#F5F5F3'), roughness: 0.4 }),
      ceramic: std('ceramic', { color: C('#FBFBFA'), roughness: 0.12, metalness: 0 }),
      lacquer: std('lacq' + T.light, { color: C(T.light), roughness: 0.3 }),
      dark: std('dark', { color: C('#1E2125'), roughness: 0.45 }),
      black: std('black', { color: C('#0D0F12'), roughness: 0.25, metalness: 0.2 }),
      stone: std('stone' + T.light, { map: marbleTex(T.light === '#ECE8E2' ? '#EDEAE6' : shade(T.light, 1.05)), roughness: 0.22 }),
      granite: std('granite', { map: marbleTex('#2C2F33'), roughness: 0.25 }),
      glass: std('glass', { color: C('#CFE6F2'), transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false }),
      mirror: std('mirror', { color: C('#E7ECEF'), metalness: 1, roughness: 0.03 }),
      screen: std('screen', { map: screenTex(), roughness: 0.15, metalness: 0.3, emissive: C('#0A1220'), emissiveIntensity: 0.4 }),
      glow: std('glow', { color: C('#FFF4DE'), emissive: C('#FFE2B0'), emissiveIntensity: 1.6, roughness: 0.6 }),
      glowSoft: std('glowSoft', { color: C('#FFF0D8'), emissive: C('#FFD9A0'), emissiveIntensity: 0.55, roughness: 0.9, side: THREE.DoubleSide }),
      leaf: std('leaf', { color: C('#4F7F3F'), roughness: 0.7, side: THREE.DoubleSide }),
      leaf2: std('leaf2', { color: C('#6E9C55'), roughness: 0.7, side: THREE.DoubleSide }),
      pot: std('pot', { color: C('#D8D2C8'), roughness: 0.55 }),
      terracotta: std('terra', { color: C('#B5704A'), roughness: 0.85 }),
      water: std('water', { color: C('#9FD3E6'), transparent: true, opacity: 0.5, roughness: 0.05 }),
      rubber: std('rubber', { color: C('#151618'), roughness: 0.9 }),
      paper: (c) => std('paper' + c, { color: C(c), roughness: 0.8 }),
      paint: (c) => std('paint' + c, { map: paintTex(c), roughness: 0.92 }),
      tile: () => std('wtile', { map: wallTileTex(), roughness: 0.25 }),
      subway: () => std('subway', { map: subwayTex(), roughness: 0.25 }),
      floor: fin => std('floor' + fin.floor, { map: floorTex(fin), roughness: { marble: 0.18, largeslab: 0.2, porcelain: 0.3, wood: 0.55, laminate: 0.6, terrazzo: 0.35, ceramic: 0.4, pavers: 0.9 }[fin.floor] || 0.4 }),
      rug: kind => std('rug' + kind + T.accent, { map: rugTex(T, kind), roughness: 1 }),
      art: seed => std('art' + seed + T.accent, { map: artTex(T, seed), roughness: 0.85 }),
      curtain: std('curt' + T.light, { map: fabricTex(T.light), roughness: 0.95, side: THREE.DoubleSide }),
      sheer: std('sheer', { color: C('#FFFFFF'), transparent: true, opacity: 0.42, roughness: 1, side: THREE.DoubleSide, depthWrite: false }),
      withMap
    };
  }

  // ---------- geometry with UVs in feet ----------
  const GEO = {};
  function boxGeo(w, h, d) {
    const key = `b${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`; if (GEO[key]) return GEO[key];
    const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
    return (GEO[key] = g);
  }
  function rboxGeo(w, h, d, r) {
    r = Math.max(0.005, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)); const key = `r${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}|${r.toFixed(2)}`; if (GEO[key]) return GEO[key];
    const sw = w - 2 * r, sh = h - 2 * r, cr = Math.min(r * 0.8, sw / 2 - 0.001, sh / 2 - 0.001); const s = new THREE.Shape(); const x0 = -sw / 2, y0 = -sh / 2;
    if (cr > 0.002) { s.moveTo(x0 + cr, y0); s.lineTo(x0 + sw - cr, y0); s.quadraticCurveTo(x0 + sw, y0, x0 + sw, y0 + cr); s.lineTo(x0 + sw, y0 + sh - cr); s.quadraticCurveTo(x0 + sw, y0 + sh, x0 + sw - cr, y0 + sh); s.lineTo(x0 + cr, y0 + sh); s.quadraticCurveTo(x0, y0 + sh, x0, y0 + sh - cr); s.lineTo(x0, y0 + cr); s.quadraticCurveTo(x0, y0, x0 + cr, y0); }
    else { s.moveTo(x0, y0); s.lineTo(x0 + sw, y0); s.lineTo(x0 + sw, y0 + sh); s.lineTo(x0, y0 + sh); s.lineTo(x0, y0); }
    const dep = Math.max(0.002, d - 2 * r);
    const g = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -dep / 2); g.computeVertexNormals();
    return (GEO[key] = g);
  }
  const cylGeo = (r1, r2, h, seg) => { const key = `c${r1.toFixed(3)}|${r2.toFixed(3)}|${h.toFixed(3)}|${seg}`; return GEO[key] || (GEO[key] = new THREE.CylinderGeometry(r1, r2, h, seg || 24)); };

  // builder bound to a group: every helper places by the BOTTOM of the shape
  function builder(grp) {
    const add = (geo, m, x, y, z, sh) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (sh !== false) { o.castShadow = true; o.receiveShadow = true; } grp.add(o); return o; };
    return {
      box: (w, h, d, x, y, z, m) => add(boxGeo(w, h, d), m, x, (y || 0) + h / 2, z),
      rb: (w, h, d, r, x, y, z, m) => add(rboxGeo(w, h, d, r), m, x, (y || 0) + h / 2, z),
      cyl: (r1, r2, h, x, y, z, m, seg) => add(cylGeo(r1, r2, h, seg), m, x, (y || 0) + h / 2, z),
      sph: (r, x, y, z, m, sx, sy, sz) => { const o = add(new THREE.SphereGeometry(r, 20, 14), m, x, y, z); o.scale.set(sx || 1, sy || 1, sz || 1); return o; },
      tor: (R, r, x, y, z, m, arc) => add(new THREE.TorusGeometry(R, r, 10, 28, arc || Math.PI * 2), m, x, y, z),
      mesh: (geo, m, x, y, z, sh) => add(geo, m, x, y, z, sh),
      grp
    };
  }

  // ---------- furniture models (origin: centre of footprint on the floor, front facing +z) ----------
  function model(it, T, K) {
    const g = new THREE.Group(); const B = builder(g); const { box, rb, cyl, sph, tor } = B;
    const s = I.F[it.k] || { h: 2 }; const k = it.k; const w = it.w, d = it.d; const y0 = it.y0 != null ? it.y0 : (s.y0 || 0); const back = -d / 2, front = d / 2;
    const seed = hash(it.id || k);
    const legs = (bw, bd, h, m, r, inset, round) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => round ? cyl(r * 0.5, r * 0.35, h, a * (bw / 2 - (inset || 0.2)), 0, b * (bd / 2 - (inset || 0.2)), m, 12) : box(r, h, r, a * (bw / 2 - (inset || 0.2)), 0, b * (bd / 2 - (inset || 0.2)), m));
    const handleV = (x, y, z, h) => box(0.05, h || 0.8, 0.06, x, y, z, K.metal);
    const handleH = (x, y, z, w2) => box(w2 || 0.6, 0.05, 0.06, x, y, z, K.metal);
    const books = (x, y, z, span, R) => { let p = x - span / 2; const cs = ['#7A2E2E', '#2F4F6F', '#C9A227', '#3E6B48', '#E8E2D6', '#5B4A7A', '#B5552F', '#1F2A36']; while (p < x + span / 2 - 0.12) { const bw = 0.08 + R() * 0.1, bh = 0.6 + R() * 0.35; box(bw, bh, 0.55 + R() * 0.15, p + bw / 2, y, z, K.paper(cs[Math.floor(R() * cs.length)])); p += bw + 0.01; } };
    const vase = (x, y, z, h) => { cyl(0.16, 0.22, h || 0.9, x, y, z, K.pot); for (let i = 0; i < 3; i++) { const st = cyl(0.008, 0.008, 1.1, x + (i - 1) * 0.06, y + (h || 0.9) - 0.1, z, K.leaf, 4); st.rotation.z = (i - 1) * 0.25; } };
    const lamp = (x, y, z, sc) => { sc = sc || 1; cyl(0.2 * sc, 0.24 * sc, 0.08, x, y, z, K.metal); cyl(0.03, 0.03, 1.1 * sc, x, y, z, K.metal, 8); cyl(0.32 * sc, 0.45 * sc, 0.62 * sc, x, y + 1.0 * sc, z, K.glowSoft, 28); };
    const plantBlob = (x, y, z, r, R) => { for (let i = 0; i < 9; i++) { const a = R() * Math.PI * 2, e = 0.3 + R() * 0.9; const lf = sph(r * (0.35 + R() * 0.25), x + Math.cos(a) * r * 0.45, y + e * r, z + Math.sin(a) * r * 0.45, i % 2 ? K.leaf : K.leaf2, 1, 0.45, 1.6); lf.rotation.set(R() - 0.5, a, 0.6 * (R() - 0.5)); } };
    const R = rng(seed);

    if (/^bed_/.test(k) && k !== 'bed_bunk') {
      const hb = s.hb || 3.5; const up = T.n !== 'Traditional' && T.n !== 'Classic';
      box(w - 0.5, 0.35, d - 0.8, 0, 0, 0.1, K.dark);                                                  // recessed plinth
      rb(w, 0.7, d - 0.25, 0.08, 0, 0.3, 0.12, up ? K.soft : K.wood);                                     // base
      if (k === 'bed_storage') [-1, 1].forEach(sg => box(0.02, 0.4, d * 0.7, sg * (w / 2 + 0.005), 0.42, 0.3, K.dark));
      if (up) { rb(w + 0.1, hb, 0.4, 0.12, 0, 0.3, back + 0.2, K.soft); const n = Math.max(3, Math.round(w / 0.75)); for (let i = 0; i < n; i++) rb(w / n - 0.05, hb - 1.6, 0.14, 0.06, -w / 2 + (i + 0.5) * w / n, 1.4, back + 0.43, K.softD); }
      else { box(w + 0.2, hb + 0.3, 0.3, 0, 0, back + 0.15, K.woodD); rb(w - 0.6, hb - 1.6, 0.12, 0.05, 0, 1.6, back + 0.33, K.wood); [-1, 1].forEach(sg => { cyl(0.16, 0.16, hb + 0.6, sg * (w / 2 + 0.05), 0, back + 0.15, K.woodD, 12); sph(0.2, sg * (w / 2 + 0.05), hb + 0.7, back + 0.15, K.woodD); }); }
      const mw = w - 0.3, md = d - 0.65; rb(mw, 0.75, md, 0.16, 0, 1.0, 0.2, K.linen);                     // mattress
      const dd = md * 0.66; rb(w - 0.12, 0.22, dd, 0.1, 0, 1.62, front - dd / 2 - 0.12, k === 'bed_single' ? K.accent : K.lightF); // duvet
      rb(w - 0.12, 0.3, 0.55, 0.14, 0, 1.62, front - dd - 0.05, K.linen);                                 // folded edge
      rb(w - 0.05, 0.07, 1.25, 0.03, 0, 1.84, front - 0.95, K.accent);                                     // throw
      const np = k === 'bed_single' ? 1 : 2; const pw = np === 1 ? mw - 0.6 : (mw - 0.5) / 2;
      for (let i = 0; i < np; i++) { const x = np === 1 ? 0 : (i ? 1 : -1) * (pw / 2 + 0.1); const p = rb(pw, 0.5, 1.05, 0.22, x, 1.72, back + 0.95, K.linen); p.rotation.x = -0.32; }
      for (let i = 0; i < (np === 1 ? 1 : 3); i++) { const x = np === 1 ? 0 : (i - 1) * 1.25; const c = rb(1.15, 1.0, 0.32, 0.14, x, 1.8, back + 1.6, i === 1 || np === 1 ? K.accent : K.softD); c.rotation.x = -0.28; }
    } else if (k === 'bed_bunk') {
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(0.25, 5.6, 0.25, a * (w / 2 - 0.125), 0, b * (d / 2 - 0.125), K.wood));
      [0.8, 4.0].forEach(y => { box(w, 0.3, d, 0, y, 0, K.wood); rb(w - 0.3, 0.55, d - 0.3, 0.12, 0, y + 0.3, 0, K.linen); rb(w - 0.25, 0.15, d * 0.62, 0.06, 0, y + 0.82, d * 0.17, K.accent); rb(w - 0.8, 0.4, 0.95, 0.18, 0, y + 0.85, back + 0.7, K.linen); });
      box(0.12, 0.8, d * 0.6, w / 2 - 0.06, 4.9, -d * 0.15, K.wood); box(0.12, 0.8, d * 0.6, -w / 2 + 0.06, 4.9, 0, K.wood);
      [w / 2 - 0.06].forEach(x => { for (let y = 1.5; y < 4.4; y += 0.9) box(0.1, 0.08, 1.3, x + 0.06, y, d / 2 - 0.9, K.wood); });
    } else if (k === 'daybed') {
      box(w, 1.0, d, 0, 0.3, 0, K.wood); legs(w, d, 0.3, K.woodD, 0.2); rb(w - 0.2, 0.5, d - 0.2, 0.15, 0, 1.3, 0, K.linen);
      box(0.25, 2.6, d, back + 0.125 + (w - d) / 2 * 0, 0, 0, K.wood).position.x = -w / 2 + 0.125; box(w, 1.4, 0.2, 0, 1.3, back + 0.1, K.wood);
      [-1, 1].forEach(sg => { const b2 = cyl(0.32, 0.32, w - 0.5, 0, 1.6, sg * (d / 2 - 0.5), K.accent, 16); b2.rotation.z = Math.PI / 2; });
    } else if (k === 'cradle') {
      box(w, 0.2, d, 0, 1.6, 0, K.white); rb(w - 0.2, 0.35, d - 0.2, 0.1, 0, 1.8, 0, K.linen);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(0.15, 3.2, 0.15, a * (w / 2 - 0.08), 0, b * (d / 2 - 0.08), K.white));
      for (let x = -w / 2 + 0.25; x < w / 2; x += 0.3) [back + 0.05, front - 0.05].forEach(z => box(0.05, 1.3, 0.05, x, 1.8, z, K.white));
      for (let z = back + 0.3; z < front; z += 0.3) [-w / 2 + 0.05, w / 2 - 0.05].forEach(x => box(0.05, 1.3, 0.05, x, 1.8, z, K.white));
    } else if (k === 'nightstand' || k === 'nightstand_float') {
      const yb = k === 'nightstand_float' ? y0 : 0.35; const h = k === 'nightstand_float' ? s.h : s.h - 0.35;
      if (k === 'nightstand') legs(w, d, 0.35, K.metal, 0.12, 0.15, true);
      rb(w, h, d, 0.04, 0, yb, 0, K.wood); box(w - 0.15, 0.02, 0.02, 0, yb + h * 0.5, front + 0.005, K.dark); handleH(0, yb + h * 0.72, front + 0.03, 0.45);
      lamp(-w * 0.18, yb + h, -0.05, 0.85); books(w * 0.22, yb + h, 0.1, 0.5, R);
    } else if (k === 'wardrobe' || k === 'wardrobe_slide') {
      const h = s.h; box(w, 0.3, d - 0.15, 0, 0, -0.08, K.dark); box(w, h - 0.3, d - 0.12, 0, 0.3, -0.06, K.woodL); box(w, 0.06, d, 0, h - 0.06, 0, K.woodD);
      if (k === 'wardrobe') { const n = Math.max(2, Math.round(w / 1.6)); const dw = w / n; for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * dw; rb(dw - 0.04, h - 0.42, 0.07, 0.015, x, 0.34, front - 0.04, K.wood); rb(dw - 0.34, h - 1.2, 0.03, 0.01, x, 0.73, front + 0.005, K.woodD).scale.set(1, 1, 0.5); handleV(x + (i % 2 ? -1 : 1) * (dw / 2 - 0.16), 3.0, front + 0.02, 1.2); } }
      else { const n = Math.max(2, Math.round(w / 3)); const pw = w / n + 0.08; for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * (w / n); const z = front - (i % 2 ? 0.16 : 0.05); const m = i === Math.floor(n / 2) ? K.mirror : K.wood; box(pw - 0.02, h - 0.5, 0.05, x, 0.35, z, m); [-1, 1].forEach(sg => box(0.05, h - 0.5, 0.07, x + sg * (pw / 2 - 0.03), 0.35, z, K.steel)); } box(w, 0.12, 0.25, 0, h - 0.2, front - 0.1, K.steel); }
    } else if (k === 'dresser' || k === 'dresser_wall') {
      const yb = k === 'dresser_wall' ? y0 : 0.4; const h = k === 'dresser_wall' ? s.h : s.h - 0.4;
      if (k === 'dresser') legs(w, d, 0.4, K.metal, 0.1, 0.15, true);
      rb(w, h, d, 0.04, 0, yb, 0, K.wood); const n = k === 'dresser' ? 3 : 2; for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; box(0.02, h - 0.1, 0.02, -w / 2 + (i + 1) * w / n, yb + 0.05, front + 0.005, K.dark); handleH(x, yb + h * 0.75, front + 0.03, 0.4); }
      const mh = k === 'dresser' ? 3 : 2.8, mw2 = Math.min(w * 0.75, 2.4); const fr = rb(mw2 + 0.2, mh + 0.2, 0.1, 0.05, 0, yb + h + 0.3, back + 0.06, K.woodD); void fr; box(mw2, mh, 0.02, 0, yb + h + 0.4, back + 0.12, K.mirror);
      vase(w * 0.32, yb + h, 0, 0.6); [0, 1, 2].forEach(i => cyl(0.07, 0.07, 0.35 + i * 0.08, -w * 0.3 + i * 0.18, yb + h, 0.1, K.paper(['#C9A227', '#E8E2D6', '#7A2E2E'][i]), 12));
    } else if (k === 'chest') {
      box(w - 0.2, 0.3, d - 0.2, 0, 0, 0, K.dark); rb(w, s.h - 0.3, d, 0.04, 0, 0.3, 0, K.wood); const n = 4; for (let i = 0; i < n; i++) { const y = 0.3 + (i + 0.5) * (s.h - 0.3) / n; box(w - 0.1, 0.02, 0.02, 0, 0.3 + (i + 1) * (s.h - 0.3) / n - 0.01, front + 0.005, K.dark); handleH(0, y, front + 0.03, 0.7); }
      lamp(w * 0.28, s.h, 0, 0.8); vase(-w * 0.25, s.h, 0, 0.7);
    } else if (k === 'bench' || k === 'ottoman') {
      legs(w, d, 0.5, K.metal, 0.1, 0.12, true); rb(w, s.h - 0.5, d, 0.18, 0, 0.5, 0, k === 'ottoman' ? K.accent : K.soft);
      if (k === 'bench') { const n = Math.max(2, Math.round(w / 1.2)); for (let i = 1; i < n; i++) sph(0.04, -w / 2 + i * w / n, s.h + 0.01, 0, K.softD); }
    } else if (/^sofa|^armchair$|^recliner$/.test(k)) {
      const L = k === 'sofaL'; const a = s.lshape || 3.1; const seats = k === 'sofa3' ? 3 : k === 'sofa2' ? 2 : 1; const armW = k === 'recliner' ? 0.75 : 0.55, baseH = 0.75, yb = 0.35, sh = 0.42;
      const legM = T.n === 'Classic' || T.n === 'Traditional' ? K.woodD : K.metal;
      const dz = L ? a : d;
      legs(L ? w : w, dz, yb, legM, 0.12, 0.25, true); if (L) [[w / 2 - 0.25, front - 0.25], [w / 2 - a + 0.25, front - 0.25]].forEach(([x, z]) => cyl(0.06, 0.04, yb, x, 0, z, legM, 10));
      rb(w, baseH, dz, 0.12, 0, yb, back + dz / 2, K.soft); if (L) rb(a, baseH, d - a + 0.1, 0.12, w / 2 - a / 2, yb, back + a + (d - a) / 2 - 0.05, K.soft);
      rb(w, 2.45, 0.65, 0.2, 0, yb, back + 0.33, K.soft);                                                     // back frame
      rb(armW, 1.6, dz, 0.22, -w / 2 + armW / 2, yb, back + dz / 2, K.soft); if (!L) rb(armW, 1.6, d, 0.22, w / 2 - armW / 2, yb, 0, K.soft); else rb(armW, 1.25, d, 0.22, w / 2 - armW / 2, yb, 0, K.soft);
      const x0 = -w / 2 + armW, x1 = w / 2 - armW; const n = L ? 3 : seats; const cw = (L ? (x1 - a + armW - x0) : (x1 - x0)) / n;
      for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * cw; rb(cw - 0.05, sh, dz - 0.75, 0.16, x, yb + baseH, back + 0.7 + (dz - 0.75) / 2, K.soft); const bc = rb(cw - 0.08, 1.35, 0.55, 0.24, x, yb + baseH + sh - 0.05, back + 0.88, K.softD); bc.rotation.x = -0.16; }
      if (L) { rb(a - armW - 0.05, sh, d - 0.7, 0.16, w / 2 - armW - (a - armW) / 2, yb + baseH, back + 0.7 + (d - 0.7) / 2, K.soft); const bc = rb(a - armW - 0.08, 1.35, 0.55, 0.24, w / 2 - armW - (a - armW) / 2, yb + baseH + sh - 0.05, back + 0.88, K.softD); bc.rotation.x = -0.16; }
      if (k === 'recliner') box(w - 2 * armW - 0.1, 0.06, 0.06, 0, yb + 0.4, front + 0.02, K.softD);
      if (seats > 1 || L) { [[-1, K.accent], [1, K.lightF]].forEach(([sg, m], i) => { const c = rb(1.25, 1.2, 0.34, 0.16, sg * ((L ? x1 - a : x1) - 0.75) + (L && sg > 0 ? 0 : 0), yb + baseH + sh, back + 1.2, m); c.rotation.set(-0.3, sg * 0.25 * (i ? 1 : 1), sg * 0.08); }); }
      else { const c = rb(1.15, 1.1, 0.32, 0.15, 0, yb + baseH + sh, back + 1.2, K.accent); c.rotation.x = -0.3; }
    } else if (k === 'floorseat') {
      rb(w, 0.45, d - 0.2, 0.12, 0, 0, 0.1, K.accent); rb(w - 0.1, 0.25, d - 0.35, 0.1, 0, 0.45, 0.15, K.lightF);
      const bl = cyl(0.42, 0.42, w - 0.4, 0, 0.72, back + 0.45, K.soft, 18); bl.rotation.z = Math.PI / 2; bl.position.y = 1.1;
      for (let i = 0; i < Math.round(w / 2); i++) { const c = rb(1.2, 1.2, 0.35, 0.16, -w / 2 + 1 + i * 2, 0.75, back + 0.95, i % 2 ? K.lightF : K.softD); c.rotation.x = -0.25; }
    } else if (k === 'coffee' || k === 'coffee_round') {
      const h = s.h; if (k === 'coffee') { rb(w, 0.12, d, 0.05, 0, h - 0.12, 0, K.stone); box(w - 0.5, 0.06, d - 0.5, 0, 0.4, 0, K.woodD); legs(w, d, h - 0.12, K.metal, 0.08, 0.25); }
      else { cyl(w / 2, w / 2, 0.12, 0, h - 0.12, 0, K.stone, 40); cyl(w * 0.28, w * 0.34, h - 0.12, 0, 0, 0, K.woodD, 32); }
      const tray = cyl(0.55, 0.55, 0.06, 0.6, h, -0.1, K.metal, 28); void tray; vase(0.6, h + 0.06, -0.1, 0.5); box(0.9, 0.12, 0.65, -0.6, h, 0.15, K.paper('#E8E2D6')); box(0.75, 0.1, 0.55, -0.6, h + 0.12, 0.15, K.paper('#2F4F6F'));
    } else if (k === 'sidetable') { cyl(w / 2 * 0.85, w / 2 * 0.85, 0.08, 0, s.h - 0.08, 0, K.stone, 32); cyl(0.07, 0.07, s.h - 0.1, 0, 0.05, 0, K.metal, 10); cyl(0.4, 0.45, 0.05, 0, 0, 0, K.metal, 24); lamp(0, s.h, 0, 0.7); }
    else if (k === 'tvunit') {
      rb(w, 1.05, d, 0.03, 0, 0.45, 0, K.wood); box(w - 0.3, 0.02, 0.02, 0, 0.98, front + 0.005, K.dark); for (let i = 1; i < 3; i++) box(0.02, 1, 0.02, -w / 2 + i * w / 3, 0.47, front + 0.005, K.dark);
      box(w * 0.94, 0.06, d * 0.6, 0, 0.38, 0, K.dark).visible = true;
      const tw = Math.min(w - 1.2, 4.7); rb(tw, 2.7, 0.08, 0.02, 0, 2.5, back + 0.08, K.black); box(tw - 0.08, 2.62, 0.01, 0, 2.54, back + 0.125, K.screen); box(2.6, 0.22, 0.3, 0, 1.5, 0.1, K.dark);
      vase(-w / 2 + 0.6, 1.5, 0, 0.8); books(w / 2 - 0.9, 1.5, 0, 0.9, R);
    } else if (k === 'tvwall') {
      const pw = w, ph = 7.3; box(pw, ph, 0.06, 0, 0.25, back + 0.03, K.woodD); const fl = Math.max(8, Math.round(pw / 0.24)); for (let i = 0; i < fl; i++) { const x = -pw / 2 + (i + 0.5) * pw / fl; cyl(0.085, 0.085, ph - 0.1, x, 0.3, back + 0.08, K.wood, 8).scale.z = 0.6; }
      box(pw, 0.05, 0.05, 0, ph + 0.2, back + 0.12, K.glow); // LED wash on top
      rb(pw * 0.9, 1.0, d - 0.15, 0.03, 0, y0, back + 0.15 + (d - 0.15) / 2, K.lacquer); box(pw * 0.86, 0.04, 0.05, 0, y0 - 0.05, back + 0.2 + (d - 0.15) / 2, K.glow);
      const tw = Math.min(pw - 1.6, 5.4); rb(tw, 3.1, 0.08, 0.02, 0, 3.05, back + 0.2, K.black); box(tw - 0.08, 3.02, 0.01, 0, 3.09, back + 0.245, K.screen); box(2.8, 0.22, 0.3, 0, y0 + 1.0, back + 0.4, K.dark);
      vase(-pw * 0.35, y0 + 1.0, back + 0.5, 0.9); books(pw * 0.33, y0 + 1.0, back + 0.55, 0.9, R);
    } else if (k === 'console') {
      rb(w, 0.12, d, 0.04, 0, s.h - 0.12, 0, K.wood); box(w - 0.3, 0.05, d - 0.3, 0, 0.5, 0, K.woodD); legs(w, d, s.h - 0.12, K.metal, 0.08, 0.15);
      lamp(w / 2 - 0.6, s.h, 0, 0.9); vase(-w / 2 + 0.6, s.h, 0, 0.9); books(0, s.h, 0, 0.7, R); [0, 1].forEach(i => cyl(0.35, 0.3, 0.3, -0.6 + i * 1.2, 0.55, 0, K.paper(['#C9B79C', '#8E7559'][i]), 18));
    } else if (k === 'sideboard' || k === 'shoe') {
      const hb2 = k === 'shoe' ? 0.25 : 0.55; legs(w, d, hb2, K.metal, 0.1, 0.18, true); rb(w, s.h - hb2, d, 0.04, 0, hb2, 0, K.wood); const n = Math.max(2, Math.round(w / 1.3));
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; if (k === 'sideboard') for (let f = -2; f <= 2; f++) cyl(0.04, 0.04, s.h - hb2 - 0.2, x + f * (w / n) / 6, hb2 + 0.1, front + 0.01, K.woodL, 8).scale.z = 0.5; else box(w / n - 0.06, 0.02, 0.02, x, hb2 + (s.h - hb2) / 2, front + 0.005, K.dark); if (i) box(0.02, s.h - hb2 - 0.1, 0.02, -w / 2 + i * w / n, hb2 + 0.05, front + 0.03, K.dark); }
      vase(-w * 0.3, s.h, 0, 0.9); cyl(0.5, 0.35, 0.25, w * 0.2, s.h, 0, K.pot, 28); if (k === 'sideboard') lamp(w * 0.38, s.h, -0.1, 1);
    } else if (k === 'crockery') {
      box(w, 0.3, d - 0.1, 0, 0, -0.05, K.dark); rb(w, 2.6, d, 0.03, 0, 0.3, 0, K.wood); box(w, 3.8, d - 0.3, 0, 2.9, -0.15, K.woodD);
      for (let y = 3.6; y < 6.6; y += 1.0) { box(w - 0.2, 0.04, d - 0.45, 0, y, -0.15, K.glass); for (let x = -w / 2 + 0.4; x < w / 2 - 0.2; x += 0.55) { const p = cyl(0.22, 0.22, 0.03, x, y + 0.25, back + 0.2, K.ceramic, 24); p.rotation.x = Math.PI / 2 - 0.15; } }
      [-1, 1].forEach(sg => box(w / 2 - 0.04, 3.7, 0.04, sg * w / 4, 2.95, front - 0.18, K.glass)); box(w, 0.05, 0.05, 0, 6.6, front - 0.2, K.glow);
      for (let i = 0; i < 2; i++) handleV(sg2(i) * 0.15, 4.4, front - 0.14, 0.9); for (let i = 0; i < Math.max(2, Math.round(w / 1.3)); i++) handleH(-w / 2 + (i + 0.5) * w / Math.max(2, Math.round(w / 1.3)), 2.6, front + 0.03, 0.45);
    } else if (k === 'prayer' || k === 'rug') {
      const m = K.rug(k); const o = B.box(w, 0.04, d, 0, 0.005, 0, m); o.castShadow = false; m.map.repeat.set(1 / w, 1 / d);
    } else if (k === 'plant' || k === 'planter') {
      const ph = k === 'planter' ? 1.3 : 1.25; if (k === 'planter') rb(w * 0.9, ph, w * 0.9, 0.06, 0, 0, 0, K.terracotta); else cyl(w / 2 - 0.15, w / 2 - 0.35, ph, 0, 0, 0, K.pot, 28);
      cyl(w / 2 - 0.2, w / 2 - 0.2, 0.04, 0, ph - 0.08, 0, K.dark, 20);
      const stems = 5; for (let i = 0; i < stems; i++) { const st = cyl(0.025, 0.035, s.h - ph - 0.6, 0, ph - 0.1, 0, K.woodD, 6); st.rotation.set((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5); }
      plantBlob(0, ph + (s.h - ph) * 0.35, 0, Math.min(1.1, w * 0.62), R); plantBlob(0, ph + (s.h - ph) * 0.62, 0, Math.min(0.9, w * 0.5), R);
    } else if (k === 'floorlamp') {
      cyl(0.5, 0.55, 0.08, 0, 0, 0, K.metal, 28); cyl(0.04, 0.04, s.h - 0.9, 0, 0.08, 0, K.metal, 8); cyl(0.5, 0.65, 0.85, 0, s.h - 0.9, 0, K.glowSoft, 32);
    } else if (k === 'art') {
      rb(w, s.h, 0.12, 0.02, 0, y0, back + 0.06, K.woodD); const c = box(w - 0.3, s.h - 0.3, 0.02, 0, y0 + 0.15, back + 0.125, K.art(seed % 9)); c.material = K.art(seed % 9); const mm = c.material.map; mm.repeat.set(1 / (w - 0.3), 1 / (s.h - 0.3)); mm.offset.set(0, 0);
    } else if (k === 'mirror' || k === 'mirror_full') {
      rb(w, s.h, 0.1, 0.05, 0, y0, back + 0.05, K.woodD); box(w - 0.2, s.h - 0.2, 0.02, 0, y0 + 0.1, back + 0.11, K.mirror);
    } else if (k === 'ac') {
      rb(w, s.h, d, 0.16, 0, y0, 0, K.white); box(w - 0.4, 0.08, 0.04, 0, y0 + 0.12, front - 0.02, K.dark); box(0.12, 0.05, 0.02, w / 2 - 0.4, y0 + 0.55, front + 0.005, K.col('#7FD3FF', { emissive: new THREE.Color('#2FA8FF'), emissiveIntensity: 1 }));
    } else if (/^dining|^round4$/.test(k)) {
      const h = s.h; if (k === 'round4') { cyl(w / 2, w / 2, 0.14, 0, h - 0.14, 0, K.wood, 40); cyl(0.3, 0.5, h - 0.14, 0, 0, 0, K.woodD, 24); cyl(0.9, 0.95, 0.1, 0, 0, 0, K.woodD, 28); }
      else { rb(w, 0.14, d, 0.05, 0, h - 0.14, 0, T.n === 'Modern' || T.n === 'Minimal' ? K.stone : K.wood); legs(w, d, h - 0.14, T.n === 'Modern' ? K.metal : K.woodD, 0.22, 0.45); box(w - 0.9, 0.12, d - 0.9, 0, h - 0.3, 0, K.woodD); }
      cyl(0.6, 0.45, 0.25, 0, h, 0, K.pot, 28); plantBlob(0, h + 0.25, 0, 0.45, R);
      if (k !== 'round4') { const n = Math.max(2, Math.round(w / 2)); for (let i = 0; i < n; i++) { cyl(0.38, 0.38, 0.02, -w / 2 + (i + 0.5) * w / n, h, d / 2 - 0.55, K.ceramic, 24); cyl(0.38, 0.38, 0.02, -w / 2 + (i + 0.5) * w / n, h, -d / 2 + 0.55, K.ceramic, 24); } }
    } else if (k === 'chair') {
      legs(w - 0.2, d - 0.3, 1.45, T.n === 'Modern' ? K.metal : K.woodD, 0.1, 0.12, true); rb(w - 0.1, 0.25, d - 0.35, 0.08, 0, 1.45, 0.1, K.soft); const bk = rb(w - 0.15, 1.65, 0.22, 0.09, 0, 1.6, back + 0.2, K.soft); bk.rotation.x = -0.1;
    } else if (k === 'barstool') { cyl(0.55, 0.5, 0.18, 0, s.h - 0.18, 0, K.soft, 24); cyl(0.06, 0.06, s.h - 0.2, 0, 0, 0, K.metal, 10); cyl(0.5, 0.55, 0.05, 0, 0, 0, K.metal, 24); const rr = tor(0.42, 0.03, 0, 0.9, 0, K.metal); rr.rotation.x = Math.PI / 2; }
    else if (k === 'officechair') {
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const arm = box(0.9, 0.08, 0.12, Math.cos(a) * 0.45, 0.15, Math.sin(a) * 0.45, K.dark); arm.rotation.y = -a; sph(0.08, Math.cos(a) * 0.88, 0.08, Math.sin(a) * 0.88, K.dark); }
      cyl(0.08, 0.08, 1.2, 0, 0.2, 0, K.metal, 10); rb(1.75, 0.3, 1.7, 0.12, 0, 1.4, 0.1, K.dark); const bk = rb(1.6, 2.0, 0.15, 0.12, 0, 1.85, back + 0.35, K.col('#2A2D31', { roughness: 0.95 })); bk.rotation.x = -0.12; [-1, 1].forEach(sg => box(0.12, 0.6, 1, sg * 0.85, 1.6, 0.1, K.dark));
    } else if (k === 'desk' || k === 'kidsdesk') {
      rb(w, 0.12, d, 0.04, 0, s.h - 0.12, 0, k === 'kidsdesk' ? K.white : K.wood); box(1.4, s.h - 0.12, d - 0.1, w / 2 - 0.75, 0, 0, K.woodL); [-1].forEach(sg => box(0.12, s.h - 0.12, d - 0.2, sg * (w / 2 - 0.15), 0, 0, K.metal)); for (let i = 0; i < 3; i++) { box(1.3, 0.02, 0.02, w / 2 - 0.75, 0.6 + i * 0.65, front + 0.005, K.dark); handleH(w / 2 - 0.75, 0.85 + i * 0.65, front + 0.03, 0.4); }
      const lap = box(1.15, 0.05, 0.8, -0.3, s.h, 0.1, K.steel); void lap; const scr = box(1.15, 0.75, 0.04, -0.3, s.h + 0.04, -0.3, K.black); scr.rotation.x = -0.25; lamp(-w / 2 + 0.45, s.h, back + 0.4, 0.75); books(w / 2 - 0.8, s.h, back + 0.4, 0.8, R);
      if (k === 'kidsdesk') { box(w, 1.8, 0.8, 0, s.h + 1.6, back + 0.4, K.white); books(0, s.h + 1.68, back + 0.45, w - 0.4, R); }
    } else if (k === 'bookshelf' || k === 'shelf') {
      const m = k === 'shelf' ? K.steel : K.wood; const h = s.h; box(0.1, h, d, -w / 2 + 0.05, 0, 0, m); box(0.1, h, d, w / 2 - 0.05, 0, 0, m); if (k === 'bookshelf') box(w, h, 0.05, 0, 0, back + 0.025, K.woodD);
      for (let y = 0.15, i = 0; y < h; y += 1.3, i++) { box(w, 0.08, d, 0, y, 0, m); if (y + 1.3 < h) { if (k === 'bookshelf') { if (i % 3 === 1) { vase(-w * 0.25, y + 0.08, 0, 0.6); books(w * 0.15, y + 0.08, 0, w * 0.5, R); } else books(0, y + 0.08, 0.05, w - 0.35, R); } else for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 1.1) rb(0.95, 0.75, d - 0.2, 0.05, x, y + 0.08, 0, K.paper(['#C9B79C', '#E8E2D6', '#8E99A4'][Math.floor(R() * 3)])); } }
    } else if (k === 'toybox') { rb(w, s.h, d, 0.08, 0, 0, 0, K.col(T.accent, { roughness: 0.6 })); box(w + 0.06, 0.12, d + 0.06, 0, s.h - 0.05, 0, K.white); sph(0.35, -w * 0.25, s.h + 0.3, 0, K.col('#E8B04A')); sph(0.25, w * 0.2, s.h + 0.25, 0.1, K.col('#D9534F')); }
    else if (k === 'counter' || k === 'utsink' || k === 'bbq' || k === 'island') {
      const wallCab = k === 'counter'; const ch = 2.75; const fronts = T.n === 'Minimal' ? K.lacquer : K.wood; const upper = T.n === 'Minimal' ? K.white : K.lacquer;
      box(w - 0.05, 0.35, d - 0.25, 0, 0, -0.1, K.dark); box(w, ch - 0.35 - 0.12, d - 0.06, 0, 0.35, -0.03, K.white);
      const n = Math.max(1, Math.round(w / 1.75)); const sinkX = -w / 2 + 1.3, hobX = w / 2 - 1.4;
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; const isHob = it.hob && Math.abs(x - hobX) < w / n / 2; rb(w / n - 0.04, ch - 0.35 - 0.16, 0.06, 0.012, x, 0.38, front - 0.03, fronts); if (isHob) { box(w / n - 0.12, 0.02, 0.02, x, 1.45, front + 0.005, K.dark); box(w / n - 0.12, 0.02, 0.02, x, 2.0, front + 0.005, K.dark); } box(w / n - 0.3, 0.04, 0.05, x, ch - 0.25, front + 0.01, K.steel); }
      const top = k === 'island' ? K.stone : (T.n === 'Modern' || T.n === 'Minimal' ? K.granite : K.stone); box(w + (k === 'island' ? 0.4 : 0.02), 0.12, d + (k === 'island' ? 0.6 : 0.05), 0, ch - 0.12, k === 'island' ? 0.3 : 0.02, top);
      if (k === 'island') { box(0.12, ch - 0.12, d + 0.6, -w / 2 - 0.14, 0, 0.3, K.stone); box(0.12, ch - 0.12, d + 0.6, w / 2 + 0.14, 0, 0.3, K.stone); }
      if (wallCab) { const bs = box(w, 1.72, 0.03, 0, ch, back + 0.015, K.subway()); bs.material = K.subway(); const wc = 1.15; for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; if (it.hob && Math.abs(x - hobX) < w / n / 2) continue; box(w / n, 2.3, wc - 0.06, x, 4.55, back + (wc - 0.06) / 2, K.white); rb(w / n - 0.04, 2.25, 0.06, 0.012, x, 4.575, back + wc - 0.03, upper); box(w / n - 0.3, 0.04, 0.05, x, 4.65, back + wc + 0.01, K.steel); box(w / n - 0.1, 0.03, 0.12, x, 4.52, back + wc - 0.3, K.glow); } }
      if (it.sink || k === 'utsink') { const sx = k === 'utsink' ? 0 : sinkX; box(1.75, 0.03, 1.25, sx, ch, 0.05, K.steel); box(1.55, 0.02, 1.05, sx, ch - 0.01, 0.05, K.dark); cyl(0.05, 0.06, 0.9, sx, ch, back + 0.35, K.chrome, 12); const sp = tor(0.3, 0.035, sx, ch + 0.9, back + 0.65, K.chrome, Math.PI); sp.rotation.y = Math.PI / 2; }
      if (it.hob || k === 'bbq') { const hx = k === 'bbq' ? 0 : hobX; box(1.95, 0.03, 1.6, hx, ch, 0.05, K.black); [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.4], [0.45, 0.4]].forEach(([a, b]) => { const r = tor(0.2, 0.025, hx + a, ch + 0.04, 0.05 + b, K.steel); r.rotation.x = Math.PI / 2; });
        if (wallCab) { box(2.4, 0.3, 1.6, hx, 5.4, back + 0.8, K.steel); const sl = box(2.4, 0.05, 1.5, hx, 5.4, back + 0.95, K.glass); sl.rotation.x = 0.35; box(0.95, WALL_H - 5.7, 0.85, hx, 5.7, back + 0.43, K.steel); } }
      if (k === 'counter' && !it.sink && !it.hob) { box(1.2, 0.8, 0.9, w / 2 - 1, ch, back + 0.6, K.steel); box(0.6, 0.55, 0.02, w / 2 - 1.15, ch + 0.12, back + 1.06, K.black); }
    } else if (k === 'fridge' || k === 'fridge2') {
      rb(w, s.h, d, 0.08, 0, 0, 0, K.steel); box(0.02, s.h - 0.1, 0.02, k === 'fridge2' ? 0 : w * 0.2, 0.05, front + 0.005, K.dark); if (k === 'fridge') box(w, 0.02, 0.02, 0, 4.2, front + 0.005, K.dark); else box(w, 0.02, 0.02, 0, 1.7, front + 0.005, K.dark);
      if (k === 'fridge') { handleV(w * 0.2 - 0.12, 2.4, front + 0.04, 1.4); handleV(w * 0.2 - 0.12, 4.6, front + 0.04, 0.9); } else { handleV(-0.12, 2.8, front + 0.04, 1.6); handleV(0.12, 2.8, front + 0.04, 1.6); handleH(0, 1.4, front + 0.04, 1.6); }
      box(0.4, 0.55, 0.02, -w * 0.25, 3.6, front + 0.01, K.black);
    } else if (k === 'ovencol') {
      box(w, s.h, d, 0, 0, 0, K.wood); box(w - 0.2, 1.6, 0.03, 0, 2.0, front, K.black); handleH(0, 3.45, front + 0.04, w - 0.6); box(w - 0.2, 1.1, 0.03, 0, 4.0, front, K.black); box(0.4, 0.15, 0.02, w / 2 - 0.4, 4.9, front + 0.02, K.col('#7FD3FF', { emissive: new THREE.Color('#2FA8FF'), emissiveIntensity: 0.6 }));
      handleV(w / 2 - 0.2, 0.9, front + 0.03, 0.8); handleV(w / 2 - 0.2, 5.6, front + 0.03, 0.8);
    } else if (k === 'dispenser') { rb(w, 3.0, d, 0.06, 0, 0, 0, K.white); cyl(0.42, 0.42, 1.3, 0, 3.0, 0, K.water, 24); box(0.5, 0.2, 0.1, 0, 2.1, front, K.dark); }
    else if (k === 'wc' || k === 'wc_wall') {
      const wall = k === 'wc_wall'; const by = wall ? 0.8 : 0;
      if (!wall) { cyl(0.42, 0.55, 0.95, 0, 0, 0.15, K.ceramic, 28).scale.z = 1.35; rb(1.45, 1.4, 0.55, 0.12, 0, 1.2, back + 0.3, K.ceramic); box(0.4, 0.06, 0.15, 0.3, 2.6, back + 0.3, K.chrome); }
      else { box(1.4, 3.8, 0.35, 0, 0, back + 0.17, K.tile()); box(0.6, 0.4, 0.03, 0, 3.3, back + 0.36, K.chrome); const b2 = cyl(0.55, 0.42, 0.65, 0, by, 0.05, K.ceramic, 28); b2.scale.z = 1.4; }
      const seat = rb(1.25, 0.12, 1.6, 0.25, 0, (wall ? by : 0) + (wall ? 0.65 : 0.95), 0.08, K.ceramic); void seat; const lid = rb(1.2, 1.4, 0.1, 0.2, 0, (wall ? by + 0.77 : 1.07), back + (wall ? 0.45 : 0.65), K.ceramic); lid.rotation.x = -0.12;
      const hose = cyl(0.03, 0.03, 0.6, w / 2 + 0.1, 1.8, back + 0.1, K.chrome, 8); void hose;
    } else if (/^basin/.test(k)) {
      const two = k === 'basin2', wallB = k === 'basin_wall';
      if (wallB) { rb(w - 0.1, 0.55, d - 0.1, 0.18, 0, 2.3, 0.02, K.ceramic); cyl(0.42, 0.35, 0.2, 0, 2.72, 0.1, K.dark, 24); cyl(0.2, 0.25, 1.5, 0, 0.8, back + 0.3, K.ceramic, 18); }
      else { rb(w, 1.6, d, 0.03, 0, 1.15, 0, K.wood); box(w - 0.1, 0.02, 0.02, 0, 1.95, front + 0.005, K.dark); box(w + 0.05, 0.1, d + 0.05, 0, 2.75, 0.02, K.stone); (two ? [-w / 4, w / 4] : [0]).forEach(x => { const b2 = sph(0.62, x, 2.86, 0.1, K.ceramic, 1, 0.38, 0.75); void b2; cyl(0.4, 0.4, 0.02, x, 3.08, 0.1, K.dark, 24).scale.z = 0.7; }); }
      (two ? [-w / 4, w / 4] : [0]).forEach(x => { cyl(0.05, 0.06, 0.65, x, wallB ? 2.85 : 2.85, back + 0.25, K.chrome, 12); const sp = box(0.06, 0.06, 0.45, x, wallB ? 3.45 : 3.45, back + 0.45, K.chrome); void sp; });
      const mw2 = Math.min(w - 0.2, two ? 3.8 : 2.0), mh = 2.3; if (wallB) { const m = cyl(0.85, 0.85, 0.05, 0, 4.4, back + 0.05, K.mirror, 40); m.rotation.x = Math.PI / 2; const fr = tor(0.86, 0.04, 0, 4.4, back + 0.06, K.metal); void fr; }
      else { box(mw2 + 0.1, mh + 0.1, 0.45, 0, 3.55, back + 0.22, K.white); box(mw2, mh, 0.02, 0, 3.6, back + 0.46, K.mirror); box(mw2, 0.04, 0.12, 0, 3.53, back + 0.35, K.glow); }
    } else if (k === 'showerzone' || k === 'shower') {
      const tray = k === 'shower'; if (tray) box(w, 0.2, d, 0, 0, 0, K.ceramic); else box(w - 0.05, 0.01, d - 0.05, 0, 0.005, 0, K.col('#C9D1D6', { roughness: 0.35 }));
      box(Math.min(2.2, w - 0.6), 0.02, 0.18, 0, 0.01, back + 0.4, K.steel);
      if (tray) { box(0.04, 6.6, d, w / 2 - 0.02, 0.2, 0, K.glass); box(w, 6.6, 0.04, 0, 0.2, front - 0.02, K.glass); box(0.05, 6.6, 0.06, w / 2 - 0.02, 0.2, front - 0.02, K.chrome); }
      else box(0.04, 6.4, d * 0.55, w / 2 - 0.02, 0.05, back + d * 0.275, K.glass);
      cyl(0.02, 0.02, 1.1, 0, 7.0, back + 0.05, K.chrome, 8).rotation.x = Math.PI / 2; cyl(0.45, 0.45, 0.05, 0, 6.95, back + 0.6, K.chrome, 32); rb(0.5, 0.7, 0.06, 0.05, 0, 3.6, back + 0.03, K.chrome); cyl(0.07, 0.07, 0.12, 0, 3.9, back + 0.1, K.chrome, 12).rotation.x = Math.PI / 2;
      const nm = cyl(0.03, 0.03, 2.6, -0.8, 3.0, back + 0.05, K.chrome, 8); void nm;
    } else if (k === 'bathtub') {
      const t2 = 0.25; rb(w, 1.75, d, 0.15, 0, 0, 0, K.ceramic); box(w - 2 * t2 - 0.1, 0.02, d - 2 * t2 - 0.1, 0, 1.45, 0, K.water); box(w - 2 * t2, 1.0, d - 2 * t2, 0, 0.55, 0, K.col('#E9EEF0', { roughness: 0.2 }));
      cyl(0.05, 0.05, 0.6, -w / 2 + 0.6, 1.75, back + 0.15, K.chrome, 12); const sp = tor(0.25, 0.04, -w / 2 + 0.6, 2.35, back + 0.4, K.chrome, Math.PI); sp.rotation.y = Math.PI / 2;
    } else if (k === 'geyser') { const c = cyl(s.h / 2 * 0.9 > d ? d * 0.9 : s.h * 0.45, s.h * 0.45, w, 0, y0 + s.h / 2, 0, K.white, 28); c.rotation.z = Math.PI / 2; c.position.y = y0 + s.h / 2; box(0.3, 0.3, 0.05, w / 2 - 0.3, y0 + 0.1, front - 0.05, K.dark); }
    else if (k === 'towel') { const rr = cyl(0.03, 0.03, w, 0, y0, back + 0.2, K.chrome, 10); rr.rotation.z = Math.PI / 2; rr.position.y = y0 + 0.25; [-1, 1].forEach(sg => box(0.05, 0.05, 0.2, sg * (w / 2 - 0.05), y0 + 0.22, back + 0.1, K.chrome)); rb(w * 0.55, 1.6, 0.08, 0.03, -w * 0.15, y0 - 1.3, back + 0.24, K.lightF); rb(w * 0.35, 1.2, 0.08, 0.03, w * 0.28, y0 - 0.9, back + 0.28, K.accent); }
    else if (k === 'washer' || k === 'dryer') { rb(w, s.h, d, 0.06, 0, 0, 0, K.white); box(w - 0.1, 0.45, 0.02, 0, s.h - 0.5, front, K.col('#E4E6E8')); const r1 = tor(0.6, 0.08, 0, 1.25, front + 0.02, K.chrome); void r1; const gl = cyl(0.55, 0.55, 0.03, 0, 1.25, front + 0.02, K.glass, 32); gl.rotation.x = Math.PI / 2; box(0.5, 0.12, 0.02, w / 2 - 0.45, s.h - 0.35, front + 0.02, K.black); }
    else if (k === 'car') {
      const paint = K.col(T.accent, { metalness: 0.6, roughness: 0.25 }); rb(w, 1.6, d, 0.45, 0, 0.75, 0, paint); rb(w - 0.5, 1.4, d * 0.45, 0.4, 0, 2.2, -0.6, paint); rb(w - 0.45, 1.25, d * 0.43, 0.35, 0, 2.27, -0.6, K.glass);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const c = cyl(0.95, 0.95, 0.65, a * (w / 2 - 0.25), 0.95, b * (d / 2 - 2.7), K.rubber, 24); c.rotation.z = Math.PI / 2; c.position.y = 0.95; const hub = cyl(0.55, 0.55, 0.68, a * (w / 2 - 0.25), 0.95, b * (d / 2 - 2.7), K.steel, 18); hub.rotation.z = Math.PI / 2; hub.position.y = 0.95; });
      [-1, 1].forEach(sg => { box(0.9, 0.25, 0.05, sg * (w / 2 - 0.7), 1.75, front + 0.0, K.glow); box(0.8, 0.22, 0.05, sg * (w / 2 - 0.7), 1.8, back, K.col('#C2392D', { emissive: new THREE.Color('#7a0000'), emissiveIntensity: 0.6 })); });
    } else if (k === 'otable') { cyl(w / 2, w / 2, 0.08, 0, s.h - 0.08, 0, K.glass, 36); tor(w / 2, 0.04, 0, s.h - 0.06, 0, K.metal).rotation.x = Math.PI / 2; cyl(0.06, 0.06, s.h - 0.1, 0, 0, 0, K.metal, 10); cyl(0.7, 0.7, 0.05, 0, 0, 0, K.metal, 24); vase(0, s.h, 0, 0.5); }
    else if (k === 'ochair' || k === 'lounger') {
      const rattan = K.col('#8B6B4A', { roughness: 0.9 });
      if (k === 'ochair') { legs(w - 0.2, d - 0.2, 1.3, K.metal, 0.08, 0.1, true); rb(w, 0.3, d, 0.12, 0, 1.3, 0, rattan); rb(w - 0.2, 0.25, d - 0.3, 0.1, 0, 1.6, 0.1, K.lightF); const bk = rb(w, 1.5, 0.2, 0.1, 0, 1.6, back + 0.15, rattan); bk.rotation.x = -0.18; }
      else { legs(w, d, 0.8, K.metal, 0.1, 0.15, true); rb(w, 0.25, d, 0.08, 0, 0.8, 0, rattan); rb(w - 0.15, 0.25, d * 0.62, 0.1, 0, 1.05, d * 0.19, K.lightF); const bk = rb(w - 0.15, 0.25, d * 0.36, 0.1, 0, 1.4, back + d * 0.2, K.lightF); bk.rotation.x = 0.7; }
    } else if (k === 'swing') {
      [-1, 1].forEach(sg => { const l = box(0.2, 6.6, 0.2, sg * (w / 2 - 0.1), 0, back + 0.6, K.metal); l.rotation.x = 0.18; const l2 = box(0.2, 6.6, 0.2, sg * (w / 2 - 0.1), 0, front - 0.6, K.metal); l2.rotation.x = -0.18; }); box(w, 0.2, 0.2, 0, 6.4, 0, K.metal);
      [-1, 1].forEach(sg => cyl(0.02, 0.02, 4.4, sg * (w / 2 - 1.2), 2.0, 0, K.chrome, 6)); rb(w - 2, 0.35, 2.2, 0.12, 0, 1.6, 0, K.col('#8B6B4A', { roughness: 0.9 })); rb(w - 2.1, 0.3, 2.0, 0.12, 0, 1.95, 0.05, K.accent); const bk = rb(w - 2, 1.6, 0.25, 0.1, 0, 1.95, -0.95, K.col('#8B6B4A')); bk.rotation.x = -0.2;
    } else rb(w, Math.max(0.2, s.h || 2), d, 0.06, 0, y0, 0, K.wood);
    g.position.set(it.cx, 0, it.cy); g.rotation.y = -it.rot * DEG; g.userData.fid = it.id;
    return g;
  }
  function sg2(i) { return i ? 1 : -1; }

  // ---------- room shell: floor, painted/tiled walls, skirting, door leaves & frames, windows, curtains, switches ----------
  function shellParts(g, items, fin, T, K, opts) {
    const W = g.W, H = g.H, wet = I.WET.has(g.t), kitchen = g.t === 'kitchen';
    const walls = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group() };
    const lenOf = side => (side === 'N' || side === 'S' ? W : H);
    const P = (side, t, off) => side === 'N' ? [t, off] : side === 'S' ? [t, H - off] : side === 'W' ? [off, t] : [W - off, t];          // world x,z
    const U = side => (side === 'N' || side === 'S' ? [1, 0] : [0, 1]); const N = side => ({ N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] })[side];
    const ROT = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };
    const wbox = (side, t0, t1, y0, y1, o0, o1, m, cast) => { const L = t1 - t0, h = y1 - y0, th = o1 - o0; if (L < 0.01 || h < 0.01 || th < 0.001) return null; const [x, z] = P(side, (t0 + t1) / 2, (o0 + o1) / 2);
      const geo = side === 'N' || side === 'S' ? boxGeo(L, h, th) : boxGeo(th, h, L); const o = new THREE.Mesh(geo, m); o.position.set(x, y0 + h / 2, z); o.receiveShadow = true; o.castShadow = cast !== false; walls[side].add(o); return o; };
    const local = (side, t, off, obj) => { const [x, z] = P(side, t, off); obj.position.x = x; obj.position.z = z; obj.rotation.y = ROT[side]; walls[side].add(obj); return obj; };
    if (g.open || opts.walls === false) return { walls, P };
    const paint = K.paint((I.WALLS[fin.wall] || I.WALLS.ivory).color); const tile = K.tile(); const frame = T.n === 'Minimal' ? K.white : K.woodD; const leafM = T.n === 'Minimal' ? K.lacquer : K.wood;
    const dado = wet ? 7 : 0;
    ['N', 'S', 'W', 'E'].forEach(side => {
      const len = lenOf(side); const list = g.ops.filter(o => o.side === side).sort((a, b) => a.a - b.a);
      const seg = (a, b, y0, y1) => { if (dado && y0 < dado) { wbox(side, a, b, y0, Math.min(dado, y1), -WALL_T, 0, tile); if (y1 > dado) wbox(side, a, b, dado, y1, -WALL_T, 0, paint); } else wbox(side, a, b, y0, y1, -WALL_T, 0, paint); };
      let p = -WALL_T; const solid = [];
      list.forEach(o => { seg(p, o.a, 0, WALL_H); solid.push([Math.max(0, p), o.a]); if (o.kind === 'window') { seg(o.a, o.b, 0, 3); seg(o.a, o.b, 7, WALL_H); solid.push([o.a, o.b]); } else seg(o.a, o.b, 7, WALL_H); p = o.b; });
      seg(p, len + WALL_T, 0, WALL_H); solid.push([p, len]);
      if (!wet) solid.forEach(([a, b]) => wbox(side, Math.max(0, a), Math.min(len, b), 0, 0.35, 0, 0.05, frame === K.white ? K.white : K.paint('#F2EFEA')));
      list.forEach(o => {
        const L = o.b - o.a;
        if (o.kind === 'window') {
          const fm = K.col('#3A3F45', { metalness: 0.5, roughness: 0.4 });
          wbox(side, o.a, o.b, 6.88, 7, -WALL_T * 0.7, -WALL_T * 0.3, fm); wbox(side, o.a, o.b, 3, 3.12, -WALL_T * 0.7, -WALL_T * 0.3, fm); wbox(side, o.a, o.a + 0.12, 3, 7, -WALL_T * 0.7, -WALL_T * 0.3, fm); wbox(side, o.b - 0.12, o.b, 3, 7, -WALL_T * 0.7, -WALL_T * 0.3, fm); wbox(side, (o.a + o.b) / 2 - 0.05, (o.a + o.b) / 2 + 0.05, 3, 7, -WALL_T * 0.75, -WALL_T * 0.25, fm);
          wbox(side, o.a + 0.1, o.b - 0.1, 3.1, 6.9, -WALL_T * 0.55, -WALL_T * 0.5, K.glass, false);
          wbox(side, o.a - 0.15, o.b + 0.15, 2.92, 3.0, -WALL_T, 0.22, K.stone);
          if (!wet && !kitchen) {
            const rod = new THREE.Mesh(cylGeo(0.035, 0.035, L + 1.8, 10), K.metal); rod.rotation.z = Math.PI / 2; const rg = new THREE.Group(); rg.add(rod); rod.position.y = 7.7; local(side, (o.a + o.b) / 2, 0.4, rg);
            const panel = (pw, ph, amp, per, m) => { const gg = new THREE.PlaneGeometry(pw, ph, Math.max(8, Math.round(pw / per * 6)), 1); const pa = gg.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) / per * Math.PI * 2) * amp); gg.computeVertexNormals(); const m2 = new THREE.Mesh(gg, m); m2.castShadow = true; return m2; };
            const pw = 1.3 + L * 0.12; [o.a - 0.9 + pw / 2, o.b + 0.9 - pw / 2].forEach(t => { const c = panel(pw, 7.55, 0.11, 0.42, K.curtain); c.position.y = 7.55 / 2 + 0.08; const cg = new THREE.Group(); cg.add(c); local(side, t, 0.42, cg); });
            const sh = panel(L + 1.0, 7.4, 0.05, 0.3, K.sheer); sh.castShadow = false; sh.position.y = 3.85; const sg = new THREE.Group(); sg.add(sh); local(side, (o.a + o.b) / 2, 0.3, sg);
          } else { wbox(side, o.a - 0.1, o.b + 0.1, 7.05, 7.3, 0.02, 0.27, K.white); wbox(side, o.a, o.b, 5.6, 7.05, 0.12, 0.14, K.col(T.light, { roughness: 1 })); }
        } else {
          wbox(side, o.a - 0.25, o.a, 0, 7.25, 0, 0.07, frame); wbox(side, o.b, o.b + 0.25, 0, 7.25, 0, 0.07, frame); wbox(side, o.a - 0.25, o.b + 0.25, 7, 7.25, 0, 0.07, frame);
          wbox(side, o.a, o.a + 0.07, 0, 7, -WALL_T, 0, frame); wbox(side, o.b - 0.07, o.b, 0, 7, -WALL_T, 0, frame); wbox(side, o.a, o.b, 6.93, 7, -WALL_T, 0, frame);
          if (o.kind === 'door') {
            const hingeA = o.hingeA !== false; const th = hingeA ? o.a + 0.07 : o.b - 0.07; const LL = L - 0.14; const [hx, hz] = P(side, th, 0.07); const u = U(side), n = N(side);
            const d0 = [u[0] * (hingeA ? 1 : -1), u[1] * (hingeA ? 1 : -1)]; const ang = 78 * DEG; const dir = [d0[0] * Math.cos(ang) + n[0] * Math.sin(ang), d0[1] * Math.cos(ang) + n[1] * Math.sin(ang)];
            const leaf = new THREE.Mesh(boxGeo(LL, 6.88, 0.14), leafM); leaf.position.set(hx + dir[0] * LL / 2, 6.88 / 2 + 0.03, hz + dir[1] * LL / 2); leaf.rotation.y = Math.atan2(-dir[1], dir[0]); leaf.castShadow = true; walls[side].add(leaf);
            const pv = [-dir[1], dir[0]]; [-1, 1].forEach(sgn => { const hd = new THREE.Mesh(boxGeo(0.4, 0.06, 0.06), K.chrome); hd.position.set(hx + dir[0] * (LL - 0.35) + pv[0] * sgn * 0.12, 3.4, hz + dir[1] * (LL - 0.35) + pv[1] * sgn * 0.12); hd.rotation.y = leaf.rotation.y; walls[side].add(hd); });
            [[1.2, 3.0], [4.4, 2.2]].forEach(([y, hh]) => [-1, 1].forEach(sgn => { const gr = new THREE.Mesh(boxGeo(LL - 0.6, hh, 0.01), frame); gr.position.set(hx + dir[0] * LL / 2 + pv[0] * sgn * 0.075, y + hh / 2 - 0.4, hz + dir[1] * LL / 2 + pv[1] * sgn * 0.075); gr.rotation.y = leaf.rotation.y; walls[side].add(gr); }));
          }
        }
      });
    });
    // switches and sockets
    try { (D().electrical(g, items) || []).forEach(e => { const sz = e.type === 'switch' ? [0.55, 0.42] : [0.3, 0.3]; wbox(e.side, e.t - sz[0] / 2, e.t + sz[0] / 2, e.h - sz[1] / 2, e.h + sz[1] / 2, 0, 0.03, e.type === 'switch' || e.type === 'socket' ? K.white : K.col('#E8E3DA'), false); }); } catch (err) { /* detail module optional */ }
    return { walls, P };
  }

  // ---------- ceiling: slab, gypsum bulkhead with cove, downlights, fan / chandelier / pendant ----------
  function ceilingParts(g, items, T, K) {
    const ceil = new THREE.Group(), lamps = new THREE.Group(); if (g.open) return { ceil, lamps };
    const B = builder(ceil); const W = g.W, H = g.H; let cl = null; try { cl = D().ceiling(g, items); } catch (e) { cl = { fc: null, lights: [{ type: 'down', x: W / 2, y: H / 2 }] }; }
    const gyp = K.col('#FBFAF7', { roughness: 0.95 }); B.box(W, 0.12, H, W / 2, WALL_H, H / 2, gyp); const fc = cl.fc;
    if (fc && fc.kind === 'peripheral') { const b = fc.band, th = WALL_H - fc.low; B.box(W, th, b, W / 2, fc.low, b / 2, gyp); B.box(W, th, b, W / 2, fc.low, H - b / 2, gyp); B.box(b, th, H - 2 * b, b / 2, fc.low, H / 2, gyp); B.box(b, th, H - 2 * b, W - b / 2, fc.low, H / 2, gyp);
      [[W / 2, b + 0.06, W - 2 * b, 0.05], [W / 2, H - b - 0.06, W - 2 * b, 0.05]].forEach(([x, z, l]) => B.box(l, 0.06, 0.05, x, WALL_H - 0.14, z, K.glow)); [[b + 0.06, H / 2], [W - b - 0.06, H / 2]].forEach(([x, z]) => B.box(0.05, 0.06, H - 2 * b, x, WALL_H - 0.14, z, K.glow)); }
    else if (fc) B.box(W, 0.08, H, W / 2, fc.low, H / 2, gyp);
    const yAt = (x, z) => !fc ? WALL_H : fc.kind === 'flat' ? fc.low : (x < fc.band || x > W - fc.band || z < fc.band || z > H - fc.band ? fc.low : WALL_H);
    let main = null;
    cl.lights.forEach(l => { const y = yAt(l.x, l.y);
      if (l.type === 'down') { B.cyl(0.2, 0.2, 0.03, l.x, y - 0.03, l.y, K.steel, 20); B.cyl(0.15, 0.15, 0.02, l.x, y - 0.045, l.y, K.glow, 20); }
      else if (l.type === 'fan') { main = l; B.cyl(0.05, 0.05, 1.1, l.x, y - 1.1, l.y, K.metal, 8); B.cyl(0.42, 0.38, 0.35, l.x, y - 1.45, l.y, K.metal, 24); for (let i = 0; i < 3; i++) { const bl = B.box(1.95, 0.03, 0.42, l.x + Math.cos(i * 2.094) * 1.2, y - 1.3, l.y + Math.sin(i * 2.094) * 1.2, K.woodD); bl.rotation.y = -i * 2.094; } B.cyl(0.25, 0.2, 0.12, l.x, y - 1.6, l.y, K.glowSoft, 20); }
      else if (l.type === 'chandelier') { main = l; B.cyl(0.02, 0.02, 1.4, l.x, y - 1.4, l.y, K.metal, 6); const ring = B.tor(1.2, 0.05, l.x, y - 1.9, l.y, K.metal); ring.rotation.x = Math.PI / 2; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; B.sph(0.12, l.x + Math.cos(a) * 1.2, y - 1.75, l.y + Math.sin(a) * 1.2, K.glow); B.sph(0.07, l.x + Math.cos(a) * 1.2, y - 2.2, l.y + Math.sin(a) * 1.2, K.glass); B.cyl(0.006, 0.006, 0.3, l.x + Math.cos(a) * 1.2, y - 2.2, l.y + Math.sin(a) * 1.2, K.chrome, 4); } B.sph(0.22, l.x, y - 2.2, l.y, K.glass); }
      else if (l.type === 'pendant') { if (!main) main = l; [-0.9, 0, 0.9].forEach(dx => { B.cyl(0.01, 0.01, 2.8, l.x + dx, y - 2.8, l.y, K.dark, 4); B.cyl(0.08, 0.45, 0.5, l.x + dx, y - 3.3, l.y, K.metal, 24); B.cyl(0.38, 0.38, 0.02, l.x + dx, y - 3.31, l.y, K.glow, 20); }); }
      else if (l.type === 'exhaust') { B.box(0.8, 0.04, 0.8, l.x, y - 0.04, l.y, K.white); for (let i = -2; i <= 2; i++) B.box(0.6, 0.02, 0.04, l.x, y - 0.06, l.y + i * 0.12, K.dark); }
      else if (l.type === 'batten') B.box(4, 0.12, 0.2, l.x, y - 0.12, l.y, K.glow);
    });
    const pl = (x, z, y, i) => { const p = new THREE.PointLight(0xFFD9A8, i, Math.max(g.W, g.H) * 1.6 + 6, 2); p.position.set(x, y, z); lamps.add(p); };
    pl(main ? main.x : W / 2, main ? main.y : H / 2, WALL_H - 1.6, g.area > 150 ? 0.9 : 0.6); if (g.area > 220) pl(W * 0.25, H * 0.25, WALL_H - 1.2, 0.35);
    return { ceil, lamps, cl };
  }

  // ---------- one room ----------
  function roomGroup(g, items, fin, theme, opts) {
    opts = opts || {}; const T = I.THEMES[theme] || I.THEMES.modern; const K = kit(T, opts.mat); const grp = new THREE.Group();
    const floor = new THREE.Mesh(boxGeo(g.W, 0.1, g.H), K.floor(fin)); floor.position.set(g.W / 2, -0.05, g.H / 2); floor.receiveShadow = true; floor.userData.floor = true; grp.add(floor);
    const sh = shellParts(g, items, fin, T, K, opts); Object.values(sh.walls).forEach(w => grp.add(w));
    const cp = opts.ceiling === false ? { ceil: new THREE.Group(), lamps: new THREE.Group() } : ceilingParts(g, items, T, K); grp.add(cp.ceil); if (opts.lamps !== false) grp.add(cp.lamps);
    const furn = new THREE.Group(); items.forEach(it => { try { const m = model(it, T, K); tagWall(g, it, m); furn.add(m); } catch (e) { if (root.console) console.warn('model', it.k, e); } }); grp.add(furn);
    grp.userData = { walls: sh.walls, furn, floor, ceil: cp.ceil, lamps: cp.lamps };
    return grp;
  }

  // which wall a piece stands against (for the cutaway): wall-hung pieces hide with their wall, tall ones turn to glass
  function tagWall(g, it, m) {
    const r = I.rectOf(it); const s = I.F[it.k] || {}; const d = { N: r.y, S: g.H - (r.y + r.h), W: r.x, E: g.W - (r.x + r.w) };
    const side = it.wall || Object.keys(d).sort((a, b) => d[a] - d[b])[0]; if (d[side] > 0.8) return;
    m.userData.wallSide = side; m.userData.hang = I.isWallItem(it); m.userData.tall = (s.h || 0) + (s.y0 && !I.isWallItem(it) ? s.y0 : 0) >= 4.5 || it.k === 'tvwall';
  }
  const GHOST = new Map();
  function ghost(obj, on) {
    obj.traverse(o => { if (!o.isMesh) return; if (on) { if (!o.userData.orig) o.userData.orig = o.material; const m0 = o.userData.orig; let gm = GHOST.get(m0); if (!gm) { gm = m0.clone(); gm.transparent = true; gm.opacity = 0.16; gm.depthWrite = false; GHOST.set(m0, gm); } o.material = gm; o.castShadow = false; } else if (o.userData.orig) { o.material = o.userData.orig; o.castShadow = true; } });
  }

  // a soft studio environment for reflections (marble, chrome, mirrors, glass)
  function envFor(renderer) {
    if (renderer.__env) return renderer.__env;
    const sc = new THREE.Scene(); const geo = new THREE.BoxGeometry(1, 1, 1); const room = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x8a8580, side: THREE.BackSide })); room.scale.set(40, 20, 40); room.position.y = 9; sc.add(room);
    const panel = (x, y, z, sx, sy, sz, k) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(k) })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); sc.add(m); };
    panel(0, 18.5, 0, 14, 0.2, 14, 3.2); panel(-19.5, 9, 0, 0.2, 8, 16, 4); panel(19.5, 7, 6, 0.2, 6, 8, 2); panel(0, 8, -19.5, 16, 7, 0.2, 2.2);
    const pm = new THREE.PMREMGenerator(renderer); renderer.__env = pm.fromScene(sc, 0.03).texture; pm.dispose(); return renderer.__env;
  }

  // ---------- editor viewer ----------
  function RoomViewer(host) {
    if (!root.THREE || !THREE.OrbitControls) throw new Error('3D library not loaded');
    this.host = host; const R = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.88; R.physicallyCorrectLights = false;
    host.appendChild(R.domElement); R.domElement.style.touchAction = 'none';
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#E9EEF4'); try { this.scene.environment = envFor(R); } catch (e) { /* no float targets: plain lighting */ }
    this.camera = new THREE.PerspectiveCamera(45, 1.5, 0.2, 500);
    this.controls = new THREE.OrbitControls(this.camera, R.domElement); this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.495; this.controls.minDistance = 0.8; this.controls.maxDistance = 120;
    this.controls.addEventListener('change', () => this.kick());
    this.scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xB5AA9C, 0.32));
    const sun = this.sun = new THREE.DirectionalLight(0xFFF3E2, 0.95); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; this.scene.add(sun); this.scene.add(sun.target);
    this.items = []; this.sel = null; this.mat = {}; this.raf = 0; this.mode = 'corner';
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ro = new ResizeObserver(() => this.resize()); ro.observe(host); this.resize();
    this._bind();
  }
  RoomViewer.prototype.resize = function () { const w = this.host.clientWidth || 600, h = this.host.clientHeight || 400; this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.kick(); };
  RoomViewer.prototype.kick = function () {
    if (this.raf) return;
    const loop = () => { this.raf = 0; const more = this.controls.update(); this._cut(); this.renderer.render(this.scene, this.camera); if (more) this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  };
  // doll's-house cutaway from outside; from inside the room (walk-in view) every wall and the ceiling show
  RoomViewer.prototype._cut = function () {
    if (!this.room || !this.g) return; const c = this.camera.position, g = this.g, u = this.room.userData, W = u.walls;
    const inside = c.x > 0.2 && c.x < g.W - 0.2 && c.z > 0.2 && c.z < g.H - 0.2 && c.y < WALL_H - 0.3;
    if (inside) { W.N.visible = W.S.visible = W.W.visible = W.E.visible = true; } else { W.N.visible = c.z > 0.5; W.S.visible = c.z < g.H - 0.5; W.W.visible = c.x > 0.5; W.E.visible = c.x < g.W - 0.5; }
    if (u.ceil) u.ceil.visible = inside;
    u.furn.children.forEach(m => { const sd = m.userData.wallSide; if (!sd) return; const show = W[sd].visible; if (m.userData.hang) m.visible = show; else if (m.userData.tall) { if (m.userData.ghosted !== !show) { ghost(m, !show); m.userData.ghosted = !show; } } });
  };
  RoomViewer.prototype.setRoom = function (g, items, fin, theme, keepView) {
    const sameRoom = this.g && this.g.key === g.key;
    if (this.room) { this.scene.remove(this.room); }
    this.g = g; this.items = items; this.fin = fin; this.theme = theme;
    this.room = roomGroup(g, items, fin, theme, { mat: this.mat }); this.scene.add(this.room);
    const span = Math.max(g.W, g.H); const win = g.ops.find(o => o.kind === 'window'); const n = win ? ({ N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] })[win.side] : [-0.6, -0.8];
    this.sun.position.set(g.W / 2 + n[0] * span * 1.2 - span * 0.3, 24, g.H / 2 + n[1] * span * 1.2 - span * 0.2); this.sun.target.position.set(g.W / 2, 0, g.H / 2);
    const sc = this.sun.shadow.camera; sc.left = -span * 1.1; sc.right = span * 1.1; sc.top = span * 1.1; sc.bottom = -span * 1.1; sc.near = 1; sc.far = 140; sc.updateProjectionMatrix();
    if (!(keepView && sameRoom)) this.view('corner');
    this._outline(); this.kick();
  };
  RoomViewer.prototype.refresh = function () { if (this.g) this.setRoom(this.g, this.items, this.fin, this.theme, true); };
  RoomViewer.prototype.view = function (name) {
    const g = this.g; if (!g) return; this.mode = name; const k = this.camera.aspect < 1.3 ? 1.3 / this.camera.aspect : 1; const span = Math.max(g.W, g.H) * k; let t = new THREE.Vector3(g.W / 2, 2, g.H / 2); let pos;
    if (name === 'top') pos = new THREE.Vector3(g.W / 2, span * 1.55 + 6, g.H / 2 + 0.01);
    else if (name === 'front') pos = new THREE.Vector3(g.W / 2, 5.2, g.H + span * 0.9 + 4);
    else if (name === 'eye') {
      const door = g.ops.find(o => o.kind !== 'window') || { side: 'S', a: g.W / 2 - 1, b: g.W / 2 + 1 }; const m = (door.a + door.b) / 2; const off = Math.min(1.4, (door.side === 'N' || door.side === 'S' ? g.H : g.W) * 0.18);
      const P = { N: [m, off], S: [m, g.H - off], W: [off, m], E: [g.W - off, m] }[door.side]; const back = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[door.side];
      const hs = door.hingeA !== false ? 1 : -1; const side = (door.side === 'N' || door.side === 'S') ? [hs, 0] : [0, hs]; const fwd = [-back[0], -back[1]]; const px = Math.max(0.8, Math.min(g.W - 0.8, P[0] + side[0] * 1.1 + fwd[0] * 1.4)), pz = Math.max(0.8, Math.min(g.H - 0.8, P[1] + side[1] * 1.1 + fwd[1] * 1.4));
      pos = new THREE.Vector3(px, 5.1, pz); t = new THREE.Vector3(g.W / 2 - back[0] * g.W * 0.2 - side[0] * g.W * 0.08, 3.6, g.H / 2 - back[1] * g.H * 0.2 - side[1] * g.H * 0.08);
      this.camera.fov = 68; this.camera.updateProjectionMatrix();
    } else pos = new THREE.Vector3(g.W + span * 0.32 + 2.5, span * 0.62 + 6, g.H + span * 0.42 + 2.5);
    if (name !== 'eye' && this.camera.fov !== 45) { this.camera.fov = 45; this.camera.updateProjectionMatrix(); }
    this.camera.position.copy(pos); this.controls.target.copy(t); this.controls.update(); this.kick();
  };
  RoomViewer.prototype._outline = function () {
    if (this.box) { this.scene.remove(this.box); this.box = null; }
    const it = this.items.find(i => i.id === this.sel); if (!it || !this.room) return;
    const grp = this.room.userData.furn.children.find(o => o.userData.fid === it.id); if (!grp) return;
    this.box = new THREE.BoxHelper(grp, this.clash(it) ? 0xC2392D : 0x1E6FD9); this.scene.add(this.box);
  };
  RoomViewer.prototype.clash = function (it) {
    const r = I.rectOf(it), g = this.g; if (r.x < -0.01 || r.y < -0.01 || r.x + r.w > g.W + 0.01 || r.y + r.h > g.H + 0.01) return true;
    if (it.k === 'rug' || it.k === 'prayer' || it.k === 'showerzone') return false; const A = I.yr(it);
    return this.items.some(o => { if (o === it || o.k === 'rug' || o.k === 'prayer' || o.k === 'showerzone') return false; const q = I.rectOf(o), B = I.yr(o); return r.x < q.x + q.w - 0.05 && q.x < r.x + r.w - 0.05 && r.y < q.y + q.h - 0.05 && q.y < r.y + r.h - 0.05 && A[0] < B[1] - 0.05 && B[0] < A[1] - 0.05; });
  };
  RoomViewer.prototype.select = function (fid) { this.sel = fid; this._outline(); this.kick(); if (this.onSelect) this.onSelect(fid); };
  RoomViewer.prototype._pick = function (e) {
    const rc = this.renderer.domElement.getBoundingClientRect(); const v = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera); return v;
  };
  RoomViewer.prototype._bind = function () {
    const el = this.renderer.domElement; let drag = null;
    el.addEventListener('pointerdown', e => {
      if (!this.room) return; this._pick(e);
      const hits = this.ray.intersectObjects(this.room.userData.furn.children, true);
      const idOf = h => { let o = h.object; while (o && !o.userData.fid) o = o.parent; return o; };
      const hit = hits.find(h => { const o = idOf(h); return o && !['rug', 'prayer'].includes((this.items.find(i => i.id === o.userData.fid) || {}).k); }) || hits[0];
      if (!hit) { this.select(null); return; }
      const o = idOf(hit); if (!o) return; const it = this.items.find(i => i.id === o.userData.fid); if (!it) return;
      this.select(it.id); const p = new THREE.Vector3(); this.ray.ray.intersectPlane(this.plane, p);
      drag = { it, grp: o, dx: it.cx - p.x, dz: it.cy - p.z, moved: false, id: e.pointerId }; this.controls.enabled = false; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return; this._pick(e); const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(this.plane, p)) return;
      const it = drag.it, g = this.g; const snap = v => Math.round(v * 4) / 4; let x = p.x + drag.dx, z = p.z + drag.dz;
      if (I.isWallItem(it) && I.atWall) { // wall-hung pieces slide along the nearest wall
        const dists = { N: z, S: g.H - z, W: x, E: g.W - x }; const side = Object.keys(dists).sort((a, b) => dists[a] - dists[b])[0]; const len = side === 'N' || side === 'S' ? g.W : g.H; const t = Math.max(it.w / 2, Math.min(len - it.w / 2, snap(side === 'N' || side === 'S' ? x : z)));
        const n = I.atWall(g, it.k, side, t, it.w); it.cx = n.cx; it.cy = n.cy; it.rot = n.rot; it.wall = side; drag.grp.position.set(it.cx, 0, it.cy); drag.grp.rotation.y = -it.rot * DEG;
      } else { const fp = I.footprint(it); it.cx = Math.max(fp.fw / 2, Math.min(g.W - fp.fw / 2, snap(x))); it.cy = Math.max(fp.fd / 2, Math.min(g.H - fp.fd / 2, snap(z))); drag.grp.position.set(it.cx, 0, it.cy); it.wall = null; }
      drag.moved = true; this._outline(); this.kick();
    });
    const end = () => { if (!drag) return; const d = drag; drag = null; this.controls.enabled = true; if (d.moved && this.onChange) this.onChange('move', d.it); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  };
  RoomViewer.prototype.snapshot = function (w, h, view) {
    const R = this.renderer, size = new THREE.Vector2(); R.getSize(size); const pos = this.camera.position.clone(), tgt = this.controls.target.clone(), fov = this.camera.fov, mode = this.mode; const box = this.box;
    if (box) box.visible = false; R.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (view) this.view(view); this._cut();
    R.render(this.scene, this.camera); const url = R.domElement.toDataURL('image/jpeg', 0.9);
    R.setSize(size.x, size.y, false); this.camera.aspect = size.x / size.y; this.camera.fov = fov; this.camera.updateProjectionMatrix(); R.domElement.style.width = '100%'; R.domElement.style.height = '100%';
    this.mode = mode; this.camera.position.copy(pos); this.controls.target.copy(tgt); this.controls.update(); if (box) box.visible = true; this.kick();
    return url;
  };

  function avgColor(img) { try { const c = canvas(8); const g = c.getContext('2d'); g.drawImage(img, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`; } catch (e) { return '#cccccc'; } }
  // ---------- furnished house as one GLB ----------
  function houseGLB(plan, getRoom, theme) {
    return new Promise((resolve, reject) => {
      if (!THREE.GLTFExporter) { reject(new Error('GLB exporter not loaded')); return; }
      const all = new THREE.Group(); const mat = {};
      plan.floors.forEach((f, fi) => f.rooms.forEach(r => {
        if (I.NOFURN.has(r.t)) return; const g = I.roomGeom(plan, fi, r); const st = getRoom(g);
        const grp = roomGroup(g, st.items, st.fin || I.defaultFinish(r.t), st.theme || theme, { mat, ceiling: false, lamps: false }); grp.position.set(g.x0, fi * 11, g.y0); grp.name = `${fi ? 'FF' : 'GF'} ${r.name}`; all.add(grp);
      }));
      // keep the GLB light: plain colours instead of procedural textures, no glow-only details
      const flat = new Map(); all.traverse(o => { if (!o.isMesh) return; const m0 = o.material; let m = flat.get(m0); if (!m) { m = new THREE.MeshStandardMaterial({ color: m0.map ? new THREE.Color(m0.map.image ? avgColor(m0.map.image) : '#cccccc').convertSRGBToLinear() : m0.color.clone(), roughness: m0.roughness, metalness: m0.metalness, transparent: m0.transparent, opacity: m0.opacity, emissive: m0.emissive ? m0.emissive.clone() : undefined, side: m0.side }); flat.set(m0, m); } o.material = m; });
      new THREE.GLTFExporter().parse(all, res => resolve(res), { binary: true });
    });
  }

  // ---------- room-by-room design package: renders, drawings, specifications, BOQ ----------
  async function buildPackage(ctx) {
    const { jsPDF } = root.jspdf; const X = ctx.X, V = ctx.V; const plan = ctx.plan; const theme = ctx.theme; const T = I.THEMES[theme]; const DT = D();
    const tick = () => new Promise(r => setTimeout(r, 0)); const status = t => ctx.onStatus && ctx.onStatus(t);
    const pal = X.lightPalette(); const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const _t = doc.text.bind(doc); const fx = s => typeof s === 'string' ? s.replace(/ft²/g, 'sq ft').replace(/mm²/g, 'sq mm').replace(/[−–—]/g, '-').replace(/[×]/g, 'x').replace(/[′’]/g, "'").replace(/[″“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\x7E]/g, '') : Array.isArray(s) ? s.map(fx) : s; doc.text = (s, ...a) => _t(fx(s), ...a);
    const W = 210, H = 297, M = 14; const ink = [15, 42, 67], muted = [93, 117, 144], accent = [30, 111, 217], line = [214, 222, 232];
    const pkr = v => 'PKR ' + (v >= 1e7 ? (v / 1e7).toFixed(2) + ' crore' : v >= 1e5 ? (v / 1e5).toFixed(1) + ' lakh' : Math.round(v).toLocaleString('en-PK'));
    const range = r => `${pkr(r[0])} - ${pkr(r[1]).replace('PKR ', '')}`; const num = v => Math.round(v).toLocaleString('en-PK');
    let page = 0; const toc = [];
    const head = (title, sub, room) => { if (page++) doc.addPage(); doc.setFillColor(...accent); doc.rect(0, 0, W, 3, 'F'); doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(title, M, 15); if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...muted); doc.text(sub, M, 21); } doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text(`BuildMe interiors · ${ctx.project}${room ? ' · ' + room : ''}`, W - M, 8.5, { align: 'right' }); doc.text(String(page), W - M, H - 8, { align: 'right' }); doc.text('Indicative interior design package. Sizes in feet-inches; 2026 PKR ranges are typical market values, not quotations. Verify on site.', M, H - 8); };
    const img = (url, x, y, w, h, type) => doc.addImage(url, type || 'JPEG', x, y, w, h, undefined, 'FAST');
    const fitCanvas = (c, x, y, maxW, maxH, align) => { const r = Math.min(maxW / c.width, maxH / c.height); const w = c.width * r, h = c.height * r; img(c.toDataURL('image/jpeg', 0.86), x + (align === 'left' ? 0 : (maxW - w) / 2), y, w, h); return { w, h }; };
    const caption = (t, x, y) => { doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ink); doc.text(t, x, y); doc.setFont('helvetica', 'normal'); };
    const sw = (hex, x, yy, s) => { const v = hex.replace('#', ''); doc.setFillColor(parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)); doc.setDrawColor(180); doc.rect(x, yy - 3.5, s || 5, s || 5, 'FD'); };
    // simple table: cols [{t, w, align}], rows [[...]]; returns new y; continues on new pages
    const table = (cols, rows, y, cont) => {
      const hdr = yy => { doc.setFontSize(7); doc.setTextColor(...muted); doc.setFont('helvetica', 'bold'); let x = M; cols.forEach(c => { doc.text(c.t.toUpperCase(), c.align === 'right' ? x + c.w : x, yy, c.align === 'right' ? { align: 'right' } : undefined); x += c.w; }); doc.setFont('helvetica', 'normal'); doc.setDrawColor(...line); doc.line(M, yy + 1.6, W - M, yy + 1.6); return yy + 5.2; };
      y = hdr(y); doc.setFontSize(7.6); doc.setTextColor(...ink);
      rows.forEach(r => { const wrapped = r.map((v, i) => doc.splitTextToSize(fx(String(v == null ? '' : v)), cols[i].w - 2)); const lines = Math.max(...wrapped.map(w2 => w2.length)); const hh = lines * 3.3 + 1.3;
        if (y + hh > H - 16) { cont(); y = hdr(30); doc.setFontSize(7.6); doc.setTextColor(...ink); }
        let x = M; wrapped.forEach((wl, i) => { const c = cols[i]; if (r.bold) doc.setFont('helvetica', 'bold'); _t(wl, c.align === 'right' ? x + c.w : x, y, c.align === 'right' ? { align: 'right' } : undefined); doc.setFont('helvetica', 'normal'); x += c.w; }); y += hh; doc.setDrawColor(238, 242, 246); doc.line(M, y - 2.6, W - M, y - 2.6); });
      return y;
    };
    const files = []; const svgs = [];
    const rooms = []; plan.floors.forEach((f, fi) => f.rooms.forEach(r => { if (!I.NOFURN.has(r.t)) { const g = I.roomGeom(plan, fi, r); rooms.push({ g, st: ctx.getRoom(g), fi, r }); } }));
    const boqs = rooms.map(x => DT.boq(x.g, x.st.items, x.st.fin, x.st.theme || theme));
    const total = boqs.reduce((a, b) => [a[0] + b.total[0], a[1] + b.total[1]], [0, 0]);
    const trades = {}; boqs.forEach(b => Object.entries(b.byTrade).forEach(([k, v]) => { const t = trades[k] || (trades[k] = [0, 0]); t[0] += v[0]; t[1] += v[1]; }));
    const designed = rooms.filter(x => x.st.touched || x.st.done).length;
    status('Drawing furnished floor plans…'); await tick();
    const floorCanvas = [];
    for (let fi = 0; fi < plan.floors.length; fi++) {
      let svg = V.renderFloor(plan, fi, { uid: 'ip' + fi, facing: ctx.road }); svg = I.inject(svg, I.floorLayer(plan, fi, ctx.getRoom, theme, {}));
      const c = await X.svgToCanvas(svg, 1700, pal); floorCanvas.push(c); files.push({ path: `images/floor-${fi ? 'first' : 'ground'}-furnished.png`, blob: await X.canvasBlob(c) });
    }
    // cover
    head('Interior design package', `${plan.plot.w}' x ${plan.plot.d}' (${plan.plot.common}) · ${ctx.authority} · ${T.n} theme · ${ctx.date}`);
    const kv = (k, v, x, y) => { doc.setTextColor(...muted); doc.setFontSize(7.5); doc.text(k.toUpperCase(), x, y); doc.setTextColor(...ink); doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.text(v, x, y + 5); doc.setFont('helvetica', 'normal'); };
    kv('Project', ctx.project, M, 32); kv('Rooms', `${rooms.length} rooms · ${designed} designed by you · ${rooms.length - designed} auto-designed`, M + 70, 32);
    doc.setTextColor(...accent); doc.setFontSize(8.5); doc.text('TOTAL INTERIOR BUDGET (BOQ)', M, 50); doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.text(range(total), M, 58); doc.setFont('helvetica', 'normal');
    let ty = 66; doc.setFontSize(8); Object.entries(trades).sort((a, b) => b[1][1] - a[1][1]).forEach(([k, v], i) => { const x = M + (i % 2) * 92, y = ty + Math.floor(i / 2) * 5.2; doc.setTextColor(...muted); doc.text(k, x, y); doc.setTextColor(...ink); doc.text(range(v), x + 88, y, { align: 'right' }); });
    ty += Math.ceil(Object.keys(trades).length / 2) * 5.2 + 2;
    doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text(doc.splitTextToSize('For every room: 3D renders (overview + walk-in eye level), a dimensioned furniture plan with clearances, four wall elevations, reflected ceiling & lighting plan, electrical layout, flooring layout, finish specifications and a priced bill of quantities. Drawings are also included as vector SVG files in the ZIP.', W - 2 * M), M, ty + 2);
    fitCanvas(floorCanvas[0], M, ty + 12, W - 2 * M, H - ty - 30);
    for (let fi = 0; fi < floorCanvas.length; fi++) { head(`${fi ? 'First' : 'Ground'} floor — furniture layout`, `${rooms.filter(x => x.fi === fi).length} rooms · road on the ${ctx.road.toLowerCase()}`); fitCanvas(floorCanvas[fi], M, 28, W - 2 * M, H - 28 - 16); }
    // rooms
    const viewer = ctx.viewer; const keep = viewer && viewer.g ? { g: viewer.g, items: viewer.items, fin: viewer.fin, theme: viewer.theme } : null;
    const csvBlocks = [];
    for (let i = 0; i < rooms.length; i++) {
      const { g, st, fi } = rooms[i]; const th = st.theme || theme; const fin = st.fin; const items = st.items; const bq = boqs[i];
      const label = `${fi ? 'FF' : 'GF'} ${g.name}`; const slug = `${String(i + 1).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      status(`Room ${i + 1} of ${rooms.length}: ${g.name} — renders…`); await tick();
      let shot = null, eye = null; if (viewer) { viewer.setRoom(g, items, fin, th); shot = viewer.snapshot(1500, 1000, 'corner'); if (!g.open) eye = viewer.snapshot(1200, 800, 'eye'); }
      status(`Room ${i + 1} of ${rooms.length}: ${g.name} — drawings…`); await tick();
      const elec = DT.electrical(g, items); const cl = DT.ceiling(g, items); const flr = DT.flooring(g, fin); const sp = DT.specs(g, items, fin, th);
      const dw = { plan: DT.planSVG(g, items, th, fin) }; if (!g.open) { DT.elevations(g, items, th, fin, elec).forEach(e => { dw['elev-' + e.side] = e.svg; }); dw.rcp = DT.ceilingSVG(g, items, cl); dw.electrical = DT.electricalSVG(g, items, th, elec, cl); } dw.flooring = flr.svg;
      Object.entries(dw).forEach(([k, v]) => files.push({ path: `drawings/${slug}/${k}.svg`, text: v }));
      const cv = {}; for (const [k, v] of Object.entries(dw)) cv[k] = await X.svgToCanvas(v, k === 'plan' ? 1400 : 1000, pal);
      if (shot) files.push({ path: `images/rooms/${slug}-3d.jpg`, blob: await X.dataURLBlob(shot) }); if (eye) files.push({ path: `images/rooms/${slug}-eye-level.jpg`, blob: await X.dataURLBlob(eye) });
      const sub = `${I.ft(g.W)} x ${I.ft(g.H)} · ${Math.round(g.area)} sq ft · ${st.done || st.touched ? 'Designed by you' : 'Auto-designed by BuildMe'} · ${I.THEMES[th].n} theme`;
      toc.push({ label, page: page + 1 });
      // 1 — overview
      head(label, sub, 'overview');
      let y = 27; if (shot) { const r = Math.min((W - 2 * M) / 1500, 112 / 1000); img(shot, M, y, 1500 * r, 1000 * r); y += 1000 * r + 4; }
      const colW = (W - 2 * M - 6) / 2; let yl = y, yr = y;
      if (eye) { caption('Walk-in view (eye level, 5\'-0")', M, yl + 2); const r = Math.min(colW / 1200, 70 / 800); img(eye, M, yl + 4, 1200 * r, 800 * r); yl += 800 * r + 8; }
      const fl = I.FLOORS[fin.floor], wl = I.WALLS[fin.wall]; const xr = eye ? M + colW + 6 : M;
      caption('Finishes', xr, yr + 2); doc.setFontSize(7.8); doc.setTextColor(...ink); yr += 8; sw(fl.color, xr, yr); doc.text(doc.splitTextToSize(`Floor: ${fl.n}`, colW - 8), xr + 7, yr); yr += 6; if (!g.open) { sw(wl.color, xr, yr); doc.text(`Walls: ${wl.n} (${wl.color})`, xr + 7, yr); yr += 6; } sw(T.wood, xr, yr); sw(T.soft, xr + 6, yr); sw(T.accent, xr + 12, yr); sw(T.light, xr + 18, yr); doc.text(`${I.THEMES[th].n} palette`, xr + 25, yr); yr += 8;
      caption('Space planning checks', xr, yr); yr += 5; doc.setFontSize(7.4);
      I.spaceCheck(g, items).forEach(c => { const col = c.s === 'ok' ? [22, 134, 90] : c.s === 'warn' ? [183, 112, 14] : [194, 57, 45]; doc.setFillColor(...col); doc.circle(xr + 1.2, yr - 1.1, 1, 'F'); doc.setTextColor(...ink); const t = doc.splitTextToSize(fx(c.text), colW - 5); _t(t, xr + 4, yr); yr += t.length * 3.2 + 1; });
      // 2 — furniture plan + schedule
      head(`${label} — furniture layout`, 'Dimensioned plan with clear zones (dashed), walkways and opening sizes. Tags refer to the schedule below.', 'plan');
      const pr = fitCanvas(cv.plan, M, 26, W - 2 * M, 128); y = 26 + pr.h + 6;
      const tag = DT.tags(items); const legend = {}; items.forEach(it => { const n = tag(it); const s = I.F[it.k]; if (!s) return; const L = legend[n] || (legend[n] = { n, name: s.n + (it.sink ? ' with sink' : '') + (it.hob ? (it.sink ? ' & hob' : ' with hob') : ''), size: `${I.ft(it.w)} x ${I.ft(it.d)} x ${I.ft(s.h + (s.hb ? s.hb - s.h : 0))}`, spec: I.itemSpec(it, th), qty: 0, lo: 0, hi: 0 }); L.qty++; const p = I.itemPrice(it, th); L.lo += p[0]; L.hi += p[1]; });
      caption('Furniture & fittings schedule', M, y); y += 4;
      table([{ t: '#', w: 7 }, { t: 'Item', w: 44 }, { t: 'Size W x D x H', w: 30 }, { t: 'Specification', w: 70 }, { t: 'Qty', w: 9, align: 'right' }, { t: 'PKR', w: 22, align: 'right' }],
        Object.values(legend).sort((a, b) => a.n - b.n).map(r => [r.n, r.name, r.size, r.spec, r.qty, r.hi ? `${num(r.lo / 1000)}-${num(r.hi / 1000)}k` : '-']), y, () => head(`${label} — schedule (continued)`, '', 'plan'));
      if (!g.open) {
        // 3 — elevations
        head(`${label} — wall elevations`, 'Viewed from inside the room. Heights: false ceiling, door head 7\'-0", window sill 3\'-0", switches 4\'-0", sockets 1\'-0".', 'elevations');
        const ew = (W - 2 * M - 6) / 2, eh = (H - 26 - 20) / 2 - 4; ['N', 'E', 'S', 'W'].forEach((s2, j) => { const c = cv['elev-' + s2]; if (c) fitCanvas(c, M + (j % 2) * (ew + 6), 26 + Math.floor(j / 2) * (eh + 6), ew, eh); });
        // 4 — services
        head(`${label} — ceiling, lighting, electrical & flooring`, cl.note, 'services');
        caption('Reflected ceiling & lighting plan', M, 29); const r1 = fitCanvas(cv.rcp, M, 31, ew, 92); caption('Electrical layout', M + ew + 6, 29); const r2 = fitCanvas(cv.electrical, M + ew + 6, 31, ew, 92);
        y = 31 + Math.max(r1.h, r2.h) + 7; caption('Flooring layout', M, y); const r3 = fitCanvas(cv.flooring, M, y + 2, ew, H - y - 22);
        let yy = y; const xx = M + ew + 6; caption('Lighting', xx, yy); yy += 4.5; doc.setFontSize(7.4); doc.setTextColor(...ink);
        const lc = {}; cl.lights.forEach(l => { lc[l.type] = (lc[l.type] || 0) + 1; }); const LN = { down: '9 W LED downlight, 3000 K', fan: '56" ceiling fan with light kit', chandelier: 'Chandelier (feature)', pendant: 'Pendant over table', cove: 'LED cove strip 12 W/m, 3000 K', exhaust: 'Exhaust fan 8"', hood: 'Kitchen hood (see kitchen)', batten: 'LED batten 20 W', wall: 'Outdoor wall light' };
        Object.entries(lc).forEach(([k, n]) => { doc.text(`${k === 'cove' ? '' : n + ' x '}${LN[k] || k}`, xx, yy); yy += 4; });
        yy += 2; caption('Electrical points', xx, yy); yy += 4.5; doc.setFontSize(7.4); const ec = {}; elec.forEach(e => { ec[e.label] = (ec[e.label] || 0) + 1; }); Object.entries(ec).forEach(([k, n]) => { if (yy > H - 20) return; doc.text(`${n} x ${k}`, xx, yy); yy += 3.8; });
        yy += 2; caption('Flooring', xx, yy); yy += 4.5; doc.setFontSize(7.4); doc.text(doc.splitTextToSize(fx(`${flr.fl.spec}. Area ${Math.round(flr.area)} sq ft, order ${Math.round(flr.order)} sq ft (${flr.pieces} pcs${flr.perTile ? ' @ ' + flr.perTile + ' sq ft' : ''})${flr.skirting ? `, skirting ${Math.round(flr.skirting)} rft` : ''}.`), ew), xx, yy); void r3;
      } else { y = 26; }
      // 5 — specs + BOQ
      head(`${label} — specifications & bill of quantities`, `Room total ${range(bq.total)}`, 'BOQ');
      y = table([{ t: 'Element', w: 32 }, { t: 'Specification', w: 150 }], sp.surfaces, 30, () => head(`${label} — specifications (continued)`, '', 'BOQ'));
      y += 4; if (y > H - 50) { head(`${label} — bill of quantities`, '', 'BOQ'); y = 30; } caption('Bill of quantities', M, y); y += 4;
      y = table([{ t: 'Code', w: 13 }, { t: 'Description', w: 82 }, { t: 'Unit', w: 10 }, { t: 'Qty', w: 12, align: 'right' }, { t: 'Rate PKR', w: 30, align: 'right' }, { t: 'Amount PKR', w: 35, align: 'right' }],
        bq.rows.map(r => [r.code, r.desc, r.unit, r.qty, `${num(r.rate[0])}-${num(r.rate[1])}`, `${num(r.amt[0])}-${num(r.amt[1])}`]).concat([Object.assign(['', 'Room total', '', '', '', `${num(bq.total[0])}-${num(bq.total[1])}`], { bold: true })]), y, () => head(`${label} — bill of quantities (continued)`, '', 'BOQ'));
      csvBlocks.push({ room: label, rows: bq.rows });
    }
    if (viewer && keep) viewer.setRoom(keep.g, keep.items, keep.fin, keep.theme);
    // house summary
    head('Bill of quantities — summary', 'All rooms; amounts are low-high ranges in PKR');
    let y = table([{ t: 'Room', w: 70 }, { t: 'Status', w: 22 }, { t: 'Lines', w: 14, align: 'right' }, { t: 'Amount PKR', w: 76, align: 'right' }],
      rooms.map((x, i) => [`${x.fi ? 'FF' : 'GF'} ${x.g.name}`, x.st.done || x.st.touched ? 'Designed' : 'Auto', boqs[i].rows.length, `${num(boqs[i].total[0])} - ${num(boqs[i].total[1])}`]), 30, () => head('Bill of quantities — summary (continued)', ''));
    y += 4; caption('By trade', M, y); y += 4;
    y = table([{ t: 'Trade', w: 106 }, { t: 'Amount PKR', w: 76, align: 'right' }], Object.entries(trades).sort((a, b) => b[1][1] - a[1][1]).map(([k, v]) => [k, `${num(v[0])} - ${num(v[1])}`]).concat([Object.assign(['Total interior budget', `${num(total[0])} - ${num(total[1])}`], { bold: true })]), y, () => head('Bill of quantities — summary (continued)', ''));
    doc.setFontSize(7.4); doc.setTextColor(...muted); doc.text(doc.splitTextToSize('Rates are 2026 Lahore/Islamabad/Karachi market ranges for supply and installation at the selected theme level, excluding GST, design fees, civil changes, air-conditioner units and loose decor. Get three quotations per trade before awarding work.', W - 2 * M), M, Math.min(H - 24, y + 4));
    status('Packing the 3D model…'); await tick();
    let glb = null; try { glb = await houseGLB(plan, ctx.getRoom, theme); } catch (e) { glb = null; }
    files.push({ path: 'boq.csv', text: DT.boqCSV(csvBlocks) });
    const pdfBlob = doc.output('blob');
    const json = { generator: 'BuildMe interiors', project: ctx.project, theme, authority: ctx.authority, total_pkr: total.map(Math.round), rooms: rooms.map((x, i) => ({ floor: x.fi, name: x.g.name, type: x.g.t, size_ft: [+x.g.W.toFixed(2), +x.g.H.toFixed(2)], status: x.st.done || x.st.touched ? 'designed' : 'auto', finishes: x.st.fin, items: x.st.items.map(it => ({ type: it.k, name: (I.F[it.k] || {}).n, x: it.cx, y: it.cy, w: it.w, d: it.d, rot: it.rot })), boq_pkr: boqs[i].total.map(Math.round) })) };
    return { pdf: pdfBlob, files, glb, json, total, pages: page };
  }

  root.BuildMeInterior3D = { RoomViewer, roomGroup, model, houseGLB, buildPackage, kit };
})(typeof window !== 'undefined' ? window : globalThis);
