/* BuildMe 3D — massing model extruded from the plan, with architectural style treatments.
   Requires THREE (r128) and THREE.OrbitControls. Units: feet. Plan x → X, plan y (depth from road) → Z. */
(function (root) {
  'use strict';
  const PLINTH = 1, FLR = 11, PARA = 3, MUMTY = 8;
  // Elevation styles common in Pakistani housing (Islamabad / Lahore practice)
  const STYLES = {
    massing:      { name: 'Massing',      wall: 0xf1f0ec, roof: 0xe6e5e0, glass: 0xc7ced1, frame: null,     trim: null,     accent: null, ground: 'model', roofType: 'flat', windows: 'rect', parapet: 'solid', columns: 'square', chajja: 0, cornice: false, premium: 0,
                    blurb: 'Plain volumes to judge size, height and setbacks before choosing an elevation.' },
    modern:       { name: 'Modern',       wall: 0xf3f3f0, roof: 0xdcdcd8, glass: 0x4c6878, frame: 0x2a2c2e, trim: 0x3d4043, accent: 0x9a9184, accentAt: 'gfFront', ground: 'real', roofType: 'flat', windows: 'tall', parapet: 'glass', columns: 'slim', chajja: 0, cornice: false, canopy: true,
                    frame3d: 0x3d4043, louvers: 0x8b5a3c, premium: 0.05,
                    blurb: 'Flat roof, projecting first-floor frame, wooden louvers, stone base, large glazing.' },
    contemporary: { name: 'Contemporary', wall: 0xe8e1d4, roof: 0xd6cfc2, glass: 0x5c7586, frame: 0x3a3a3a, trim: 0xf6f4ef, accent: 0x8e877d, accentAt: 'gfFront', ground: 'real', roofType: 'flat', windows: 'rect', parapet: 'solid', columns: 'square', chajja: 2.2, cornice: false, bands: true,
                    frame3d: 0xf6f4ef, premium: 0.04,
                    blurb: 'Hybrid of traditional and modern: stone veneer, textured plaster, deep sunshades and slab bands.' },
    spanish:      { name: 'Spanish',      wall: 0xf3e6cc, roof: 0xb1532e, glass: 0x5f747c, frame: 0x5a3a24, trim: 0x8a3b22, accent: null, ground: 'real', roofType: 'hip', windows: 'arch', parapet: 'iron', columns: 'round', chajja: 0, cornice: true, premium: 0.07,
                    blurb: 'White stucco, clay-tile hipped roofs with eaves, arched windows, wrought-iron railings.' },
    minimalist:   { name: 'Minimalist',   wall: 0xf6f6f4, roof: 0xe4e4e1, glass: 0x56636b, frame: 0x6b6f72, trim: 0x8d9195, accent: 0x8d9195, accentAt: 'ffFront', ground: 'real', roofType: 'flat', windows: 'rect', parapet: 'solid', columns: 'square', chajja: 0, cornice: false, premium: 0,
                    blurb: 'Geometric white and grey boxes, flush windows, no ornament — the most economical elevation.' },
    french:       { name: 'French',       wall: 0xf4efe6, roof: 0x5c636b, glass: 0x52697a, frame: 0xffffff, trim: 0xffffff, accent: null, ground: 'real', roofType: 'hip', windows: 'tall', parapet: 'solid', columns: 'round', chajja: 0, cornice: true, shutters: 0x5c636b, premium: 0.06,
                    blurb: 'Symmetrical, neutral colours, tall aligned windows with white trim, slate-grey hipped roof.' },
    industrial:   { name: 'Industrial',   wall: 0x9a5a43, roof: 0x8f8f8b, glass: 0x3f515b, frame: 0x1f2224, trim: 0xa3a39e, accent: 0xa3a39e, accentAt: 'ffFront', ground: 'real', roofType: 'flat', windows: 'tall', parapet: 'solid', columns: 'slim', chajja: 0, cornice: false, bands: true,
                    louvers: 0x6e4a33, premium: 0.05,
                    blurb: 'Exposed brick with concrete bands, black steel frames, large glass and timber accents.' },
  };

  function boundary(rects) {
    const E = 0.05, out = [];
    const sub = (a, b, cuts) => { let segs = [[a, b]]; cuts.forEach(([c0, c1]) => { const nx = []; segs.forEach(([s0, s1]) => { if (c1 <= s0 + E || c0 >= s1 - E) nx.push([s0, s1]); else { if (c0 > s0 + E) nx.push([s0, c0]); if (c1 < s1 - E) nx.push([c1, s1]); } }); segs = nx; }); return segs; };
    rects.forEach(r => {
      const edges = [
        { o: 'h', at: r.y, a: r.x, b: r.x + r.w, n: -1, cut: rects.filter(q => q !== r && Math.abs(q.y + q.h - r.y) < E).map(q => [q.x, q.x + q.w]) },
        { o: 'h', at: r.y + r.h, a: r.x, b: r.x + r.w, n: 1, cut: rects.filter(q => q !== r && Math.abs(q.y - (r.y + r.h)) < E).map(q => [q.x, q.x + q.w]) },
        { o: 'v', at: r.x, a: r.y, b: r.y + r.h, n: -1, cut: rects.filter(q => q !== r && Math.abs(q.x + q.w - r.x) < E).map(q => [q.y, q.y + q.h]) },
        { o: 'v', at: r.x + r.w, a: r.y, b: r.y + r.h, n: 1, cut: rects.filter(q => q !== r && Math.abs(q.x - (r.x + r.w)) < E).map(q => [q.y, q.y + q.h]) },
      ];
      edges.forEach(e => sub(e.a, e.b, e.cut).forEach(([a, b]) => { if (b - a > 0.05) out.push({ o: e.o, at: e.at, a, b, n: e.n, room: r }); }));
    });
    return out;
  }
  const onSeg = (segs, o, at, p0, p1) => segs.find(s => s.o === o && Math.abs(s.at - at) < 0.06 && p0 >= s.a - 0.06 && p1 <= s.b + 0.06);

  function Viewer(host) {
    if (!root.THREE || !THREE.OrbitControls) throw new Error('3D library not loaded');
    this.host = host;
    const R = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
    host.appendChild(R.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1.6, 1, 4000);
    this.controls = new THREE.OrbitControls(this.camera, R.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.495; this.controls.minDistance = 20; this.controls.maxDistance = 900;
    this.controls.addEventListener('change', () => this.kick());
    this.style = 'massing'; this.anim = null; this.raf = 0;
    const ro = new ResizeObserver(() => this.resize()); ro.observe(host);
    this.resize();
  }
  Viewer.prototype.resize = function () {
    const w = this.host.clientWidth || 600, h = this.host.clientHeight || 400;
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.kick();
  };
  Viewer.prototype.kick = function () {
    if (this.raf) return;
    const loop = () => {
      this.raf = 0; let more = this.controls.update();
      if (this.anim) {
        const t = Math.min(1, (performance.now() - this.anim.t0) / this.anim.dur); const e = 1 - Math.pow(1 - t, 3);
        this.anim.parts.forEach((g, i) => { const k = Math.max(0, Math.min(1, e * this.anim.parts.length - i)); g.scale.y = Math.max(0.001, k); g.visible = k > 0.001; });
        if (t >= 1) this.anim = null; else more = true;
        if (this.onAnim) this.onAnim(t);
      }
      this.renderer.render(this.scene, this.camera);
      if (more) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };
  Viewer.prototype.setPlan = function (plan, style, animate) {
    const first = !this.plan || this.plan.plot.w !== plan.plot.w || this.plan.plot.d !== plan.plot.d;
    this.plan = plan; if (style) this.style = style;
    this.build(this.scene, plan, STYLES[this.style]);
    if (first) this.view('aerial');
    if (animate && !(root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      this.anim = { t0: performance.now(), dur: 1500, parts: this.parts };
      this.parts.forEach(g => { g.scale.y = 0.001; g.visible = false; });
    }
    this.kick();
  };
  Viewer.prototype.setStyle = function (k) { this.style = k; if (this.plan) { this.build(this.scene, this.plan, STYLES[k]); this.kick(); } };
  Viewer.prototype.view = function (name) {
    const p = this.plan; if (!p) return; const w = p.plot.w, d = p.plot.d, E = p.E;
    const cx = w / 2, cz = E.y0 + p.D / 2, span = Math.max(w, d);
    const t = new THREE.Vector3(cx, 10, cz);
    let pos;
    if (name === 'street') { t.set(cx, 13, E.y0 + 4); pos = new THREE.Vector3(cx + w * 0.35, 5.5, -Math.max(30, w * 0.9)); }
    else if (name === 'rear') pos = new THREE.Vector3(cx - w * 0.8 - 15, span * 0.55 + 20, d + span * 0.55 + 20);
    else if (name === 'top') { pos = new THREE.Vector3(cx, span * 1.7 + 40, cz + 0.01); }
    else pos = new THREE.Vector3(cx + w * 0.85 + 22, span * 0.5 + 26, -(span * 0.45 + 30));
    this.camera.position.copy(pos); this.controls.target.copy(t); this.controls.update(); this.kick();
  };
  Viewer.prototype.snapshot = function (styleKey, w, h, type) {
    const keep = this.style; const R = this.renderer; const size = new THREE.Vector2(); R.getSize(size);
    if (styleKey && styleKey !== keep) this.build(this.scene, this.plan, STYLES[styleKey]);
    R.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    R.render(this.scene, this.camera); const url = R.domElement.toDataURL(type || 'image/jpeg', 0.92);
    R.setSize(size.x, size.y, false); this.camera.aspect = size.x / size.y; this.camera.updateProjectionMatrix();
    if (styleKey && styleKey !== keep) this.build(this.scene, this.plan, STYLES[keep]);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.kick(); return url;
  };

  Viewer.prototype.renderView = function (styleKey, viewName, w, h, type) {
    const pos = this.camera.position.clone(), tgt = this.controls.target.clone();
    if (viewName) this.view(viewName);
    const url = this.snapshot(styleKey, w, h, type);
    this.camera.position.copy(pos); this.controls.target.copy(tgt); this.controls.update(); this.kick();
    return url;
  };
  Viewer.prototype.exportGLB = function (styleKey) {
    const keep = this.style; const self = this;
    if (styleKey && styleKey !== keep) this.build(this.scene, this.plan, STYLES[styleKey]);
    return new Promise((resolve, reject) => {
      if (!THREE.GLTFExporter) { reject(new Error('GLB exporter not loaded')); return; }
      const root3 = new THREE.Group(); const kids = this.scene.children.filter(o => o.isMesh || o.isGroup);
      kids.forEach(o => root3.add(o.clone()));
      new THREE.GLTFExporter().parse(root3, res => {
        if (styleKey && styleKey !== keep) self.build(self.scene, self.plan, STYLES[keep]);
        self.kick(); resolve(res);
      }, { binary: true, onlyVisible: true });
    });
  };

  // ---------------- scene construction ----------------
  Viewer.prototype.build = function (scene, plan, S) {
    while (scene.children.length) { const c = scene.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const M = {}; const mat = (key, color, opt) => M[key] || (M[key] = new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(color).convertSRGBToLinear(), roughness: 0.88, metalness: 0 }, opt || {})));
    const model = S.ground === 'model';
    const wallM = mat('wall', S.wall), roofM = mat('roof', S.roof), glassM = mat('glass', S.glass, { roughness: 0.12, metalness: 0.35 });
    const frameM = S.frame != null ? mat('frame', S.frame, { roughness: 0.5 }) : null, trimM = S.trim != null ? mat('trim', S.trim, { roughness: 0.7 }) : wallM;
    const accentM = S.accent != null ? mat('accent', S.accent, { roughness: 0.8 }) : null;
    const tileM = mat('tile', S.roof, { roughness: 0.75 });

    scene.background = new THREE.Color(model ? 0xeef0ef : 0xe4eefa);
    scene.fog = new THREE.Fog(scene.background, 260, 900);
    scene.add(new THREE.HemisphereLight(0xffffff, model ? 0xb8b8b0 : 0x6f7f62, model ? 0.55 : 0.5));
    const sun = new THREE.DirectionalLight(0xfff1dc, model ? 0.9 : 1.25);
    const p = plan, W = p.plot.w, D = p.plot.d, E = p.E;
    sun.position.set(W / 2 - 70, 110, -60); sun.target.position.set(W / 2, 0, D / 2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; const span = Math.max(W, D) * 0.9 + 30;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 10; sc.far = 500; sun.shadow.bias = -0.0005;
    scene.add(sun); scene.add(sun.target);

    const add = (m, g) => { m.castShadow = true; m.receiveShadow = true; (g || scene).add(m); return m; };
    const box = (x0, y0, z0, x1, y1, z1, m, g) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, x1 - x0), Math.max(0.01, y1 - y0), Math.max(0.01, z1 - z0)), m); mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return add(mesh, g); };
    // segment helper: a slab lying on a wall segment, offset outward
    const onWall = (s, a0, a1, y0, y1, off, depth, m, g) => {
      const c = s.at + s.n * off;
      return s.o === 'h' ? box(a0, y0, c - depth / 2, a1, y1, c + depth / 2, m, g) : box(c - depth / 2, y0, a0, c + depth / 2, y1, a1, m, g);
    };

    // ground, road, drive
    const gM = mat('ground', model ? 0xe4e5e1 : 0x95b27e), lot = mat('lot', model ? 0xe9eae6 : 0xa5c08f);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 600, D + 600), gM); ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -0.05, D / 2); ground.receiveShadow = true; scene.add(ground);
    const plotG = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lot); plotG.rotation.x = -Math.PI / 2; plotG.position.set(W / 2, 0.01, D / 2); plotG.receiveShadow = true; scene.add(plotG);
    box(-300, -0.04, -30, W + 300, 0.02, -6, mat('road', model ? 0xcfd1ce : 0x55595d));
    box(-300, 0, -6, W + 300, 0.5, 0, mat('kerb', model ? 0xdedfdb : 0xc9c6bf));
    const porch = p.floors[0].rooms.find(r => r.t === 'porch');
    if (porch) box(porch.x, 0.02, 0, porch.x + porch.w, 0.09, porch.y, mat('pave', model ? 0xd9dad6 : 0xbdb8ae));

    // boundary wall with gate opening
    const bwM = mat('bwall', model ? 0xe0e0db : 0xd8d2c6), bh = 5, bt = 0.6;
    const gx0 = porch ? porch.x + 0.3 : W / 2 - 5, gx1 = porch ? porch.x + porch.w - 0.3 : W / 2 + 5;
    box(0, 0, 0, gx0, bh - 1, bt, bwM); box(gx1, 0, 0, W, bh - 1, bt, bwM);
    box(0, 0, 0, bt, bh, D, bwM); box(W - bt, 0, 0, W, bh, D, bwM); box(0, 0, D - bt, W, bh, D, bwM);
    if (!model) box(gx0, 0.2, 0.1, gx1, 4.5, 0.4, mat('gate', S.frame != null ? S.frame : 0x333333, { roughness: 0.4, metalness: 0.5 }));

    // neighbours (context)
    const ghost = mat('ghost', model ? 0xf6f6f3 : 0xe7e4dd, { transparent: true, opacity: model ? 0.55 : 0.6 });
    [-1, 1].forEach(sx => { const x0 = sx < 0 ? -W + E.x0 : W + E.x0; box(x0, 0, E.y0, x0 + E.W, PLINTH + FLR * 2 + PARA, E.y0 + p.D, ghost).castShadow = false; });

    // trees
    if (!model) {
      const trunk = mat('trunk', 0x6b4f37), leaf = mat('leaf', 0x5f8a4a, { roughness: 1 });
      const tree = (x, z, s) => { add(new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.45 * s, 7 * s, 6), trunk)).position.set(x, 3.5 * s, z); add(new THREE.Mesh(new THREE.IcosahedronGeometry(3.6 * s, 1), leaf)).position.set(x, 9 * s, z); };
      const rear = D - (E.y0 + p.D);
      if (E.y0 >= 9) tree(porch && porch.x < W / 2 ? W - 4.5 : 4.5, E.y0 / 2 + 1, Math.min(1, E.y0 / 14));
      if (rear >= 9) tree(W * 0.25, D - rear / 2, Math.min(1, rear / 14));
    }

    // ---------- building ----------
    const parts = [];
    const g0 = new THREE.Group(), g1 = new THREE.Group(), g2 = new THREE.Group(); scene.add(g0); scene.add(g1); scene.add(g2); parts.push(g0, g1, g2);
    g1.position.y = PLINTH + FLR; g2.position.y = PLINTH + FLR * (p.floors.length);
    const RT = root.BuildMe.RT;
    const levels = p.floors.map((f, fi) => {
      const enc = f.rooms.filter(r => !RT[r.t].open);
      return { f, fi, enc, segs: boundary(enc) };
    });
    // plinth
    box(E.x0 - 0.3, 0, E.y0 - 0.3, E.x0 + E.W + 0.3, PLINTH, E.y0 + p.D + 0.3, mat('plinth', model ? 0xe7e6e1 : 0xb9b2a6), g0);

    levels.forEach(L => {
      const g = L.fi === 0 ? g0 : g1; const base = L.fi === 0 ? PLINTH : 0; const top = base + FLR;
      // room volumes
      L.enc.forEach(r => box(r.x, base, r.y, r.x + r.w, top, r.y + r.h, wallM, g));
      // accent cladding
      if (accentM) {
        const front = L.segs.filter(s => s.o === 'h' && s.n === -1);
        if (S.accentAt === 'gfFront' && L.fi === 0) front.forEach(s => onWall(s, s.a, s.b, base, top, 0.06, 0.12, accentM, g));
        if (S.accentAt === 'ffFront' && L.fi === 1 && front.length) { const s = front.slice().sort((a, b) => (b.b - b.a) - (a.b - a.a))[0]; onWall(s, s.a, s.b, base, top, 0.06, 0.12, accentM, g); }
      }
      // cornice / bands
      if (S.cornice || S.bands) L.segs.forEach(s => onWall(s, s.a - (S.cornice ? 0.4 : 0), s.b + (S.cornice ? 0.4 : 0), top - (S.cornice ? 0.7 : 0.9), top, S.cornice ? 0.35 : 0.25, S.cornice ? 0.7 : 0.5, S.cornice ? trimM : trimM, g));
      // windows
      const fl = L.f;
      fl.windows.forEach(w => {
        const s = onSeg(L.segs, w.orient, w.at, w.p0, w.p1); if (!s) return;
        const len = w.p1 - w.p0, vent = len < 2.6;
        const tall = S.windows === 'tall' && !vent;
        const y0 = base + (vent ? 6.2 : tall ? 1.2 : 3), y1 = vent ? y0 + 1.6 : tall ? base + 9 : y0 + 4.6;
        onWall(s, w.p0, w.p1, y0, y1, 0.1, 0.16, glassM, g);
        if (frameM) {
          const f = 0.22, dp = 0.3;
          onWall(s, w.p0 - f, w.p1 + f, y0 - f, y0, 0.12, dp, frameM, g); onWall(s, w.p0 - f, w.p1 + f, y1, y1 + f, 0.12, dp, frameM, g);
          onWall(s, w.p0 - f, w.p0, y0, y1, 0.12, dp, frameM, g); onWall(s, w.p1, w.p1 + f, y0, y1, 0.12, dp, frameM, g);
          if (!vent && len > 3.2) onWall(s, (w.p0 + w.p1) / 2 - 0.08, (w.p0 + w.p1) / 2 + 0.08, y0, y1, 0.14, 0.2, frameM, g);
        }
        if (S.windows === 'arch' && !vent) {
          const r = len / 2 + (frameM ? 0.22 : 0);
          // half-disc arch head in the wall plane, flat side down
          const half = (rad, dep) => { const geo = new THREE.CylinderGeometry(rad, rad, dep, 20, 1, false, 0, Math.PI); geo.rotateX(Math.PI / 2); geo.rotateZ(Math.PI / 2); if (s.o === 'v') geo.rotateY(Math.PI / 2); return geo; };
          const mid = (w.p0 + w.p1) / 2, yb = y1 + (frameM ? 0.22 : 0);
          [[half(r, 0.3), frameM || trimM, 0.12], [half(len / 2 - 0.05, 0.2), glassM, 0.16]].forEach(([geo, mm, off]) => {
            const m = new THREE.Mesh(geo, mm); const c = s.at + s.n * off;
            if (s.o === 'h') m.position.set(mid, yb, c); else m.position.set(c, yb, mid);
            add(m, g);
          });
        }
        if (S.chajja && !vent) onWall(s, w.p0 - 0.6, w.p1 + 0.6, y1 + (S.windows === 'arch' ? len / 2 + 0.4 : 0.5), y1 + (S.windows === 'arch' ? len / 2 + 0.75 : 0.85), S.chajja / 2, S.chajja, trimM === wallM ? wallM : trimM, g);
        if (S.shutters && !vent && len >= 3) { const sh = mat('shut', S.shutters); onWall(s, w.p0 - 1.3, w.p0 - 0.3, y0, y1, 0.1, 0.12, sh, g); onWall(s, w.p1 + 0.3, w.p1 + 1.3, y0, y1, 0.1, 0.12, sh, g); }
      });
      // doors to the outside (entry from porch)
      fl.doors.forEach(d => {
        if (!(d.kind === 'entry' || d.a === 'out')) return;
        const s = onSeg(L.segs, d.orient, d.at, d.p0, d.p1); if (!s) return;
        onWall(s, d.p0, d.p1, base, base + 7.5, 0.08, 0.2, mat('door', S.frame != null ? (S.name === 'Modern' ? 0x6e4a33 : S.frame) : 0xd5d4cf, { roughness: 0.6 }), g);
      });
      // roof slab of this level
      L.enc.forEach(r => box(r.x, top, r.y, r.x + r.w, top + 0.6, r.y + r.h, roofM, g));
    });

    // signature massing elements of Pakistani elevations: projecting first-floor frame, vertical louvers
    if (levels.length > 1 && (S.frame3d != null || S.louvers != null)) {
      const L = levels[1], front = L.segs.filter(q => q.o === 'h' && q.n === -1).sort((a, b) => (b.b - b.a) - (a.b - a.a));
      const s0 = front[0];
      if (s0 && s0.b - s0.a > 6) {
        if (S.frame3d != null) {
          const fm = mat('frame3d', S.frame3d, { roughness: 0.7 }), out = 2, t = 1.1, y0 = -0.4, y1 = FLR + 1.4;
          onWall(s0, s0.a - t, s0.b + t, y1 - t, y1, out / 2, out, fm, g1);
          onWall(s0, s0.a - t, s0.a, y0, y1, out / 2, out, fm, g1); onWall(s0, s0.b, s0.b + t, y0, y1, out / 2, out, fm, g1);
          onWall(s0, s0.a - t, s0.b + t, y0, y0 + 0.6, out / 2, out, fm, g1);
        }
        if (S.louvers != null) {
          const lm = mat('louver', S.louvers, { roughness: 0.6 }); const a0 = s0.a + (s0.b - s0.a) * 0.55, a1 = s0.b - 0.4;
          const n = Math.max(3, Math.floor((a1 - a0) / 0.9));
          for (let i = 0; i < n; i++) { const a = a0 + (i + 0.5) * (a1 - a0) / n; onWall(s0, a - 0.12, a + 0.12, 0.4, FLR - 0.4, 0.9, 1.1, lm, g1); }
        }
      }
    }
    // porch: columns + slab (not a terrace)
    if (porch) {
      const colM = S.columns === 'slim' ? (frameM || wallM) : trimM === wallM ? wallM : trimM;
      box(porch.x, PLINTH + FLR - 0.2, porch.y, porch.x + porch.w, PLINTH + FLR + 0.6, porch.y + porch.h, S.roofType === 'hip' ? tileM : roofM, g0);
      if (S.canopy) box(porch.x - 0.5, PLINTH + FLR + 0.2, porch.y - 1.5, porch.x + porch.w + 0.5, PLINTH + FLR + 0.6, porch.y + 0.5, frameM || roofM, g0);
      const cols = [[porch.x + 0.6, porch.y + 0.6], [porch.x + porch.w - 0.6, porch.y + 0.6]];
      cols.forEach(([x, z]) => {
        if (S.columns === 'round') { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, FLR - 0.4, 14), colM), g0); c.position.set(x, PLINTH + (FLR - 0.4) / 2 - 0.2, z); box(x - 0.8, PLINTH + FLR - 1.2, z - 0.8, x + 0.8, PLINTH + FLR - 0.6, z + 0.8, colM, g0); }
        else { const t = S.columns === 'slim' ? 0.25 : 0.5; box(x - t, 0, z - t, x + t, PLINTH + FLR - 0.2, z + t, colM, g0); }
      });
    }

    // parapets / railings on every roof edge that people can reach
    const parapet = (segs, y, g, kind) => segs.forEach(s => {
      const inset = 0.3, t = 0.5;
      if (kind === 'glass') { onWall(s, s.a, s.b, y, y + 0.6, -inset, t, wallM, g); onWall(s, s.a, s.b, y + 0.6, y + PARA, -inset, 0.1, mat('rail', 0xbfd3dc, { transparent: true, opacity: 0.35, roughness: 0.1 }), g); onWall(s, s.a, s.b, y + PARA - 0.1, y + PARA + 0.05, -inset, 0.15, frameM || wallM, g); }
      else if (kind === 'balustrade') {
        onWall(s, s.a, s.b, y, y + 0.4, -inset, 0.6, trimM, g); onWall(s, s.a, s.b, y + PARA - 0.35, y + PARA, -inset, 0.7, trimM, g);
        const n = Math.max(2, Math.floor((s.b - s.a) / 0.9)); const geo = new THREE.CylinderGeometry(0.16, 0.2, PARA - 0.75, 6); const im = new THREE.InstancedMesh(geo, trimM, n); const m4 = new THREE.Matrix4();
        for (let i = 0; i < n; i++) { const a = s.a + (i + 0.5) * (s.b - s.a) / n; const c = s.at - s.n * inset; m4.makeTranslation(s.o === 'h' ? a : c, y + 0.4 + (PARA - 0.75) / 2, s.o === 'h' ? c : a); im.setMatrixAt(i, m4); }
        im.castShadow = true; g.add(im);
      } else if (kind === 'iron') {
        const iron = mat('iron', 0x2b2622, { roughness: 0.5, metalness: 0.4 });
        onWall(s, s.a, s.b, y, y + 0.8, -inset, 0.6, wallM, g); onWall(s, s.a, s.b, y + PARA - 0.12, y + PARA, -inset, 0.18, iron, g);
        const n = Math.max(2, Math.floor((s.b - s.a) / 0.6));
        for (let i = 0; i < n; i++) { const a = s.a + (i + 0.5) * (s.b - s.a) / n; onWall(s, a - 0.04, a + 0.04, y + 0.8, y + PARA, -inset, 0.08, iron, g); }
      } else onWall(s, s.a, s.b, y, y + PARA, -inset, t, wallM, g);
    });
    // g1 sits on the ground-floor roof (y = PLINTH+FLR); g2 sits on the first-floor roof
    const topLevel = levels[levels.length - 1]; const roofY = FLR + 0.6; const gTop = g1;
    if (levels.length > 1 || S.roofType !== 'hip') parapet(levels[0].segs, 0.6, g1, S.parapet);
    if (S.roofType === 'hip' && levels.length > 1) {
      // terracotta hip roofs over each run of first-floor rooms
      const runs = {}; topLevel.enc.forEach(r => { const k = r.y.toFixed(2) + '|' + r.h.toFixed(2); (runs[k] = runs[k] || []).push(r); });
      Object.values(runs).forEach(list => {
        list.sort((a, b) => a.x - b.x); let cur = null; const out = [];
        list.forEach(r => { if (cur && Math.abs(cur.x1 - r.x) < 0.06) cur.x1 = r.x + r.w; else { cur = { x0: r.x, x1: r.x + r.w, z0: r.y, z1: r.y + r.h }; out.push(cur); } });
        out.forEach(q => gTop.add(hipRoof(q.x0 - 1.2, q.z0 - 1.2, q.x1 + 1.2, q.z1 + 1.2, roofY, tileM)));
      });
    } else if (levels.length > 1) parapet(topLevel.segs, 0.6, g2, S.parapet);

    // mumty (stair tower) + tank
    const st = p.floors[0].rooms.find(r => r.t === 'stair');
    if (st) {
      const mg = levels.length > 1 ? g2 : g1; const y0 = levels.length > 1 ? 0.6 : 0.6;
      const yb = levels.length > 1 ? 0.6 : 0.6;
      box(st.x, yb - 0.6 + (levels.length > 1 ? 0 : 0), st.y, st.x + st.w, yb + MUMTY, st.y + st.h, wallM, mg);
      box(st.x - 0.6, yb + MUMTY, st.y - 0.6, st.x + st.w + 0.6, yb + MUMTY + 0.5, st.y + st.h + 0.6, S.roofType === 'hip' ? tileM : roofM, mg);
      if (!S.domes) box(st.x + st.w / 2 - 2, yb + MUMTY + 0.5, st.y + 1, st.x + st.w / 2 + 2, yb + MUMTY + 4, st.y + 4.5, mat('tank', model ? 0xe0e0dc : 0x2f3438, { roughness: 0.5 }), mg);
      if (S.domes) {
        const r = Math.min(st.w, st.h) * 0.38; const dome = add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), trimM), mg);
        dome.position.set(st.x + st.w / 2, yb + MUMTY + 0.5 + 0.8, st.y + st.h / 2); box(st.x + st.w / 2 - r, yb + MUMTY + 0.5, st.y + st.h / 2 - r, st.x + st.w / 2 + r, yb + MUMTY + 1.3, st.y + st.h / 2 + r, trimM, mg);
        const fin = add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 2.2, 8), mat('gold', 0xc9a046, { metalness: 0.6, roughness: 0.35 })), mg); fin.position.set(st.x + st.w / 2, yb + MUMTY + 1.3 + r + 1, st.y + st.h / 2);
        // chhatris at the front corners of the top roof
        const xs = topLevel.enc.map(q => [q.x, q.x + q.w]).flat(), z0 = Math.min(...topLevel.enc.map(q => q.y));
        const fronts = topLevel.enc.filter(q => Math.abs(q.y - z0) < 0.1);
        const xa = Math.min(...fronts.map(q => q.x)), xb = Math.max(...fronts.map(q => q.x + q.w));
        [[xa + 2, z0 + 2], [xb - 2, z0 + 2]].forEach(([x, z]) => {
          const yb2 = levels.length > 1 ? 0.6 + PARA : 0.6 + PARA; const cg = levels.length > 1 ? g2 : g1;
          [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => box(x + a * 1.2 - 0.15, yb2 - PARA, z + b * 1.2 - 0.15, x + a * 1.2 + 0.15, yb2 + 3.2, z + b * 1.2 + 0.15, trimM, cg));
          box(x - 1.6, yb2 + 3.2, z - 1.6, x + 1.6, yb2 + 3.6, z + 1.6, trimM, cg);
          const dd = add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), trimM), cg); dd.position.set(x, yb2 + 3.6, z);
        });
      }
    }
    this.parts = parts;
    // height bookkeeping for animation: scale groups from their own base
    parts.forEach(g => g.scale.y = 1);
  };

  function hipRoof(x0, z0, x1, z1, y, m) {
    const w = x1 - x0, d = z1 - z0; const rise = Math.min(6.5, Math.min(w, d) * 0.38);
    let v;
    if (w >= d) { const h = d / 2, zm = (z0 + z1) / 2; const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], Dd = [x0, y, z1], R1 = [x0 + h, y + rise, zm], R2 = [x1 - h, y + rise, zm];
      v = [A, R1, B, B, R1, R2, C, R2, Dd, Dd, R2, R1, Dd, R1, A, B, R2, C, A, B, C, A, C, Dd]; }
    else { const h = w / 2, xm = (x0 + x1) / 2; const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], Dd = [x0, y, z1], R1 = [xm, y + rise, z0 + h], R2 = [xm, y + rise, z1 - h];
      v = [A, R1, B, B, R1, R2, B, R2, C, C, R2, Dd, Dd, R2, R1, Dd, R1, A, A, B, C, A, C, Dd]; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, m.clone()); mesh.material.side = THREE.DoubleSide; mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  }

  root.BuildMe3D = { Viewer, STYLES };
})(this);
