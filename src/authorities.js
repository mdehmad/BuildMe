/* BuildMe — building authorities of Pakistan: residential bylaws as rule bands, standard plot sizes and sources.
   Each authority turns a plot into the same "rules" object the engine already uses for CDA:
   { front, rear, sideL, sideR, cov, far, tower, storeys, height, type, porch, ... }.
   Values come from the published regulations where we could read them (conf: 'official'),
   otherwise from reputable secondary summaries (conf: 'secondary'). Always confirm with the authority. */
(function (root) {
  'use strict';

  const MARLA = 225;          // Punjab / ICT practice (sq ft)
  const MARLA_KP = 272.25;    // KP & Balochistan rules define the marla as 30.25 sq yd
  const YD = 9;

  // ---------- standard plots by region ----------
  const mk = (w, d, common, extra) => Object.assign({ id: `${w}x${d}`, w, d, common, sqft: w * d, sqyd: Math.round(w * d / 9) }, extra || {});
  const PLOTSETS = {
    islamabad: [mk(25, 40, '4 Marla'), mk(25, 50, '5 Marla'), mk(30, 60, '8 Marla'), mk(35, 70, '10 Marla'), mk(40, 80, '14 Marla'), mk(50, 90, '1 Kanal'), mk(50, 100, '1 Kanal+'), mk(60, 120, '1.6 Kanal'), mk(75, 120, '2 Kanal')],
    punjab: [mk(25, 45, '5 Marla'), mk(30, 52, '7 Marla'), mk(30, 60, '8 Marla'), mk(35, 65, '10 Marla'), mk(40, 80, '14 Marla'), mk(50, 90, '1 Kanal'), mk(60, 120, '1.6 Kanal'), mk(75, 120, '2 Kanal')],
    dhaisb: [mk(25, 50, '5 Marla'), mk(30, 60, '8 Marla'), mk(35, 70, '10 Marla'), mk(50, 90, '1 Kanal'), mk(75, 120, '2 Kanal')],
    dhalhr: [mk(25, 45, '5 Marla'), mk(30, 53, '7 Marla'), mk(30, 60, '8 Marla'), mk(35, 65, '10 Marla'), mk(50, 90, '1 Kanal'), mk(75, 120, '2 Kanal')],
    karachi: [mk(30, 36, '120 sq yd'), mk(25, 45, '125 sq yd'), mk(30, 60, '200 sq yd'), mk(40, 54, '240 sq yd'), mk(35, 64, '250 sq yd'), mk(50, 72, '400 sq yd'), mk(50, 90, '500 sq yd'), mk(60, 90, '600 sq yd'), mk(60, 150, '1000 sq yd')],
    kp: [mk(30, 45, '5 Marla'), mk(30, 63, '7 Marla'), mk(35, 78, '10 Marla'), mk(50, 109, '1 Kanal'), mk(75, 145, '2 Kanal')],
  };

  // helpers to build rules
  const band = (list, v) => list.find(b => v < b.upTo) || list[list.length - 1];
  const sides = (s, mode) => mode === 'both' ? [s, s] : mode === 'one' ? [s, 0] : [0, 0];

  // ---------- LDA Building & Zoning Regulations 2019 (approved schemes, cl. 2.2) ----------
  // adopted by RDA (2020), FDA (2020), GDA (2020); MDA and Punjab TMAs follow the same LDA tables in practice.
  const LDA_BANDS = [
    { upTo: 5 * MARLA, label: 'Under 5 marla', front: 5, rear: 5, side: 0, sides: 'none', cov: 0.80, far: 2.4, storeys: 3, height: 38 },
    { upTo: 10 * MARLA, label: '5 to under 10 marla', front: 5, rear: 5, side: 0, sides: 'none', cov: 0.75, far: 2.3, storeys: 3, height: 38 },
    { upTo: 20 * MARLA, label: '10 marla to under 1 kanal', front: 10, rear: 7, side: 5, sides: 'one', cov: 0.70, far: 2.8, storeys: 4, height: 45 },
    { upTo: 30 * MARLA, label: '1 kanal to 30 marla', front: 10, rear: 7, side: 5, sides: 'one', cov: 0.65, far: 2.6, storeys: 4, height: 45 },
    { upTo: 40 * MARLA, label: 'Over 30 marla to under 2 kanal', front: 10, rear: 7, side: 5, sides: 'both', cov: 0.60, far: 2.4, storeys: 4, height: 45 },
    { upTo: Infinity, label: '2 kanal and above', front: 20, rear: 10, side: 10, sides: 'both', cov: 0.55, far: 2.2, storeys: 4, height: 45 },
  ];
  // ---------- Karachi Building & Town Planning Regulations 2002, cl. 25-2.1 (bungalows) ----------
  const KBTPR_BANDS = [
    { upTo: 60 * YD, label: 'Up to 59 sq yd', front: 0, rear: 0, side: 0, sides: 'none', cov: 0.85, far: 2.0 },
    { upTo: 120 * YD, label: '60–119 sq yd', front: 3, rear: 0, side: 0, sides: 'none', cov: 0.85, far: 2.0, note: '5′ × 5′ courtyard at the rear' },
    { upTo: 200 * YD, label: '120–199 sq yd', front: 3, rear: 3, side: 0, sides: 'none', cov: 0.75, far: 2.0 },
    { upTo: 300 * YD, label: '200–299 sq yd', front: 5, rear: 7, side: 5, sides: 'one', cov: 0.65, far: 2.0 },
    { upTo: 400 * YD, label: '300–399 sq yd', front: 5, rear: 7, side: 5, sides: 'one', cov: 0.65, far: 1.8 },
    { upTo: 500 * YD, label: '400–499 sq yd', front: 7.5, rear: 7, side: 5, sides: 'both', cov: 0.55, far: 1.5 },
    { upTo: 1000 * YD, label: '500–999 sq yd', front: 10, rear: 7.5, side: 7, sides: 'both', cov: 0.50, far: 1.0 },
    { upTo: 1500 * YD, label: '1000–1499 sq yd', front: 15, rear: 10, side: 7, sides: 'both', cov: 0.45, far: 1.0 },
    { upTo: Infinity, label: '1500 sq yd and above', front: 15, rear: 10, side: 7, sides: 'both', cov: 0.40, far: 1.0 },
  ];
  // ---------- KP Model Building Bye-laws 2017, ch. 7 (Peshawar TMAs; PDA) — marla = 272.25 ft² ----------
  const KP_BANDS = [
    { upTo: 2 * MARLA_KP, label: 'Up to 2 marla', front: 0, rear: 0, side: 0, sides: 'none', cov: 0.90, far: 2.0, tower: 100, note: '10% open void mandatory' },
    { upTo: 5 * MARLA_KP, label: '2 to under 5 marla', front: 0, rear: 0, side: 0, sides: 'none', cov: 0.90, far: 2.0, tower: 120, note: '10% open void mandatory' },
    { upTo: 8 * MARLA_KP, label: '5 to under 8 marla', front: 7, rear: 5, side: 0, sides: 'none', cov: 0.65, far: 1.8, tower: 120, note: '75% footprint less a 10% open void' },
    { upTo: 10 * MARLA_KP, label: '8 to under 10 marla', front: 10, rear: 10, side: 5, sides: 'one', cov: 0.80, far: 1.25, tower: 140 },
    { upTo: 20 * MARLA_KP, label: '10 marla to under 1 kanal', front: 10, rear: 10, side: 5, sides: 'one', cov: 0.70, far: 1.15, tower: 180 },
    { upTo: 40 * MARLA_KP, label: '1 to under 2 kanal', front: 15, rear: 10, side: 5, sides: 'both', cov: 0.70, far: 1.25, tower: 220 },
    { upTo: Infinity, label: '2 kanal and above', front: 20, rear: 15, side: 10, sides: 'both', cov: 0.60, far: 1.25, tower: 240 },
  ];
  // ---------- Balochistan Building Control & Town Planning Rules 2022, rule 28, table 6.1 ----------
  const BAL_BANDS = [
    { upTo: 2 * MARLA_KP, label: 'Up to 2 marla', front: 0, rear: 0, side: 0, sides: 'none', cov: 0.90, far: 2.0, tower: 100, note: '10% void' },
    { upTo: 5 * MARLA_KP, label: '2–5 marla', front: 0, rear: 0, side: 0, sides: 'none', cov: 0.90, far: 2.0, tower: 120, note: '10% void' },
    { upTo: 8 * MARLA_KP, label: '5–8 marla', front: 7, rear: 5, side: 0, sides: 'none', cov: 0.65, far: 1.8, tower: 120, note: '10% void' },
    { upTo: 10 * MARLA_KP, label: '8–10 marla', front: 10, rear: 10, side: 5, sides: 'one', cov: 0.70, far: 1.25, tower: 140 },
    { upTo: 20 * MARLA_KP, label: '10–20 marla', front: 10, rear: 10, side: 5, sides: 'one', cov: 0.70, far: 1.15, tower: 180 },
    { upTo: 40 * MARLA_KP, label: '20–40 marla (1–2 kanal)', front: 15, rear: 10, side: 5, sides: 'both', cov: 0.70, far: 1.25, tower: 220 },
    { upTo: Infinity, label: 'Over 40 marla', front: 20, rear: 15, side: 10, sides: 'both', cov: 0.60, far: 1.25, tower: 240 },
  ];
  // ---------- DHA Lahore Construction & Development Regulations (Apr/Aug 2026) ----------
  // no coverage %: the ground floor is whatever fits inside the clear spaces; first floor is a % of the ground floor.
  const DHALHR_BANDS = [
    { upTo: 1300, label: '5 marla', front: 5, rear: 3, side: 3, sides: 'both', ff: 1.00, tower: 175 },
    { upTo: 1650, label: '7 marla', front: 7, rear: 3, side: 3, sides: 'both', ff: 0.82, tower: 175 },
    { upTo: 2000, label: '8 marla', front: 8, rear: 4, side: 4, sides: 'both', ff: 0.82, tower: 175 },
    { upTo: 3400, label: '10 marla', front: 10.75, rear: 5.375, side: 5.375, sides: 'both', ff: 0.82, tower: 175 },
    { upTo: 6800, label: '1 kanal', front: 15.75, rear: 5.375, side: 5.375, sides: 'both', ff: 0.80, tower: 300 },
    { upTo: Infinity, label: '2 kanal', front: 20.75, rear: 8.375, side: 5.375, sides: 'both', ff: 0.78, tower: 300 },
  ];
  // ---------- DHA Karachi (PDOHA) Revised Bylaws 2020, cl. 4.1 ----------
  const DHAKHI_BANDS = [
    { upTo: 201 * YD, label: 'Up to 200 sq yd', front: 0, rear: 0, side: 0, sides: 'none', cov: 0.90, tower: 230 },
    { upTo: 401 * YD, label: '201–400 sq yd', front: 5, rear: 3, side: 5, sides: 'one', cov: 0.75, tower: 230 },
    { upTo: 701 * YD, label: '401–700 sq yd', front: 10, rear: 5, side: 5, sides: 'both', cov: 0.65, tower: 230 },
    { upTo: Infinity, label: '701 sq yd and above', front: 20, rear: 10, side: 10, sides: 'both', cov: 0.50, tower: 250 },
  ];
  // ---------- DHA Islamabad–Rawalpindi Byelaws 2022/23 (secondary summary of regs 8.54–8.67) ----------
  const DHAISB_BANDS = [
    { upTo: 2000, label: '5–8 marla', front: 5, rear: 3, side: 0, sides: 'none', cov: 0.85, ff: 1.0, porch: 252 },
    { upTo: 3500, label: '10 marla', front: 10, rear: 3, side: 3, sides: 'both', cov: 0.70, ff: 0.9, porch: 360 },
    { upTo: 7000, label: '1 kanal', front: 15, rear: 5, side: 5, sides: 'both', cov: 0.68, ff: 0.9, porch: 400 },
    { upTo: Infinity, label: '2 kanal', front: 20, rear: 5, side: 5, sides: 'both', cov: 0.60, ff: 0.9, porch: 400 },
  ];
  // ---------- Bahria Town (no published schedule: LDA setbacks + Bahria coverage, per secondary sources) ----------
  const BAHRIA_BANDS = LDA_BANDS.map(b => Object.assign({}, b, { cov: b.upTo <= 10 * MARLA ? 0.75 : 0.70, far: null, storeys: 2, height: 38 }));
  const BAHRIAKHI_BANDS = KBTPR_BANDS.map(b => Object.assign({}, b, { cov: b.upTo <= 200 * YD ? 0.70 : b.upTo <= 300 * YD ? 0.65 : 0.50, far: null }));

  // ---------- the authorities ----------
  const LDA_SRC = { name: 'LDA Building & Zoning Regulations 2019 (amended), cl. 2.2', url: 'https://khalidzafar.com/wp-content/files_mf/1685711737LDAAmendedBuildingRegulations2019.pdf' };
  const A = [
    { id: 'cda', short: 'CDA', name: 'Capital Development Authority', city: 'Islamabad (CDA sectors)', region: 'Islamabad', plots: 'islamabad', conf: 'official',
      source: { name: 'CDA Residential Sectors Zoning (Building Control) Regulation 1993, Schedule A', url: 'https://www.cda.gov.pk/public/Assets/pdf/1699885249_b05cb0e0_abed_43cf_8916_685822960e8d_.pdf' }, kind: 'cda' },
    { id: 'rda', short: 'RDA', name: 'Rawalpindi Development Authority', city: 'Rawalpindi', region: 'Punjab', plots: 'punjab', conf: 'secondary', bands: LDA_BANDS,
      source: { name: 'RDA adopted LDA Building & Zoning Regulations 2019 (Jan 2020)', url: 'https://www.zameen.com/news/rda-to-implement-lda-regulations-in-rawalpindi.html' } },
    { id: 'lda', short: 'LDA', name: 'Lahore Development Authority', city: 'Lahore', region: 'Punjab', plots: 'punjab', conf: 'official', bands: LDA_BANDS, source: LDA_SRC },
    { id: 'fda', short: 'FDA', name: 'Faisalabad Development Authority', city: 'Faisalabad', region: 'Punjab', plots: 'punjab', conf: 'official', bands: LDA_BANDS,
      source: { name: 'FDA Building & Zoning Regulations 2020 (same tables as LDA 2019)', url: 'https://fda.gov.pk/uploads/documents/ruleslaws/tender_fda-building-and-zoning-regulations-2020_3541_16032023035430.pdf' } },
    { id: 'gda', short: 'GDA', name: 'Gujranwala Development Authority', city: 'Gujranwala', region: 'Punjab', plots: 'punjab', conf: 'official', bands: LDA_BANDS,
      source: { name: 'GDA Building & Zoning Regulations 2020 (adopts LDA 2019)', url: 'https://willowy-biscotti-edb769.netlify.app/pdf/GDA%20Building%20and%20Zoning%20Regulations%202020%20(2).pdf' } },
    { id: 'mda', short: 'MDA', name: 'Multan Development Authority', city: 'Multan', region: 'Punjab', plots: 'punjab', conf: 'assumed', bands: LDA_BANDS,
      source: { name: 'Assumed LDA 2019 tables (Punjab HUD&PHE directive); MDA text not found online', url: LDA_SRC.url } },
    { id: 'tma', short: 'TMA', name: 'Tehsil / Municipal Committee (Punjab)', city: 'Other Punjab towns & private schemes', region: 'Punjab', plots: 'punjab', conf: 'assumed', bands: LDA_BANDS,
      source: { name: 'TMAs and private housing schemes follow LDA-style tables in practice (PHS Rules 2010 set no building setbacks)', url: LDA_SRC.url } },
    { id: 'sbca', short: 'SBCA', name: 'Sindh Building Control Authority / KDA', city: 'Karachi', region: 'Sindh', plots: 'karachi', conf: 'official', bands: KBTPR_BANDS, storeys: 3, height: 35,
      porch: { total: 380, inSetback: 380, maxLen: 20, kind: 'up to 380 ft² outside FAR (25-1.4.1)' },
      source: { name: 'Karachi Building & Town Planning Regulations 2002, cl. 25-2.1', url: 'https://rizwanlawassociates.blogspot.com/2016/04/karachi-building-town-planning_19.html' } },
    { id: 'pda', short: 'PDA', name: 'Peshawar Development Authority / KP TMAs', city: 'Peshawar & Khyber Pakhtunkhwa', region: 'Khyber Pakhtunkhwa', plots: 'kp', conf: 'official', bands: KP_BANDS, storeys: 2, height: 30,
      source: { name: 'KP Model Building Bye-laws 2017, chapter 7', url: 'https://lgkp.gov.pk/uploads/2017/06/The-KP-Model-Building-Bye-laws-2017.pdf' } },
    { id: 'qda', short: 'QDA', name: 'Quetta Development Authority / Balochistan', city: 'Quetta & Balochistan', region: 'Balochistan', plots: 'kp', conf: 'official', bands: BAL_BANDS, storeys: 2, height: 30,
      source: { name: 'Balochistan Building Control & Town Planning Rules 2022, rule 28', url: 'https://balochistan.gov.pk/wp-content/uploads/2024/11/Balochistan-Building-Control-And-Town-Planning-Rules-2022-2022.pdf' } },
    { id: 'dhaisb', short: 'DHA I-R', name: 'DHA Islamabad–Rawalpindi', city: 'DHA Islamabad–Rawalpindi', region: 'Societies', plots: 'dhaisb', conf: 'secondary', bands: DHAISB_BANDS, storeys: 2, height: 37,
      source: { name: 'DHA I-R Byelaws 2022 (rev. 2023), regs 8.54–8.67, via architect summary', url: 'https://avenirdevelopments.com/dha-islamabad/dha-phase-2-islamabad/' } },
    { id: 'dhalhr', short: 'DHA Lahore', name: 'DHA Lahore', city: 'DHA Lahore', region: 'Societies', plots: 'dhalhr', conf: 'official', bands: DHALHR_BANDS, storeys: 2, height: 39,
      porch: { total: 162, inSetback: 162, maxLen: 18, kind: 'max 9′ wide × 18′ deep (reg 27)' },
      source: { name: 'DHA Lahore Construction & Development Regulations 2026', url: 'https://dhalahore.org/wp-content/uploads/2026/08/Updated-DHA-Const-Dev-Byelaws-2026.pdf' } },
    { id: 'dhakhi', short: 'DHA Karachi', name: 'DHA Karachi', city: 'DHA Karachi', region: 'Societies', plots: 'karachi', conf: 'official', bands: DHAKHI_BANDS, storeys: 2, height: 32,
      porch: { total: 380, inSetback: 0, maxLen: 20, kind: 'min 10′ × 14′; not in side open space' },
      source: { name: 'DHA Karachi (PDOHA) Revised Bylaws 2020, cl. 4.1', url: 'https://www.dhakarachi.org/wp-content/uploads/2022/07/Revised-DHA-ByLaws-2020-New.pdf' } },
    { id: 'bahriaisb', short: 'Bahria Rwp/Isb', name: 'Bahria Town Rawalpindi–Islamabad', city: 'Bahria Town Rawalpindi–Islamabad', region: 'Societies', plots: 'punjab', conf: 'secondary', bands: BAHRIA_BANDS, storeys: 2, height: 38,
      source: { name: 'Bahria Town SOP 2023–24 (via secondary summaries; LDA setbacks)', url: 'https://avenirdevelopments.com/lahore/bahria-town-lahore/' } },
    { id: 'bahrialhr', short: 'Bahria Lahore', name: 'Bahria Town Lahore', city: 'Bahria Town Lahore', region: 'Societies', plots: 'punjab', conf: 'secondary', bands: BAHRIA_BANDS, storeys: 2, height: 38,
      source: { name: 'Bahria Town Lahore coverage (secondary) with LDA setbacks', url: 'https://pakistanpropertyservices.com.pk/bahria-town-lahore-construction-bylaws/' } },
    { id: 'bahriakhi', short: 'Bahria Karachi', name: 'Bahria Town Karachi', city: 'Bahria Town Karachi', region: 'Societies', plots: 'karachi', conf: 'secondary', bands: BAHRIAKHI_BANDS, storeys: 2, height: 30, noMumty: true,
      porch: { total: 380, inSetback: 0, maxLen: 20, kind: 'min 12′ long, max 380 ft²' },
      source: { name: 'Bahria Town Karachi bylaws (Zameen summary); setbacks from KB&TPR', url: 'https://www.zameen.com/blog/construction-bylaws-bahria-town-karachi.html' } },
  ];
  const byId = Object.fromEntries(A.map(a => [a.id, a]));
  const CONF = { official: 'From the published regulation', secondary: 'From a secondary summary — confirm with the authority', assumed: 'Assumed (same tables as LDA) — confirm with the authority' };

  function plotsFor(id) { const a = byId[id] || byId.cda; return PLOTSETS[a.plots] || PLOTSETS.islamabad; }

  // rules for one plot under one authority (non-CDA). `cdaRules` stays in the engine.
  function rulesFor(plot, id, cdaRules) {
    const a = byId[id] || byId.cda;
    if (a.kind === 'cda' || !a.bands) { const r = cdaRules(plot); return Object.assign(r, { authority: 'cda', auth: 'CDA', authName: a.name, conf: a.conf, source: a.source, band: r.row }); }
    const b = band(a.bands, plot.sqft);
    const [sL, sR] = sides(b.side, b.sides);
    // a side setback that would leave less than 16 ft of house is dropped (narrow plot in a "one side" band)
    const W = plot.w - sL - sR;
    const sideL = W < 16 ? 0 : sL, sideR = W < 16 ? 0 : sR;
    const envelope = Math.max(0, (plot.w - sideL - sideR) * (plot.d - b.front - b.rear));
    const cov = b.cov != null ? b.cov : Math.min(0.95, envelope / plot.sqft);
    const storeys = b.storeys || a.storeys || 2, height = b.height || a.height || 35;
    // FAR: published value; otherwise ground floor + first floor at the stated share (or a full first floor)
    const far = b.far != null ? b.far : +(cov * (1 + (b.ff != null ? b.ff : 1))).toFixed(3);
    const porch = a.porch ? Object.assign({}, a.porch) : b.porch ? { total: b.porch, inSetback: b.porch, maxLen: 18, kind: `up to ${b.porch} ft²` } : { total: 200, inSetback: 0, maxLen: 20, kind: 'inside the building line' };
    return {
      authority: a.id, auth: a.short, authName: a.name, conf: a.conf, source: a.source,
      cat: a.short, row: b.label, band: b.label, type: sideL + sideR > 0 ? 'detached' : 'terraced',
      front: b.front, rear: b.rear, sideL, sideR, cov, far, ff: b.ff,
      tower: a.noMumty ? 0 : (b.tower || null), noMumty: !!a.noMumty,
      storeys, height, designStoreys: 2, units: 1, servantRequired: false, porch, note: b.note || null,
    };
  }

  // brief-parser hints: words → authority id
  const WORDS = [
    [/\bdha\b[^.]*\b(lahore|lhr)\b|\b(lahore|lhr)\b[^.]*\bdha\b/, 'dhalhr'], [/\bdha\b[^.]*\b(karachi|khi)\b|\b(karachi|khi)\b[^.]*\bdha\b/, 'dhakhi'],
    [/\bdha\b[^.]*\b(islamabad|rawalpindi|pindi|isb)\b|\b(islamabad|rawalpindi|pindi)\b[^.]*\bdha\b|\bdha\b/, 'dhaisb'],
    [/\bbahria\b[^.]*\b(lahore|lhr)\b|\b(lahore)\b[^.]*\bbahria\b/, 'bahrialhr'], [/\bbahria\b[^.]*\b(karachi|khi)\b|\bkarachi\b[^.]*\bbahria\b/, 'bahriakhi'], [/\bbahria\b/, 'bahriaisb'],
    [/\b(karachi|kda|sbca)\b/, 'sbca'], [/\b(lahore|lda)\b/, 'lda'], [/\b(rawalpindi|pindi|rda)\b/, 'rda'], [/\b(faisalabad|fda)\b/, 'fda'], [/\b(multan|mda)\b/, 'mda'],
    [/\b(gujranwala|gda)\b/, 'gda'], [/\b(peshawar|pda|hayatabad|kpk?)\b/, 'pda'], [/\b(quetta|qda|balochistan)\b/, 'qda'], [/\b(islamabad|cda)\b/, 'cda'], [/\b(tma|tehsil|municipal)\b/, 'tma'],
  ];
  function detect(text) { const t = ' ' + String(text || '').toLowerCase() + ' '; for (const [re, id] of WORDS) if (re.test(t)) return id; return null; }

  const api = { AUTHORITIES: A, byId, PLOTSETS, CONF, MARLA, MARLA_KP, plotsFor, rulesFor, detect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BuildMeAuth = api;
})(typeof window !== 'undefined' ? window : globalThis);
