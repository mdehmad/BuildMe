/* BuildMe — application shell: dashboard, design assistant, guided questions, workspace, projects, tools */
(function () {
  'use strict';
  const P = window.BuildMe, V = window.BuildMeRender, M3 = window.BuildMe3D, X = window.BuildMeExport;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  const FACING = { N: 'north', E: 'east', S: 'south', W: 'west' };
  const STEP_NAMES = ['Plot', 'House', 'Rooms', 'Review'];
  const fmtN = n => Math.round(n).toLocaleString('en-PK');

  const st = {
    route: 'dashboard', step: 0, plot: null, facing: 'N', corner: false, opts: null, rules: null, seed: 20261020,
    options: [], opt: 0, cur: null, finish: store.get('buildme.finish') || 'standard', hist: [], fut: [], sel: null, floor: 0, tab: 'plans',
    projectId: null, projectName: 'My house', dirty: false,
  };

  // ======================= PROJECTS (browser storage) =======================
  const Projects = {
    all() { try { return JSON.parse(store.get('buildme.projects') || '[]'); } catch (e) { return []; } },
    save(list) { return store.set('buildme.projects', JSON.stringify(list)); },
    upsert(p) { const l = this.all(); const i = l.findIndex(x => x.id === p.id); if (i >= 0) l[i] = p; else l.unshift(p); if (!this.save(l)) { p.thumb = null; if (i >= 0) l[i] = p; return this.save(l); } return true; },
    remove(id) { this.save(this.all().filter(x => x.id !== id)); },
    get(id) { return this.all().find(x => x.id === id); },
  };

  // ======================= ROUTING =======================
  const TITLES = { dashboard: 'Dashboard', new: 'New design', design: 'Design workspace', projects: 'My projects', plots: 'Plot sizes', cost: 'Cost estimator', bylaws: 'CDA bylaws' };
  function go(route, opt) {
    if (route === 'design' && !st.cur) route = 'new';
    st.route = route;
    $$('[data-view]').forEach(s => s.hidden = s.dataset.view !== route);
    $$('.nav [data-route]').forEach(b => b.setAttribute('aria-current', b.dataset.route === route ? 'page' : 'false'));
    $('#page-title').textContent = TITLES[route];
    $('#page-crumb').textContent = route === 'design' && st.plot ? `${st.plot.w} × ${st.plot.d} · ${st.plot.common}` : route === 'new' ? `Step ${st.step + 1} of 4 · ${STEP_NAMES[st.step]}` : '';
    try { if (location.hash !== '#' + route) history.replaceState(null, '', '#' + route); } catch (e) { }
    closeMenu();
    if (route === 'dashboard') renderDashboard();
    if (route === 'new') goStep(opt && opt.step != null ? opt.step : st.step, true);
    if (route === 'projects') renderProjects();
    if (route === 'plots' && !catDone) buildCatalogue();
    if (route === 'cost') renderEstimator();
    if (route === 'design') { renderResults(); }
    window.scrollTo({ top: 0 });
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-route]'); if (b && !b.closest('[data-view="bylaws"] a')) { e.preventDefault(); go(b.dataset.route); } });
  const side = $('#side'), scrim = $('#scrim');
  function closeMenu() { side.classList.remove('open'); scrim.hidden = true; }
  $('#menu-btn').addEventListener('click', () => { side.classList.add('open'); scrim.hidden = false; });
  scrim.addEventListener('click', closeMenu);

  // ======================= DASHBOARD =======================
  const EXAMPLES = ['10 marla, 5 bedrooms, double storey, drawing room', '1 kanal, 6 beds, servant quarter, road east, modern', '5 marla single storey, 2 bedrooms', '35x70 corner plot, 4 beds, 2 downstairs, spanish'];
  $('#examples').innerHTML = EXAMPLES.map(t => `<button type="button">${esc(t)}</button>`).join('');
  $$('#examples button').forEach(b => b.addEventListener('click', () => { $('#ask-input').value = b.textContent; understand(); }));
  $('#ask-go').addEventListener('click', understand);
  $('#ask-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); understand(); } });

  // rule-based reading of a plain-language brief
  function parseBrief(text) {
    const t = ' ' + text.toLowerCase().replace(/[,;]/g, ' ') + ' ';
    const out = { found: [] }; const num = w => ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, single: 1, double: 2 })[w] || +w;
    let plot = null;
    const dim = /(\d{2,3})\s*(?:x|×|\*|by)\s*(\d{2,3})/.exec(t);
    if (dim) { const w = +dim[1], d = +dim[2]; plot = P.PLOTS.find(p => p.w === w && p.d === d) || (w >= 20 && w <= 120 && d >= 30 && d <= 200 ? { id: w + 'x' + d, w, d, sqft: w * d, sqyd: Math.round(w * d / 9), common: (w * d / 225).toFixed(1) + ' Marla', custom: true } : null); }
    const kan = /(\d+(?:\.\d+)?)?\s*kanal/.exec(t), mar = /(\d+(?:\.\d+)?)\s*marla/.exec(t);
    if (!plot && kan) { const k = kan[1] ? +kan[1] : 1; plot = P.PLOTS.find(p => p.id === (k >= 1.8 ? '75x120' : k >= 1.3 ? '60x120' : '50x90')); }
    if (!plot && mar) { const m = +mar[1]; plot = P.PLOTS.find(p => p.id === (m <= 4 ? '25x40' : m <= 6 ? '25x50' : m <= 9 ? '30x60' : m <= 12 ? '35x70' : m <= 16 ? '40x80' : '50x90')); }
    if (plot) { out.plot = plot; out.found.push(`${plot.w} × ${plot.d} plot (${plot.common})`); }
    const beds = /(\d|one|two|three|four|five|six|seven|eight)\s*(?:-\s*)?(?:bed(?:room)?s?|br)\b/.exec(t); if (beds) { out.beds = Math.max(1, Math.min(8, num(beds[1]))); out.found.push(`${out.beds} bedrooms`); }
    const down = /(\d|one|two|three|four)\s*(?:bed(?:room)?s?\s*)?(?:downstairs|on (?:the )?ground(?: floor)?|ground floor)/.exec(t); if (down) { out.gfBeds = num(down[1]); out.found.push(`${out.gfBeds} downstairs`); }
    if (/single[- ]?stor(e)?y|one[- ]stor(e)?y|1[- ]stor(e)?y|ground floor only|single unit/.test(t)) { out.storeys = 1; out.found.push('single storey'); }
    else if (/double[- ]?stor(e)?y|two[- ]stor(e)?y|2[- ]stor(e)?y|double unit/.test(t)) { out.storeys = 2; out.found.push('double storey'); }
    const flag = (re, k, label) => { const no = new RegExp('(?:no|without)\\s+(?:a\\s+)?' + re.source).test(t); if (no) { out[k] = false; out.found.push('no ' + label); } else if (re.test(t)) { out[k] = true; out.found.push(label); } };
    flag(/drawing(?: room)?/, 'drawing', 'drawing room'); flag(/(?:separate )?dining/, 'dining', 'separate dining'); flag(/(?:servant|maid|staff)(?: quarter| room)?/, 'servant', 'servant quarter'); flag(/dress(?:ing)?(?: rooms?)?|walk-?in/, 'dress', 'dressing rooms');
    if (/(two|2)\s*cars?|double porch/.test(t)) { out.cars = 2; out.found.push('2-car porch'); } else if (/(one|1)\s*car|single porch/.test(t)) { out.cars = 1; out.found.push('1-car porch'); }
    const road = /(north|east|south|west)(?:[- ]facing| road| side)|road (?:on |to )?(?:the )?(north|east|south|west)|facing (north|east|south|west)/.exec(t);
    if (road) { const w = road[1] || road[2] || road[3]; out.facing = w[0].toUpperCase(); out.found.push(`road on the ${w}`); }
    if (/corner/.test(t)) { out.corner = true; out.found.push('corner plot'); }
    if (/back ?yard|rear lawn|garden at (the )?back/.test(t)) { out.yard = 'rear'; out.found.push('back yard'); } else if (/front lawn|garden in front/.test(t)) { out.yard = 'front'; out.found.push('front lawn'); }
    if (M3) Object.entries(M3.STYLES).forEach(([k, s]) => { if (k !== 'massing' && new RegExp('\\b' + s.name.toLowerCase() + '\\b').test(t)) { out.style = k; out.found.push(s.name + ' style'); } });
    if (/premium|luxury|high[- ]end/.test(t)) { out.finish = 'premium'; out.found.push('premium finish'); } else if (/grey structure|gray structure/.test(t)) { out.finish = 'grey'; out.found.push('grey structure budget'); }
    return out;
  }
  let lastBrief = null;
  function understand() {
    const txt = $('#ask-input').value.trim(); const box = $('#understood');
    if (!txt) { box.hidden = false; box.innerHTML = '<span class="hint">Type a short description first — plot size, bedrooms, floors and any rooms you want.</span>'; return; }
    const b = parseBrief(txt); lastBrief = b;
    const plot = b.plot || P.PLOTS.find(p => p.id === '35x70');
    const defs = P.defaultOpts(plot); const filled = [];
    if (!b.plot) filled.push('35 × 70 plot (10 Marla) — no size given');
    if (b.beds == null) filled.push(`${defs.beds} bedrooms (typical)`);
    if (b.storeys == null) filled.push('double storey (typical)');
    box.hidden = false;
    box.innerHTML = `<b>Here's what I understood</b>
      <ul>${b.found.map(f => `<li>${esc(f)}</li>`).join('')}${filled.map(f => `<li class="def">${esc(f)}</li>`).join('')}</ul>
      <div class="row"><button class="btn primary" id="brief-design">Design it now</button><button class="btn" id="brief-review">Review answers first</button></div>`;
    $('#brief-design').addEventListener('click', () => { applyBrief(b); design(); });
    $('#brief-review').addEventListener('click', () => { applyBrief(b); go('new', { step: 3 }); });
  }
  function applyBrief(b) {
    const plot = b.plot || P.PLOTS.find(p => p.id === '35x70');
    st.plot = plot; st.rules = P.cdaRules(plot); st.opts = P.defaultOpts(plot);
    ['beds', 'gfBeds', 'storeys', 'drawing', 'dining', 'servant', 'dress', 'cars', 'yard'].forEach(k => { if (b[k] != null) st.opts[k] = b[k]; });
    if (st.opts.gfBeds > st.opts.beds) st.opts.gfBeds = st.opts.beds;
    if (b.gfBeds == null && b.beds != null && st.opts.storeys === 2) st.opts.gfBeds = Math.min(st.opts.gfBeds, Math.max(0, b.beds - 1));
    if (b.facing) st.facing = b.facing; st.corner = !!b.corner; $('#corner').checked = st.corner;
    if (b.style) v3style = b.style; if (b.finish) st.finish = b.finish;
    st.projectId = null; st.projectName = `${plot.common} house`;
    renderPlotChoices(); renderFacing(); renderAllow(); saveAnswers();
  }

  function heroArt() {
    // decorative front elevation of a two-storey house in the app's palette (not data)
    return `<svg viewBox="0 0 420 260" preserveAspectRatio="xMidYMax meet">
      <rect width="420" height="260" fill="#EAF3FF"/>
      <circle cx="338" cy="58" r="22" fill="#FFFFFF"/><circle cx="338" cy="58" r="14" fill="#CFE5FF"/>
      <g stroke="#D7E7FA" stroke-width="1"><path d="M0 60h420M0 100h420M0 140h420"/></g>
      <rect x="0" y="208" width="420" height="52" fill="#DCEFD8"/><rect x="0" y="222" width="420" height="38" fill="#D3DCE6"/><path d="M0 241h420" stroke="#fff" stroke-width="2" stroke-dasharray="14 10"/>
      <rect x="92" y="196" width="236" height="12" fill="#C9D7E6"/>
      <rect x="104" y="120" width="212" height="78" fill="#FFFFFF" stroke="#BFD3EA" stroke-width="1.5"/>
      <rect x="128" y="62" width="168" height="62" fill="#FFFFFF" stroke="#BFD3EA" stroke-width="1.5"/>
      <rect x="120" y="56" width="184" height="8" rx="2" fill="#1E6FD9"/>
      <rect x="96" y="114" width="228" height="8" rx="2" fill="#1E6FD9"/>
      <rect x="226" y="66" width="62" height="54" fill="#E7F0FD"/>
      <g fill="#8CC2FF"><rect x="140" y="76" width="32" height="34" rx="2"/><rect x="182" y="76" width="32" height="34" rx="2"/><rect x="234" y="74" width="46" height="40" rx="2"/></g>
      <g stroke="#6E4A33" stroke-width="3"><path d="M240 74v40M248 74v40M256 74v40M264 74v40M272 74v40"/></g>
      <rect x="118" y="138" width="46" height="34" rx="2" fill="#8CC2FF"/><rect x="176" y="138" width="38" height="34" rx="2" fill="#8CC2FF"/>
      <rect x="230" y="128" width="78" height="70" fill="#F3F7FC" stroke="#BFD3EA"/><rect x="224" y="124" width="90" height="6" fill="#0F2A43"/>
      <rect x="232" y="128" width="3" height="70" fill="#0F2A43"/><rect x="303" y="128" width="3" height="70" fill="#0F2A43"/>
      <rect x="246" y="168" width="46" height="22" rx="6" fill="#1E6FD9"/><circle cx="254" cy="191" r="4" fill="#0F2A43"/><circle cx="284" cy="191" r="4" fill="#0F2A43"/>
      <rect x="196" y="160" width="20" height="38" fill="#2B4763"/>
      <circle cx="62" cy="178" r="22" fill="#A8D39A"/><rect x="59" y="192" width="6" height="18" fill="#7A9A6B"/>
      <circle cx="368" cy="184" r="16" fill="#A8D39A"/><rect x="366" y="194" width="5" height="14" fill="#7A9A6B"/>
      <rect x="0" y="206" width="92" height="4" fill="#BFD3EA"/><rect x="328" y="206" width="92" height="4" fill="#BFD3EA"/>
    </svg>`;
  }
  function renderDashboard() {
    const hr = new Date().getHours();
    $('#greet').textContent = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + ' — what are we building today?';
    if (!$('#hero-art').innerHTML) $('#hero-art').innerHTML = heroArt();
    const list = Projects.all();
    const area = list.reduce((s, p) => s + (p.summary ? p.summary.built : 0), 0);
    const costs = list.filter(p => p.summary && p.summary.costMid).map(p => p.summary.costMid);
    const pass = list.filter(p => p.summary && p.summary.fails === 0).length;
    const ic = { proj: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', area: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>', cost: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', ok: '<path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>' };
    const kpi = (i, k, v, d) => `<div class="card kpi"><span class="k"><i><svg viewBox="0 0 24 24">${ic[i]}</svg></i>${k}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
    $('#kpis').innerHTML = [
      kpi('proj', 'Saved projects', list.length, list.length ? `Last saved ${new Date(list[0].updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Save a design to see it here'),
      kpi('area', 'Area designed', area ? fmtN(area) + ' ft²' : '—', 'Covered area across saved projects'),
      kpi('cost', 'Average budget', costs.length ? X.pkr(costs.reduce((a, b) => a + b, 0) / costs.length) : '—', 'Mid estimate, chosen finish'),
      kpi('ok', 'Bylaw compliant', list.length ? `${pass} / ${list.length}` : '—', 'Projects passing every CDA check'),
    ].join('');
    const rec = $('#recent');
    if (!list.length) rec.innerHTML = `<div class="empty-state">No saved projects yet. Describe a house above or <button class="btn link" data-route="new">start a new design</button>.</div>`;
    else { rec.innerHTML = `<div class="proj-grid">${list.slice(0, 6).map(projCard).join('')}</div>`; bindProjCards(rec); }
    // plot capacity bars
    const rows = P.PLOTS.map(p => { const r = P.cdaRules(p); return { p, gf: r.cov * p.sqft, tot: r.far * p.sqft }; });
    const mx = Math.max(...rows.map(r => r.tot));
    $('#plot-bars').innerHTML = rows.map(r => `<div class="bar-row"><span class="nm">${r.p.w}×${r.p.d}<small>${r.p.common}</small></span><div class="bar-track" title="Ground ${fmtN(r.gf)} ft², total ${fmtN(r.tot)} ft²"><i class="t" style="width:${(r.tot / mx * 100).toFixed(1)}%"></i><i class="g" style="width:${(r.gf / mx * 100).toFixed(1)}%"></i></div><span class="val">${fmtN(r.tot)}</span></div>`).join('');
    $('#quick').innerHTML = P.PLOTS.map(p => `<button type="button" data-plot="${p.id}"><b>${p.w} × ${p.d}</b><span>${p.common} · ${p.sqyd} yd²</span></button>`).join('');
    $$('#quick [data-plot]').forEach(b => b.addEventListener('click', () => { const p = P.PLOTS.find(x => x.id === b.dataset.plot); startWithPlot(p); }));
  }
  function startWithPlot(p) { st.plot = p; st.rules = P.cdaRules(p); st.opts = P.defaultOpts(p); st.projectId = null; st.projectName = `${p.common} house`; renderPlotChoices(); renderAllow(); saveAnswers(); go('new', { step: 1 }); }
  function projCard(pr) {
    const s = pr.summary || {};
    const thumb = pr.thumb ? `<img alt="" src="${pr.thumb}">` : (pr.planThumb || '');
    return `<button type="button" class="proj-card" data-open="${esc(pr.id)}"><div class="thumb">${thumb}</div><div class="meta"><b>${esc(pr.name)}</b><span>${esc(pr.plot.w + ' × ' + pr.plot.d)} · ${s.beds || '?'} beds · ${s.built ? fmtN(s.built) + ' ft²' : ''}</span></div></button>`;
  }
  function bindProjCards(root) { root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.open))); }

  // ======================= QUESTIONS =======================
  function choiceBtn(big, small, pressed) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice';
    b.setAttribute('aria-pressed', String(!!pressed));
    b.innerHTML = `<span class="big">${big}</span>${small ? `<span class="small">${small}</span>` : ''}`;
    return b;
  }
  function renderPlotChoices() {
    const el = $('#plot-choices'); el.innerHTML = '';
    P.PLOTS.forEach(p => { const b = choiceBtn(`${p.w} × ${p.d}`, `${p.common} · ${p.sqyd} sq yd`, st.plot && st.plot.id === p.id && !st.plot.custom); b.addEventListener('click', () => choosePlot(p)); el.appendChild(b); });
  }
  function choosePlot(p) {
    const changed = !st.plot || st.plot.id !== p.id;
    st.plot = p; st.rules = P.cdaRules(p); if (changed) { st.opts = P.defaultOpts(p); st.projectName = `${p.common} house`; }
    $('#plot-msg').textContent = ''; renderPlotChoices(); renderAllow(); syncStep(); saveAnswers();
  }
  $('#custom-go').addEventListener('click', () => {
    const w = Math.round(+$('#cw').value), d = Math.round(+$('#cd').value); const m = $('#plot-msg');
    if (!(w >= 20 && w <= 120)) { m.textContent = 'Enter a width between 20 and 120 ft.'; m.className = 'msg err'; $('#cw').focus(); return; }
    if (!(d >= 30 && d <= 200)) { m.textContent = 'Enter a depth between 30 and 200 ft.'; m.className = 'msg err'; $('#cd').focus(); return; }
    choosePlot({ id: w + 'x' + d, w, d, sqft: w * d, sqyd: Math.round(w * d / 9), common: (w * d / 225).toFixed(1) + ' Marla', custom: true });
    m.textContent = `Using ${w} × ${d} ft.`; m.className = 'msg ok';
  });
  function renderFacing() {
    const el = $('#facing-choices'); el.innerHTML = '';
    Object.entries(FACING).forEach(([k, n]) => { const b = choiceBtn(n[0].toUpperCase() + n.slice(1), '', st.facing === k); b.addEventListener('click', () => { st.facing = k; renderFacing(); saveAnswers(); }); el.appendChild(b); });
  }
  $('#corner').addEventListener('change', e => { st.corner = e.target.checked; saveAnswers(); });
  function allowHTML() {
    const R = st.rules, p = st.plot, A = p.sqft; const pr = P.porchRules(R, st.opts ? st.opts.cars : 1);
    const cell = (k, v) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`;
    return `<h3>What CDA allows on a ${p.w} × ${p.d} plot</h3><div class="allow-grid">
      ${cell('Ground floor, max', fmtN(R.cov * A) + ' ft²')}${cell('Total built, max', fmtN(R.far * A) + ' ft²')}
      ${cell('Front / rear open', `${R.front}' / ${R.rear}'`)}${cell('Side open', R.sideL + R.sideR ? `${R.sideL}' / ${R.sideR}'` : 'none (terraced)')}
      ${cell('Floors', '2 + mumty')}${cell('Car porch', pr.total + ' ft²')}</div>
      <p>Category ${R.cat} · ${esc(R.row)} — CDA Residential Sectors Zoning Regulation 1993, Schedule A.${R.servantRequired ? ' A servant room with bath is required on this plot size.' : ''}</p>`;
  }
  function renderAllow() { const a = $('#allow'); if (!st.plot) { a.hidden = true; return; } a.hidden = false; a.innerHTML = allowHTML(); }
  function renderHouse() {
    const o = st.opts;
    $('#house-hint').textContent = `Typical choices for a ${st.plot.common} plot are filled in. Change anything you like.`;
    const sc = $('#storey-choices'); sc.innerHTML = '';
    [[1, 'Single storey', 'Ground floor only'], [2, 'Double storey', 'Ground + first floor']].forEach(([v, a, b]) => { const btn = choiceBtn(a, b, o.storeys === v); btn.addEventListener('click', () => { o.storeys = v; renderHouse(); saveAnswers(); }); sc.appendChild(btn); });
    $('#beds-out').textContent = o.beds; $('#gf-q').hidden = o.storeys === 1;
    if (o.gfBeds > o.beds) o.gfBeds = o.beds; $('#gf-out').textContent = o.gfBeds;
    if (!o.yard) o.yard = 'front';
    const yc = $('#yard-choices'); yc.innerHTML = '';
    [['front', 'Front lawn', 'House sits at the rear setback line'], ['rear', 'Back yard', 'House sits at the front setback line']].forEach(([v, a, b]) => { const btn = choiceBtn(a, b, o.yard === v); btn.addEventListener('click', () => { o.yard = v; renderHouse(); saveAnswers(); }); yc.appendChild(btn); });
    const cc = $('#car-choices'); cc.innerHTML = ''; const det = st.rules.type === 'detached';
    [[1, 'One car', 'Single porch'], [2, 'Two cars', det ? 'Double porch' : 'Over the 180 ft² terraced limit — extra counts as built area']].forEach(([v, a, b]) => { const btn = choiceBtn(a, b, o.cars === v); btn.addEventListener('click', () => { o.cars = v; renderHouse(); saveAnswers(); }); cc.appendChild(btn); });
  }
  const bump = (k, d, lo, hi) => () => { const o = st.opts; o[k] = Math.max(lo(), Math.min(hi(), o[k] + d)); if (o.gfBeds > o.beds) o.gfBeds = o.beds; renderHouse(); saveAnswers(); };
  $('#beds-minus').addEventListener('click', bump('beds', -1, () => 1, () => 8));
  $('#beds-plus').addEventListener('click', bump('beds', 1, () => 1, () => 8));
  $('#gf-minus').addEventListener('click', bump('gfBeds', -1, () => 0, () => Math.min(4, st.opts.beds)));
  $('#gf-plus').addEventListener('click', bump('gfBeds', 1, () => 0, () => Math.min(4, st.opts.beds)));
  function renderExtras() {
    const o = st.opts, req = st.rules.servantRequired;
    $('#x-drawing').checked = !!o.drawing; $('#x-dining').checked = !!o.dining; $('#x-dress').checked = !!o.dress;
    $('#x-servant').checked = req || !!o.servant; $('#x-servant').disabled = req;
    $('#x-servant-note').textContent = req ? 'Required by CDA on plots of 501 sq yd and above' : 'Room with its own bath';
    $('#x-dining').disabled = st.plot.w < 30;
  }
  [['x-drawing', 'drawing'], ['x-dining', 'dining'], ['x-servant', 'servant'], ['x-dress', 'dress']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { st.opts[k] = e.target.checked; saveAnswers(); }));
  function renderReview() {
    const o = st.opts, p = st.plot; const yes = [];
    if (o.drawing) yes.push('drawing room'); if (o.dining && p.w >= 30) yes.push('separate dining'); if (o.servant || st.rules.servantRequired) yes.push('servant quarter'); if (o.dress) yes.push('dressing rooms');
    const rows = [
      ['Plot', `${p.w} × ${p.d} ft · ${p.common} · ${p.sqyd} sq yd${st.corner ? ' · corner' : ''}`, 0], ['Road', `On the ${FACING[st.facing]} side`, 0],
      ['Floors', o.storeys === 2 ? 'Double storey' : 'Single storey', 1],
      ['Bedrooms', o.storeys === 2 ? `${o.beds} (${o.gfBeds} downstairs, ${o.beds - o.gfBeds} upstairs), each with a bath` : `${o.beds}, each with a bath`, 1],
      ['Car porch', o.cars === 2 ? 'Two cars' : 'One car', 1],
      ['Open space', (o.yard === 'rear' ? 'Extra space as a back yard' : 'Extra space as a front lawn') + `; rear setback ${st.rules.rear}'`, 1],
      ['Other rooms', yes.length ? yes.join(', ').replace(/^./, c => c.toUpperCase()) : 'None — lounge, kitchen and stairs only', 2],
    ];
    $('#review').innerHTML = rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd><button class="btn link" data-goto="${s}">Change</button></div>`).join('');
    $$('#review [data-goto]').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.goto)));
    $('#allow2').innerHTML = allowHTML();
    const R = st.rules; ['front', 'rear', 'sideL', 'sideR', 'far'].forEach(k => $('#r-' + k).value = R[k]); $('#r-cov').value = Math.round(R.cov * 100);
  }
  ['front', 'rear', 'sideL', 'sideR', 'cov', 'far'].forEach(k => $('#r-' + k).addEventListener('change', e => {
    const v = +e.target.value; if (!isFinite(v) || v < 0) { renderReview(); return; }
    st.rules[k] = k === 'cov' ? Math.min(0.9, Math.max(0.3, v / 100)) : v; $('#allow2').innerHTML = allowHTML();
  }));
  $('#r-reset').addEventListener('click', () => { st.rules = P.cdaRules(st.plot); renderReview(); });
  function renderSteps() {
    $('#steps').innerHTML = STEP_NAMES.map((n, i) => `<li class="${i < st.step ? 'done' : i === st.step ? 'now' : ''}">${i < st.step ? `<button data-goto="${i}">${i + 1}. ${n}</button>` : `${i + 1}. ${n}`}</li>`).join('');
    $$('#steps [data-goto]').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.goto)));
  }
  function syncStep() { const next = $('[data-step="0"] [data-next]'); next.disabled = !st.plot; next.textContent = st.plot ? 'Next: your house' : 'Choose a plot to continue'; }
  function goStep(i, noFocus) {
    if (i > 0 && !st.plot) i = 0;
    st.step = i; $('#working').hidden = true;
    $$('[data-step]').forEach(c => c.hidden = +c.dataset.step !== i);
    if (i === 1) renderHouse(); if (i === 2) renderExtras(); if (i === 3) renderReview();
    renderSteps(); syncStep();
    if (st.route === 'new') $('#page-crumb').textContent = `Step ${i + 1} of 4 · ${STEP_NAMES[i]}`;
    const h = $(`[data-step="${i}"] h2`); if (h && !noFocus) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0 });
  }
  $$('[data-next]').forEach(b => b.addEventListener('click', () => goStep(st.step + 1)));
  $$('[data-back]').forEach(b => b.addEventListener('click', () => goStep(st.step - 1)));
  $('#go').addEventListener('click', () => design());
  function saveAnswers() { store.set('buildme.answers', JSON.stringify({ plot: st.plot, facing: st.facing, corner: st.corner, opts: st.opts })); }

  // ======================= DESIGN =======================
  function design(newSeed) {
    if (newSeed) st.seed = (st.seed * 1103515245 + 12345) >>> 0;
    if (st.route !== 'new') go('new', { step: st.step });
    $$('[data-step]').forEach(c => c.hidden = true); $('#working').hidden = false;
    setTimeout(() => {
      st.options = P.generate(st.plot, Object.assign({}, st.opts, { corner: st.corner }), st.rules, st.seed, 100);
      $('#working').hidden = true; $('#nav-design').hidden = false;
      loadOption(0); go('design');
    }, 30);
  }
  $('#change').addEventListener('click', () => go('new', { step: 3 }));
  $('#more-opts').addEventListener('click', () => design(true));
  function loadOption(i) {
    st.opt = i; const p = st.options[i];
    st.cur = p ? { scheme: p.scheme, plan: p } : null; st.hist = []; st.fut = []; st.sel = null; st.floor = 0; st._animate3d = true; st.dirty = true;
    $('#gallery').innerHTML = ''; renderOpts(); renderResults(); say('');
  }
  function renderOpts() {
    const el = $('#opts'); el.innerHTML = '';
    if (!st.options.length) { el.innerHTML = '<p class="hint">No layout fits these answers. Try fewer bedrooms, no drawing room, or single storey — use “Change brief”.</p>'; return; }
    st.options.slice(0, 6).forEach((p, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.setAttribute('aria-pressed', String(i === st.opt));
      b.innerHTML = `<div class="pair">${p.floors.map((f, fi) => V.renderFloor(p, fi, { thumb: true, uid: 'o' + i })).join('')}</div><div class="t">Layout ${String.fromCharCode(65 + i)}<span>${fmtN(p.stats.gf + p.stats.ff)} ft²</span></div>`;
      b.addEventListener('click', () => loadOption(i)); el.appendChild(b);
    });
  }
  function apply(res, okMsg) {
    if (!res || res.error) { say(res ? res.error : 'That change is not possible.', true); return false; }
    st.hist.push(st.cur); if (st.hist.length > 60) st.hist.shift(); st.fut = [];
    st.cur = { scheme: res.scheme, plan: res.plan }; if (res.added) st.sel = res.added; st.dirty = true;
    renderResults(); say(okMsg || 'Plan updated.'); return true;
  }
  function say(t, err) { const m = $('#msg'); m.textContent = t; m.className = 'msg' + (err ? ' err' : t ? ' ok' : ''); }
  $('#undo').addEventListener('click', () => { if (!st.hist.length) return; st.fut.push(st.cur); st.cur = st.hist.pop(); renderResults(); say('Undone.'); });
  $('#redo').addEventListener('click', () => { if (!st.fut.length) return; st.hist.push(st.cur); st.cur = st.fut.pop(); renderResults(); say('Redone.'); });
  $('#mirror').addEventListener('click', () => { if (st.cur) apply(P.edit.mirror(st.cur.scheme), 'Layout mirrored.'); });
  $('#revert').addEventListener('click', () => { if (st.options[st.opt]) { loadOption(st.opt); selectTab('edit'); say('Back to the original layout.'); } });

  // workspace tabs
  function selectTab(t) {
    st.tab = t; $$('#ws-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $$('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== t);
    if (t === '3d') requestAnimationFrame(() => { init3d(); if (viewer) { viewer.resize(); lastPlan = null; update3d(st._animate3d !== false); st._animate3d = false; } });
  }
  $$('#ws-tabs [data-tab]').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  $('#proj-name').addEventListener('input', e => { st.projectName = e.target.value; st.dirty = true; });

  // ======================= 3D =======================
  let viewer = null, v3style = 'massing', lastPlan = null;
  const STYLE_KEYS = M3 ? Object.keys(M3.STYLES) : [];
  function init3d() {
    if (viewer || !M3) return viewer;
    try { viewer = new M3.Viewer($('#m3d')); viewer.onAnim = t => { $('#m3d-status').textContent = t < 1 ? 'Extruding from the plan…' : M3.STYLES[v3style].name + (v3style === 'massing' ? ' model — pick a style below' : ' style'); }; }
    catch (e) { $('#m3d-status').textContent = '3D view unavailable here (needs WebGL).'; viewer = null; }
    return viewer;
  }
  function update3d(animate) {
    const p = st.cur && st.cur.plan; if (!p || !viewer) return; if (p === lastPlan) return; lastPlan = p;
    viewer.setPlan(p, v3style, animate);
    if (!animate) $('#m3d-status').textContent = M3.STYLES[v3style].name + (v3style === 'massing' ? ' model' : ' style');
  }
  function setStyle(k) {
    v3style = k; $$('#style-chips button').forEach(x => x.setAttribute('aria-checked', String(x.dataset.k === k)));
    $('#style-blurb').textContent = M3.STYLES[k].blurb || '';
    if (viewer) { viewer.setStyle(k); $('#m3d-status').textContent = M3.STYLES[k].name + (k === 'massing' ? ' model' : ' style'); }
    st.dirty = true; if (st.cur) { renderFacts(st.cur.plan); renderTips(st.cur.plan); }
  }
  if (M3) {
    STYLE_KEYS.forEach(k => {
      const S = M3.STYLES[k]; const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.k = k;
      b.setAttribute('aria-checked', String(k === v3style)); b.innerHTML = `<i style="background:#${S.wall.toString(16).padStart(6, '0')}"></i>${S.name}`;
      b.addEventListener('click', () => setStyle(k)); $('#style-chips').appendChild(b);
      if (k !== 'massing') { const l = document.createElement('label'); l.innerHTML = `<input type="checkbox" value="${k}" ${['modern', 'contemporary', 'spanish'].includes(k) ? 'checked' : ''}> ${S.name}`; $('#style-ticks').appendChild(l); }
    });
    $('#style-blurb').textContent = M3.STYLES[v3style].blurb;
    $$('#m3d-views button').forEach(b => b.addEventListener('click', () => { $$('#m3d-views button').forEach(x => x.setAttribute('aria-selected', String(x === b))); if (viewer) viewer.view(b.dataset.v); }));
    $('#render-go').addEventListener('click', () => {
      if (!init3d() || !st.cur) return; const keys = tickedStyles(); const gal = $('#gallery');
      if (!keys.length) { gal.innerHTML = '<p class="hint">Tick at least one style.</p>'; return; }
      gal.innerHTML = ''; const btn = $('#render-go'); btn.disabled = true; let i = 0;
      const view = ($$('#m3d-views button').find(b => b.getAttribute('aria-selected') === 'true') || {}).textContent || 'Aerial';
      const step = () => {
        if (i >= keys.length) { btn.disabled = false; btn.textContent = 'Render selected'; return; }
        btn.textContent = `Rendering ${i + 1} of ${keys.length}…`; const k = keys[i++]; const url = viewer.snapshot(k, 1200, 760);
        const f = document.createElement('figure'); f.innerHTML = `<img alt="${M3.STYLES[k].name} style render" src="${url}"><figcaption>${M3.STYLES[k].name}<span>${view} view</span></figcaption>`; gal.appendChild(f);
        setTimeout(step, 30);
      };
      setTimeout(step, 30);
    });
  } else $('#m3d-status').textContent = '3D library could not load.';
  function tickedStyles() { return $$('#style-ticks input:checked').map(i => i.value); }

  // ======================= RESULTS =======================
  function renderResults() {
    const cur = st.cur; if (!cur || !st.plot) return;
    const p = cur.plan, o = st.opts;
    $('#proj-name').value = st.projectName;
    $('#res-sub').textContent = `${st.plot.w} × ${st.plot.d} · ${st.plot.common} · ${p.floors.length > 1 ? 'double' : 'single'} storey · ${p.stats.beds} bedrooms · road on the ${FACING[st.facing]}${st.projectId ? ' · saved project' : ''}`;
    const nts = (p.notes || []).filter((v, i, a) => a.indexOf(v) === i);
    $('#notes').hidden = !nts.length; $('#notes').textContent = nts.length ? 'Adjusted to fit: ' + nts.join(' ') : '';
    if (st.floor >= p.floors.length + (p.floors.length > 1 ? 1 : 0)) st.floor = 0;
    const tabs = p.floors.map((f, i) => i ? 'First floor' : 'Ground floor'); if (p.floors.length > 1) tabs.push('Roof');
    $('#floor-tabs').innerHTML = tabs.map((t, i) => `<button role="tab" aria-selected="${i === st.floor}" data-f="${i}">${t}</button>`).join('');
    $$('#floor-tabs button').forEach(b => b.addEventListener('click', () => { st.floor = +b.dataset.f; renderResults(); }));
    const rot = { N: 0, E: -90, S: 180, W: 90 }[st.facing];
    $('#north').innerHTML = `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9" fill="#fff" stroke="currentColor" stroke-width=".8"/><g transform="rotate(${rot})"><path d="M0 -7 L3 4 L0 2 L-3 4 Z" fill="var(--primary)"/></g></svg><span>North</span>`;
    const label = FACING[st.facing].toUpperCase();
    $('#plan-view').innerHTML = st.floor < p.floors.length ? V.renderFloor(p, st.floor, { facing: label, uid: 'm', sel: st.sel }) : V.renderRoof(p, { facing: label, uid: 'rf' });
    renderFacts(p); renderTips(p); renderChecks(p); renderSchedule(p); renderEditor(); renderInspector();
    if (st.tab === '3d') requestAnimationFrame(() => { update3d(st._animate3d); st._animate3d = false; });
    $('#undo').disabled = !st.hist.length; $('#redo').disabled = !st.fut.length; $('#revert').disabled = !st.hist.length;
  }
  $('#plan-view').addEventListener('click', e => {
    const r = e.target.closest('.rm'); if (!r || !st.cur) return;
    const src = r.dataset.src; if (!src || src === 'auto' || !P.locate(st.cur.scheme, src)) return;
    st.sel = src; renderResults(); selectTab('edit');
  });
  const costStyle = () => v3style === 'massing' ? 'minimalist' : v3style;
  function renderFacts(p) {
    const s = p.stats, R = p.rules, A = p.plot.sqft; const fails = p.checks.filter(c => c.s === 'bad');
    const pct = (a, b) => Math.min(100, Math.round(a / b * 100)); const c = X.cost(p, st.finish, costStyle());
    $('#facts').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
      <div class="verdict ${fails.length ? 'bad' : 'ok'}"><span class="ic">${fails.length ? '!' : '✓'}</span><div><b>${fails.length ? `${fails.length} bylaw issue${fails.length > 1 ? 's' : ''}` : 'Meets CDA bylaws'}</b><span>${fails.length ? esc(fails.map(f => f.label).join(', ')) : `All ${p.checks.length} checks pass · category ${R.cat}`}</span></div></div>
      <dl class="fact-list">
        <div><dt>Bedrooms</dt><dd>${s.beds}</dd></div><div><dt>Bathrooms</dt><dd>${s.baths}</dd></div>
        <div><dt>Ground floor</dt><dd>${fmtN(s.gf)} <small>ft²</small></dd></div><div><dt>First floor</dt><dd>${s.ff ? fmtN(s.ff) + ' <small>ft²</small>' : '—'}</dd></div>
        <div style="grid-column:1/-1"><dt>Ground coverage</dt><dd>${(s.gfCounted / A * 100).toFixed(0)}% <small>of ${Math.round(R.cov * 100)}% allowed</small></dd><div class="meter"><i style="width:${pct(s.gfCounted, s.covMax)}%"></i></div></div>
        ${p.floors.length > 1 ? `<div style="grid-column:1/-1"><dt>Total built area</dt><dd>${fmtN(s.far)} <small>of ${fmtN(s.farMax)} ft² allowed</small></dd><div class="meter"><i style="width:${pct(s.far, s.farMax)}%"></i></div></div>` : ''}
      </dl>
      <div style="border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:8px">
        <span class="lab">Estimated construction cost</span>
        <span class="cost-v">${X.pkrRange(c.total)}</span>
        <div class="seg" id="finish-seg" role="group" aria-label="Finish level"><button data-f="grey">Grey structure</button><button data-f="standard">Standard</button><button data-f="premium">Premium</button></div>
        <p class="hint" style="font-size:12px">${fmtN(c.area)} ft² at PKR ${fmtN(c.finish.lo)}–${fmtN(c.finish.hi)}/ft²${c.elev.lo ? ` + ${M3.STYLES[costStyle()].name.toLowerCase()} elevation allowance` : ''}. Excludes land, fees, boundary wall.</p>
      </div></div>`;
    $$('#finish-seg button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.f === st.finish)); b.addEventListener('click', () => { st.finish = b.dataset.f; store.set('buildme.finish', st.finish); st.dirty = true; renderFacts(p); }); });
  }

  // assistant: rule-based suggestions for the current layout
  function renderTips(p) {
    const s = p.stats, tips = [];
    const fails = p.checks.filter(c => c.s === 'bad'), warns = p.checks.filter(c => c.s === 'warn');
    if (fails.length) tips.push({ k: 'warn', t: 'Fix before submitting', d: fails.map(f => f.label + ': ' + f.detail).join(' · '), a: ['rules', 'See bylaw check'] });
    else tips.push({ k: 'good', t: 'Within CDA bylaws', d: `Setbacks, coverage, FAR, porch and room sizes all pass for a ${p.plot.common} plot.` });
    if (p.floors.length > 1 && s.far / s.farMax < 0.88) tips.push({ t: 'Room to grow upstairs', d: `You're using ${Math.round(s.far / s.farMax * 100)}% of the allowed built area — about ${fmtN(s.farMax - s.far)} ft² is unused. Add a study or family lounge upstairs.`, a: ['edit', 'Add a room'] });
    if (p.floors[0].rooms.some(r => r.skylight)) tips.push({ t: 'Lounge needs a skylight', d: 'The TV lounge has no outside wall, so it relies on a skylight. Swap it with a room on the front or rear row for a window.', a: ['edit', 'Customise'] });
    warns.forEach(w => tips.push({ k: 'warn', t: w.label, d: w.detail }));
    p.floors.forEach((f, fi) => f.issues.forEach(i => tips.push({ t: (fi ? 'First floor: ' : 'Ground floor: ') + i, d: 'Try mirroring the layout or swapping it with a room on an outside wall.', a: ['edit', 'Customise'] })));
    const sun = { N: 'Road on the north: front rooms stay cool and evenly lit — large front windows work well.', S: 'Road on the south: the front gets strong sun. Deep sunshades (Contemporary style) keep front rooms cooler.', E: 'Road on the east: morning sun on the front. Bedrooms at the back stay cooler in the evening.', W: 'Road on the west: harsh afternoon sun on the front. Use sunshades or louvers (Modern style) on front windows.' };
    tips.push({ t: 'Orientation', d: sun[st.facing] });
    if (v3style === 'massing') tips.push({ t: 'Pick an elevation style', d: 'See the house in Modern, Spanish, French and other Pakistani styles, and include its finish in the cost.', a: ['3d', 'Open 3D & styles'] });
    if (!st.projectId || st.dirty) tips.push({ t: st.projectId ? 'Unsaved changes' : 'Save this design', d: 'Save it to your projects to compare designs from the dashboard later.', a: ['save', 'Save project'] });
    $('#tips').innerHTML = tips.slice(0, 7).map(x => `<li class="${x.k || ''}"><b>${esc(x.t)}</b><span>${esc(x.d)}</span>${x.a ? `<button class="btn sm soft act" data-tip="${x.a[0]}">${esc(x.a[1])}</button>` : ''}</li>`).join('');
    $$('#tips [data-tip]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.tip; if (a === 'save') saveProject(); else selectTab(a); }));
  }
  function renderChecks(p) {
    const bad = p.checks.filter(c => c.s === 'bad').length, warn = p.checks.filter(c => c.s === 'warn').length;
    $('#checks-sum').textContent = bad ? `${bad} issue${bad > 1 ? 's' : ''} to fix` : warn ? `All checks pass · ${warn} note${warn > 1 ? 's' : ''}` : `All ${p.checks.length} CDA checks pass`;
    $('#compliance').innerHTML = p.checks.map(c => `<li><span class="pill ${c.s}">${c.s === 'ok' ? 'Pass' : c.s === 'warn' ? 'Note' : 'Fail'}</span><span><b>${esc(c.label)}.</b> ${esc(c.detail)}</span></li>`).join('');
  }
  const ORD = ['porch', 'foyer', 'drawing', 'powder', 'lounge', 'flounge', 'dining', 'kitchen', 'store', 'bed', 'dress', 'bath', 'study', 'servant', 'sbath', 'laundry', 'stair', 'passage', 'terrace', 'court', 'proof'];
  function renderSchedule(p) {
    const names = ['Ground floor', 'First floor']; let n = 0;
    const rows = ['<thead><tr><th>Room</th><th class="num">Size (clear)</th><th class="num">Area ft²</th><th>CDA minimum</th></tr></thead><tbody>'];
    p.floors.forEach((f, fi) => {
      rows.push(`<tr class="floor-row"><td colspan="4">${names[fi]}</td></tr>`);
      const byId = {}; f.rooms.forEach(r => byId[r.id] = r);
      const key = r => { const own = r.owner && byId[r.owner]; return own ? key(own) + 0.5 + ORD.indexOf(r.t) / 100 : ORD.indexOf(r.t) * 1000 + r.y + r.x / 100; };
      f.rooms.filter(r => !['shaft', 'passage'].includes(r.t)).sort((a, b) => key(a) - key(b)).forEach(r => {
        n++; const ax = P.annex1(r);
        const tag = ax ? (ax.ok ? '<span class="pill ok">meets</span>' : ax.relax ? '<span class="pill warn">within 10%</span>' : '<span class="pill bad">too small</span>') : '';
        rows.push(`<tr><td><span class="sw" style="background:var(--n-${V.CAT[r.t]})"></span>${esc(r.name)}</td><td class="num">${V.dimText(r)}</td><td class="num">${Math.round((r.w - P.WALL) * (r.h - P.WALL))}</td><td>${tag}</td></tr>`);
      });
    });
    rows.push('</tbody>'); $('#schedule').innerHTML = rows.join(''); $('#rooms-sum').textContent = `${n} spaces with clear (inside) dimensions`;
  }

  // ======================= CUSTOMISE (bubble editor) =======================
  function renderEditor() {
    const p = st.cur && st.cur.plan; if (!p) return;
    $('#bub0').innerHTML = V.renderBubbles(p, 0, st.sel); $('#bub1-cell').hidden = p.floors.length < 2;
    $('#bub1').innerHTML = p.floors.length > 1 ? V.renderBubbles(p, 1, st.sel) : '';
  }
  function svgPoint(svg, e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
  function laneIndex(floor, key, px, dragId) {
    const S = st.cur.scheme, p = st.cur.plan; const list = floor === 0 ? S.gf.bands[key].items : (typeof key === 'string' ? S.ff.segs[+key[1]] : S.ff.rows[key]);
    if (!list) return 0; const f = p.floors[floor]; let n = 0;
    list.forEach(it => { if (it.id === dragId) return; const r = f.rooms.find(x => x.src === it.id && x.main) || f.rooms.find(x => x.src === it.id); if (r && r.x + r.w / 2 < px) n++; });
    return n;
  }
  const tr = g => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform')); return [+m[1], +m[2]]; };
  function hitBubble(svg, pt, self) { let best = null, bd = 1e9; svg.querySelectorAll('.bub').forEach(g => { if (g.dataset.id === self) return; const [x, y] = tr(g); const r = +g.querySelector('circle').getAttribute('r'); const d = Math.hypot(pt.x - x, pt.y - y); if (d < r + 0.4 && d < bd) { bd = d; best = g; } }); return best; }
  function hitLane(svg, pt) { let hit = null; svg.querySelectorAll('.lane').forEach(l => { const x = +l.getAttribute('x'), y = +l.getAttribute('y'), w = +l.getAttribute('width'), h = +l.getAttribute('height'); if (pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h) hit = l; }); return hit; }
  function select(id) { st.sel = id; renderResults(); }
  let drag = null;
  ['#bub0', '#bub1'].forEach(sel => {
    const host = $(sel);
    host.addEventListener('pointerdown', e => { const g = e.target.closest('.bub'); if (!g || g.classList.contains('locked')) return; const svg = g.ownerSVGElement, pt = svgPoint(svg, e), [ox, oy] = tr(g); drag = { g, svg, floor: +svg.dataset.floor, id: g.dataset.id, ox, oy, sx: pt.x, sy: pt.y, moved: false }; svg.setPointerCapture(e.pointerId); g.classList.add('dragging'); e.preventDefault(); });
    host.addEventListener('pointermove', e => {
      if (!drag) return; const pt = svgPoint(drag.svg, e), dx = pt.x - drag.sx, dy = pt.y - drag.sy; if (Math.hypot(dx, dy) > 0.6) drag.moved = true;
      drag.g.setAttribute('transform', `translate(${drag.ox + dx} ${drag.oy + dy})`);
      drag.svg.querySelectorAll('.target').forEach(x => x.classList.remove('target')); drag.svg.querySelectorAll('.hot').forEach(x => x.classList.remove('hot'));
      const t = hitBubble(drag.svg, pt, drag.id); if (t) t.classList.add('target'); else { const ln = hitLane(drag.svg, pt); if (ln) ln.classList.add('hot'); }
    });
    host.addEventListener('pointerup', e => {
      if (!drag) return; const d = drag; drag = null; d.g.classList.remove('dragging');
      if (!d.moved) { select(d.id); return; }
      const pt = svgPoint(d.svg, e), t = hitBubble(d.svg, pt, d.id); st.sel = d.id;
      if (t) { if (t.classList.contains('locked')) { say('That one is fixed — try another room.', true); renderEditor(); return; } if (!apply(P.edit.swap(st.cur.scheme, d.id, t.dataset.id), 'Rooms swapped.')) renderEditor(); return; }
      const ln = hitLane(d.svg, pt);
      if (!ln || ln.classList.contains('fixed')) { say(ln ? 'Rooms cannot go there.' : 'Drop onto a row or another room.', true); renderEditor(); return; }
      const raw = ln.dataset.lane, key = raw[0] === 's' ? raw : +raw;
      if (!apply(P.edit.move(st.cur.scheme, d.id, d.floor, key, laneIndex(d.floor, key, pt.x, d.id)), 'Room moved.')) renderEditor();
    });
    host.addEventListener('pointercancel', () => { if (drag) { drag = null; renderEditor(); } });
    host.addEventListener('keydown', e => {
      const g = e.target.closest('.bub'); if (!g || g.classList.contains('locked')) return;
      const id = g.dataset.id, floor = +g.ownerSVGElement.dataset.floor;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id); focusBub(id); return; }
      const loc = P.locate(st.cur.scheme, id); if (!loc) return; let res = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') res = P.edit.move(st.cur.scheme, id, floor, loc.i, loc.j + (e.key === 'ArrowLeft' ? -1 : 2));
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && floor === 0) res = P.edit.move(st.cur.scheme, id, 0, loc.i + (e.key === 'ArrowUp' ? -1 : 1), 99);
      if (res) { e.preventDefault(); st.sel = id; apply(res, 'Room moved.'); focusBub(id); }
    });
  });
  function focusBub(id) { const g = document.querySelector(`.bub[data-id="${CSS.escape(id)}"]`); if (g) g.focus(); }
  const ADDABLE = [['bed', 'Bedroom + bath', 'both'], ['study', 'Study', 'both'], ['store', 'Store', 'both'], ['powder', 'Powder room', 'both'], ['laundry', 'Laundry', 'both'], ['dining', 'Dining', 0], ['drawing', 'Drawing room', 0], ['court', 'Courtyard', 0], ['servant', 'Servant room + bath', 0], ['flounge', 'Family lounge', 1]];
  function laneOptions(p) { const out = []; p.floors.forEach((f, fi) => V.lanes(p, fi).forEach(l => { if (!l.fixed) out.push({ v: fi + ':' + l.key, n: (fi ? 'First floor · ' : 'Ground floor · ') + l.name + (l.key === 's0' ? ' (left)' : l.key === 's1' ? ' (right)' : '') }); })); return out; }
  function renderInspector() {
    const el = $('#inspector'); const cur = st.cur; if (!cur) { el.innerHTML = ''; return; }
    const S = cur.scheme, p = cur.plan, loc = st.sel && P.locate(S, st.sel); let head = '', laneSel = '';
    if (loc) {
      const f = p.floors[loc.floor]; const r = f.rooms.find(x => x.src === st.sel && x.main) || f.rooms.find(x => x.src === st.sel);
      const it = loc.list[loc.j]; const fixed = it.kind === 'porch' || it.kind === 'stairCol' || it.lockedItem;
      const flipTxt = it.kind === 'suite' ? 'Bath to other side' : it.kind === 'stack' ? 'Swap order' : it.kind === 'stairCol' ? 'Flip stair' : null;
      const canRemove = ['bed', 'study', 'store', 'powder', 'laundry', 'court', 'dining', 'drawing', 'servant', 'flounge'].includes(it.t) && !(it.t === 'servant' && S.rules.servantRequired);
      const row = V.lanes(p, loc.floor).find(l => String(l.key) === String(loc.i)); laneSel = loc.floor + ':' + loc.i;
      head = `<h4>${esc(r ? r.name : it.t)}</h4><div class="meta">${loc.floor ? 'First' : 'Ground'} floor · ${esc(row ? row.name : '')}<br>${r ? V.dimText(r) + ' · ' + Math.round((r.w - P.WALL) * (r.h - P.WALL)) + ' ft²' : ''}</div>
        <div class="btns"><button class="btn" data-act="grow" ${fixed ? 'disabled' : ''}>Wider</button><button class="btn" data-act="shrink" ${fixed ? 'disabled' : ''}>Narrower</button>
        <button class="btn" data-act="deeper">Row +1 ft</button><button class="btn" data-act="shallower">Row −1 ft</button>
        <button class="btn" data-act="flip" ${flipTxt ? '' : 'disabled'}>${flipTxt || 'Flip'}</button><button class="btn danger" data-act="remove" ${canRemove ? '' : 'disabled'}>Remove</button></div>`;
    } else head = `<h4>Select a room</h4><p class="empty">Click a circle, or a room on the Plans tab.</p>`;
    const lanes = laneOptions(p); if (!laneSel || !lanes.some(l => l.v === laneSel)) laneSel = lanes.length ? lanes[lanes.length - 1].v : '';
    el.innerHTML = head + `<div class="group"><span class="lab">Add a room</span><select id="add-type" aria-label="Room type">${ADDABLE.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>
      <div class="addrow"><select id="add-lane" aria-label="Where">${lanes.map(l => `<option value="${l.v}" ${l.v === laneSel ? 'selected' : ''}>${esc(l.n)}</option>`).join('')}</select><button class="btn primary" id="add-go">Add</button></div></div>`;
    el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
    $('#add-go').addEventListener('click', () => {
      const t = $('#add-type').value, [fs, ks] = $('#add-lane').value.split(':'), fi = +fs, key = ks[0] === 's' ? ks : +ks; const spec = ADDABLE.find(a => a[0] === t);
      if (spec[2] !== 'both' && spec[2] !== fi) { say(`${spec[1]} can only go on the ${spec[2] ? 'first' : 'ground'} floor.`, true); return; }
      if (apply(P.edit.add(st.cur.scheme, t, fi, key), `${spec[1]} added.`) && t === 'bed') st.opts.beds = st.cur.scheme.opts.beds;
    });
  }
  function act(a) {
    const S = st.cur.scheme, id = st.sel, loc = P.locate(S, id); if (!loc) return;
    const band = loc.floor === 0 ? loc.i : (typeof loc.i === 'string' ? S.ff.stairBand : loc.i);
    const m = { grow: () => P.edit.resize(S, id, 1.15), shrink: () => P.edit.resize(S, id, 1 / 1.15), deeper: () => P.edit.depth(S, band, 1), shallower: () => P.edit.depth(S, band, -1), flip: () => P.edit.flip(S, id), remove: () => P.edit.remove(S, id) };
    const msg = { grow: 'Room widened.', shrink: 'Room narrowed.', deeper: 'Row made 1 ft deeper.', shallower: 'Row made 1 ft shallower.', flip: 'Flipped.', remove: 'Room removed.' };
    const ok = apply(m[a](), msg[a]); if (ok && a === 'remove') { st.sel = null; renderResults(); } if (ok) st.opts.beds = st.cur.scheme.opts.beds;
  }

  // ======================= SAVE / OPEN PROJECTS =======================
  function summaryOf(p) { const c = X.cost(p, st.finish, costStyle()); return { beds: p.stats.beds, baths: p.stats.baths, built: p.stats.gf + p.stats.ff, costMid: (c.total.lo + c.total.hi) / 2, fails: p.checks.filter(x => x.s === 'bad').length }; }
  function saveProject() {
    if (!st.cur) return; const p = st.cur.plan; const now = Date.now();
    let thumb = null; try { if (init3d()) { if (lastPlan !== p) { lastPlan = null; viewer.setPlan(p, v3style, false); lastPlan = p; } thumb = viewer.renderView(v3style === 'massing' ? 'modern' : v3style, 'aerial', 480, 300, 'image/jpeg'); } } catch (e) { thumb = null; }
    const rec = {
      id: st.projectId || 'p' + now.toString(36), name: (st.projectName || 'My house').trim() || 'My house', created: (st.projectId && (Projects.get(st.projectId) || {}).created) || now, updated: now,
      plot: st.plot, facing: st.facing, corner: st.corner, opts: st.opts, rules: st.rules, scheme: st.cur.scheme, style: v3style, finish: st.finish,
      summary: summaryOf(p), thumb, planThumb: V.renderFloor(p, 0, { thumb: true, uid: 'pt' + now }),
    };
    const ok = Projects.upsert(rec); st.projectId = rec.id; st.dirty = false; updateCount();
    toast(ok ? `Saved “${rec.name}” to your projects.` : 'Saved without a picture — browser storage is nearly full.');
    renderResults();
  }
  $('#save-proj').addEventListener('click', saveProject);
  function openProject(id) {
    const pr = Projects.get(id); if (!pr) return;
    const plan = P.realise(pr.scheme); if (plan.error) { toast('That project could not be opened: ' + plan.error); return; }
    st.plot = pr.plot; st.facing = pr.facing; st.corner = pr.corner; st.opts = pr.opts; st.rules = pr.rules; st.finish = pr.finish || 'standard';
    st.projectId = pr.id; st.projectName = pr.name; st.options = [plan]; st.opt = 0;
    st.cur = { scheme: plan.scheme, plan }; st.hist = []; st.fut = []; st.sel = null; st.floor = 0; st._animate3d = true; st.dirty = false;
    if (M3 && pr.style && M3.STYLES[pr.style]) { v3style = pr.style; $$('#style-chips button').forEach(x => x.setAttribute('aria-checked', String(x.dataset.k === v3style))); $('#style-blurb').textContent = M3.STYLES[v3style].blurb; if (viewer) viewer.setStyle(v3style); }
    lastPlan = null; $('#nav-design').hidden = false; renderOpts(); go('design'); selectTab('plans');
  }
  function updateCount() { $('#nav-count').textContent = Projects.all().length; }
  let toastT = 0;
  function toast(t) { let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0F2A43;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;box-shadow:0 6px 24px rgba(15,42,67,.25);z-index:50;max-width:90vw'; document.body.appendChild(el); } el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3200); }

  // projects page
  let pendingDelete = null;
  function renderProjects() {
    const q = ($('#proj-search').value || '').toLowerCase(); const list = Projects.all().filter(p => !q || p.name.toLowerCase().includes(q) || `${p.plot.w}x${p.plot.d}`.includes(q));
    const tb = $('#proj-table');
    if (!Projects.all().length) { tb.innerHTML = `<tbody><tr><td><div class="empty-state" style="margin:14px">No saved projects yet. <button class="btn link" data-route="new">Start a new design</button>, then press “Save project”.</div></td></tr></tbody>`; return; }
    tb.innerHTML = `<thead><tr><th>Project</th><th>Plot</th><th class="num">Beds</th><th class="num">Built ft²</th><th class="num">Estimate (mid)</th><th>Bylaws</th><th>Updated</th><th></th></tr></thead><tbody>` +
      list.map(p => { const s = p.summary || {}; return `<tr><td><b>${esc(p.name)}</b></td><td>${p.plot.w} × ${p.plot.d} <span class="hint">${esc(p.plot.common)}</span></td><td class="num">${s.beds || ''}</td><td class="num">${s.built ? fmtN(s.built) : ''}</td><td class="num">${s.costMid ? X.pkr(s.costMid).replace('PKR ', '') : ''}</td><td>${s.fails ? `<span class="pill bad">${s.fails} fail</span>` : '<span class="pill ok">pass</span>'}</td><td>${new Date(p.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        <td style="white-space:nowrap">${pendingDelete === p.id ? `<span class="hint">Delete for good?</span> <button class="btn sm danger" data-del-yes="${p.id}">Delete</button> <button class="btn sm" data-del-no>Keep</button>` : `<button class="btn sm soft" data-open="${p.id}">Open</button> <button class="btn sm" data-dup="${p.id}">Duplicate</button> <button class="btn sm ghost danger" data-del="${p.id}" aria-label="Delete ${esc(p.name)}">Delete</button>`}</td></tr>`; }).join('') + '</tbody>';
    tb.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.open)));
    tb.querySelectorAll('[data-dup]').forEach(b => b.addEventListener('click', () => { const p = Projects.get(b.dataset.dup); const c = Object.assign({}, p, { id: 'p' + Date.now().toString(36), name: p.name + ' (copy)', created: Date.now(), updated: Date.now() }); Projects.upsert(c); updateCount(); renderProjects(); }));
    tb.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { pendingDelete = b.dataset.del; renderProjects(); }));
    tb.querySelectorAll('[data-del-yes]').forEach(b => b.addEventListener('click', () => { Projects.remove(b.dataset.delYes); if (st.projectId === b.dataset.delYes) st.projectId = null; pendingDelete = null; updateCount(); renderProjects(); toast('Project deleted.'); }));
    tb.querySelectorAll('[data-del-no]').forEach(b => b.addEventListener('click', () => { pendingDelete = null; renderProjects(); }));
  }
  $('#proj-search').addEventListener('input', renderProjects);

  // ======================= PLOT SIZES =======================
  let catDone = false, catSeed = 11;
  function buildCatalogue() {
    catDone = true; const grid = $('#cat-grid'); grid.innerHTML = '<p class="hint">Designing a plan for every plot…</p>'; let i = 0; let first = true;
    const next = () => {
      if (i >= P.PLOTS.length) return; const plot = P.PLOTS[i++]; const R = P.cdaRules(plot);
      const plans = P.generate(plot, P.defaultOpts(plot), R, catSeed + i * 101, 60); const p = plans[0];
      if (first) { grid.innerHTML = ''; first = false; }
      const card = document.createElement('article'); card.className = 'card cat-card';
      if (!p) card.innerHTML = `<div class="top"><h3>${plot.w} × ${plot.d}</h3></div><p class="hint" style="padding:0 16px">No layout found.</p>`;
      else {
        const bad = p.checks.filter(c => c.s === 'bad').length;
        card.innerHTML = `<div class="top"><h3>${plot.w} × ${plot.d}</h3><span>${plot.common} · ${plot.sqyd} sq yd · Cat ${R.cat}</span></div>
          <div class="pair">${p.floors.map((f, fi) => `<figure>${V.renderFloor(p, fi, { thumb: true, uid: 'c' + i })}<figcaption>${fi ? 'First' : 'Ground'} floor</figcaption></figure>`).join('')}</div>
          <dl><div><dt>Beds</dt><dd>${p.stats.beds}</dd></div><div><dt>Built</dt><dd>${fmtN(p.stats.gf + p.stats.ff)}</dd></div><div><dt>FAR</dt><dd>${(p.stats.far / plot.sqft).toFixed(2)}</dd></div><div><dt>Bylaws</dt><dd>${bad ? bad + ' fail' : 'pass'}</dd></div></dl>`;
        const b = document.createElement('button'); b.className = 'btn soft'; b.textContent = 'Plan this plot';
        b.addEventListener('click', () => { st.plot = plot; st.rules = R; st.opts = P.defaultOpts(plot); st.projectId = null; st.projectName = `${plot.common} house`; st.options = plans; $('#nav-design').hidden = false; loadOption(0); go('design'); });
        card.appendChild(b);
      }
      grid.appendChild(card); setTimeout(next, 10);
    };
    setTimeout(next, 20);
  }
  $('#cat-regen').addEventListener('click', () => { catSeed += 17; buildCatalogue(); });

  // ======================= COST ESTIMATOR =======================
  function estInit() {
    $('#est-plot').innerHTML = P.PLOTS.map(p => `<option value="${p.id}">${p.w} × ${p.d} — ${p.common} (${p.sqyd} yd²)</option>`).join('');
    $('#est-plot').value = (st.plot && !st.plot.custom && st.plot.id) || '35x70';
    $('#est-style').innerHTML = M3 ? Object.entries(M3.STYLES).filter(([k]) => k !== 'massing').map(([k, s]) => `<option value="${k}">${s.name} (+${Math.round(s.premium * 100)}%)</option>`).join('') : '<option value="">Plain</option>';
    $('#est-style').value = 'minimalist';
    ['est-plot', 'est-storeys'].forEach(id => $('#' + id).addEventListener('change', () => { estArea(true); renderEstimator(); }));
    ['est-style', 'est-area'].forEach(id => $('#' + id).addEventListener('input', renderEstimator));
    $('#est-design').addEventListener('click', () => startWithPlot(P.PLOTS.find(p => p.id === $('#est-plot').value)));
    estArea(true);
  }
  function estMax() { const p = P.PLOTS.find(x => x.id === $('#est-plot').value); const R = P.cdaRules(p); const one = $('#est-storeys').value === '1'; return { p, R, max: Math.round(one ? R.cov * p.sqft : R.far * p.sqft) }; }
  function estArea(reset) { const m = estMax(); if (reset || !$('#est-area').value) $('#est-area').value = Math.round(m.max * 0.92 / 10) * 10; }
  function renderEstimator() {
    const m = estMax(); const area = Math.max(0, +$('#est-area').value || 0); const sk = $('#est-style').value; const prem = M3 && M3.STYLES[sk] ? M3.STYLES[sk].premium : 0;
    $('#est-max').textContent = `CDA allows up to ${fmtN(m.max)} ft² on this plot ${$('#est-storeys').value === '1' ? '(single storey, ' + Math.round(m.R.cov * 100) + '% coverage)' : '(FAR ' + m.R.far + ')'}.${area > m.max ? ' Your figure is above that limit.' : ''}`;
    const rows = Object.entries(X.FINISH).map(([k, f]) => { const pp = k === 'grey' ? prem / 2 : prem; return { k, f, lo: area * f.lo * (1 + pp), hi: area * f.hi * (1 + pp) }; });
    const std = rows.find(r => r.k === 'standard');
    $('#est-total').textContent = area ? X.pkrRange(std) : '—';
    $('#est-note').textContent = area ? `${fmtN(area)} ft² covered at PKR ${fmtN(std.f.lo)}–${fmtN(std.f.hi)}/ft²${prem ? ` + ${Math.round(prem * 100)}% elevation allowance` : ''}` : 'Enter the covered area you plan to build.';
    $('#est-table').innerHTML = '<thead><tr><th>Finish level</th><th>What it covers</th><th class="num">Rate / ft²</th><th class="num">Estimate</th></tr></thead><tbody>' +
      rows.map(r => `<tr><td><b>${r.f.name}</b></td><td class="hint">${esc(r.f.note)}</td><td class="num">${fmtN(r.f.lo)}–${fmtN(r.f.hi)}</td><td class="num">${area ? X.pkrRange(r).replace('PKR ', '') : '—'}</td></tr>`).join('') + '</tbody>';
  }

  // ======================= EXPORT =======================
  function planJSON(p) {
    return {
      generator: 'BuildMe (rule-based, CDA 1993 Schedule A)', project: st.projectName, units: 'ft', plot: { w: p.plot.w, d: p.plot.d, sqyd: p.plot.sqyd, road: FACING[st.facing] },
      bylaws: p.rules, envelope: { x: p.E.x0, y: p.E.y0, w: p.E.W, d: p.D }, stats: p.stats, checks: p.checks.map(c => ({ status: c.s, rule: c.label, detail: c.detail })),
      floors: p.floors.map((f, fi) => ({ level: fi, rooms: f.rooms.map(r => ({ id: r.id, type: r.t, name: r.name, box: [r.x, r.y, r.w, r.h] })), graph: { nodes: f.rooms.map(r => r.id), edges: f.links.map(l => ({ a: l.a, b: l.b, kind: l.kind })) } })),
      scheme: p.scheme,
    };
  }
  const status = (t, err) => { const m = $('#dl-status'); m.textContent = t; m.className = 'msg' + (err ? ' err' : t ? ' ok' : ''); };
  function copy(text, label) {
    const done = ok => status(ok ? label + ' copied to the clipboard.' : 'Copy was blocked here.', !ok);
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); done(ok); };
    try { navigator.clipboard.writeText(text).then(() => done(true), fallback); } catch (e) { fallback(); }
  }
  $('#copy-json').addEventListener('click', () => { if (st.cur) copy(JSON.stringify(planJSON(st.cur.plan), null, 2), 'Plan data'); });
  // inside claude.ai the platform saves files; anywhere else (Cloudflare, local) a normal browser download is used
  const browserSaver = { save: async ({ filename, data }) => { const blob = data instanceof Blob ? data : new Blob([data]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return { status: 'saved' }; } };
  let dlP = null; const getDl = () => dlP || (dlP = (window.claude && claude.use) ? claude.use('downloads').catch(() => null) : Promise.resolve(browserSaver));
  getDl().then(d => { if (!d) { $$('.dl-btn, .dl-row .btn:not(#copy-json)').forEach(b => b.disabled = true); status('Downloads are not available in this view.', true); } });
  const slug = () => { const base = (st.projectName || 'BuildMe').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'BuildMe'; const p = st.cur.plan.plot; return `BuildMe_${base}_${p.w}x${p.d}`; };
  const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  async function save(filename, data) {
    const d = await getDl(); if (!d) { status('Downloads are not available in this view.', true); return false; }
    try { await d.save({ filename, data }); status(`Saved ${filename}.`); return true; }
    catch (e) { const c = e && e.code; status(c === 'declined' ? 'Download cancelled.' : c === 'rate_limited' ? 'A save prompt is already open — finish it first.' : c === 'too_large' ? 'That file is too large to save here.' : 'The file could not be saved here.', c !== 'declined'); return false; }
  }
  const FLOORN = ['Ground floor plan', 'First floor plan', 'Roof plan'];
  async function planImages(pal, px) {
    const p = st.cur.plan, out = []; const face = FACING[st.facing].toUpperCase(); const n = p.floors.length + (p.floors.length > 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const svg = i < p.floors.length ? V.renderFloor(p, i, { facing: face, uid: 'x' + i }) : V.renderRoof(p, { facing: face, uid: 'xr' });
      const c = await X.svgToCanvas(svg, px, pal);
      const area = i < p.floors.length ? fmtN(i ? p.stats.ff : p.stats.gf) + ' ft² covered' : 'Mumty ' + Math.round(p.stats.tower) + ' ft² · 3\'-0" parapet';
      out.push({ title: FLOORN[i], sub: `${p.plot.w}' x ${p.plot.d}' · ${area} · road on the ${FACING[st.facing]}`, canvas: c, url: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height, file: ['plan-ground-floor.png', 'plan-first-floor.png', 'plan-roof.png'][i] });
    }
    return out;
  }
  function ensurePlanIn3D() { if (!init3d()) return false; if (lastPlan !== st.cur.plan) { viewer.setPlan(st.cur.plan, v3style, false); lastPlan = st.cur.plan; } return true; }
  function frontRender(styleKey, type, w, h) { return ensurePlanIn3D() ? viewer.renderView(styleKey || v3style, 'street', w || 1600, h || 1000, type || 'image/jpeg') : null; }
  async function buildReport(pal, planImgs) {
    const p = st.cur.plan; status('Rendering the front view…'); await tick();
    const fStyle = v3style === 'massing' ? (tickedStyles()[0] || 'modern') : v3style;
    const front = frontRender(fStyle);
    const renders = []; for (const k of tickedStyles()) renders.push({ name: M3.STYLES[k].name, url: frontRender(k, 'image/jpeg', 1200, 750) });
    status('Writing the PDF…'); await tick();
    return X.pdf({ plan: p, pal, planImgs, front, renders, cost: X.cost(p, st.finish, fStyle), styleKey: fStyle, styleName: M3 ? M3.STYLES[fStyle].name : 'Plain', road: FACING[st.facing], date: today() });
  }
  const tick = () => new Promise(r => setTimeout(r, 20));
  async function run(fn) { if (!st.cur) return; const all = $$('.dl-btn, .dl-row .btn'); all.forEach(b => b.disabled = true); try { await fn(); } catch (e) { console.error(e); status('Export failed: ' + (e.message || e), true); } finally { all.forEach(b => b.disabled = false); } }
  $('#dl-pdf').addEventListener('click', () => run(async () => { status('Drawing plans…'); await tick(); const pal = X.lightPalette(); const imgs = await planImages(pal, 2200); await save(slug() + '_report.pdf', await buildReport(pal, imgs)); }));
  $('#dl-png').addEventListener('click', () => run(async () => { const url = frontRender(null, 'image/png', 2000, 1250); if (!url) { status('The 3D view is not available, so there is no render to save.', true); return; } await save(slug() + '_front.png', await X.dataURLBlob(url)); }));
  $('#dl-plan').addEventListener('click', () => run(async () => { const pal = X.lightPalette(); const imgs = await planImages(pal, 2600); const im = imgs[Math.min(st.floor, imgs.length - 1)]; await save(`${slug()}_${im.file}`, await X.canvasBlob(im.canvas)); }));
  function addCAD(zip, folder) {
    const p = st.cur.plan; p.floors.forEach((f, i) => zip.file(`${folder}${i ? 'first' : 'ground'}-floor.dxf`, X.dxf(p, i)));
    zip.file(`${folder}README.txt`, 'DXF (AutoCAD R12) drawings from BuildMe.\r\nUnits: inches. Layers: A-WALL, A-DOOR, A-GLAZ, A-TEXT, A-STAIR, A-PORCH, A-PLOT, A-SETBACK, A-DIMS.\r\nOpen in AutoCAD, BricsCAD, DraftSight or LibreCAD and use Save As > DWG for a .dwg file.\r\nConcept drawings only - not for construction or approval without an architect.\r\n');
  }
  async function addGLB(zip, name) { if (!ensurePlanIn3D()) return false; zip.file(name, await viewer.exportGLB(v3style === 'massing' ? null : v3style)); return true; }
  $('#dl-cad').addEventListener('click', () => run(async () => { const z = new JSZip(); addCAD(z, ''); await save(slug() + '_CAD-dxf.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' })); }));
  $('#dl-glb').addEventListener('click', () => run(async () => {
    status('Packing the 3D model…'); await tick(); const z = new JSZip(); if (!(await addGLB(z, 'house.glb'))) { status('The 3D view is not available, so there is no model to export.', true); return; }
    z.file('README.txt', 'GLB (glTF 2.0 binary) model from BuildMe. Units: feet (1 unit = 1 ft). Opens in Blender, SketchUp (with importer), Windows 3D Viewer and most 3D tools.\r\n');
    await save(slug() + '_3D-glb.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
  }));
  $('#dl-zip').addEventListener('click', () => run(async () => {
    const z = new JSZip(); const p = st.cur.plan; status('Drawing plans…'); await tick(); const pal = X.lightPalette(); const imgs = await planImages(pal, 2200);
    z.file('report.pdf', await buildReport(pal, imgs)); addCAD(z, 'cad/');
    for (const im of imgs) z.file('images/' + im.file, await X.canvasBlob(im.canvas));
    status('Rendering images…'); await tick();
    const fr = frontRender(null, 'image/png', 2000, 1250); if (fr) z.file(`images/front-${v3style}.png`, await X.dataURLBlob(fr));
    for (const k of tickedStyles()) { const u = frontRender(k, 'image/jpeg', 1600, 1000); if (u) z.file(`images/front-${k}.jpg`, await X.dataURLBlob(u)); }
    status('Packing the 3D model…'); await tick(); await addGLB(z, 'model/house.glb');
    z.file('plan-data.json', JSON.stringify(planJSON(p), null, 2)); status('Compressing…'); await tick();
    await save(slug() + '_all-files.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
  }));

  // ======================= STATIC CONTENT + BOOT =======================
  $('#sched-table').innerHTML = '<thead><tr><th>Type</th><th class="num">Front</th><th class="num">Sides</th><th class="num">Cover</th><th class="num">FAR</th><th class="num">Mumty</th></tr></thead><tbody>' +
    P.SCHED_A.map(s => `<tr><td>${s.cat} · ${s.row}</td><td class="num">${s.front}'</td><td class="num">${s.side1 || s.side2 ? s.side1 + "' / " + s.side2 + "'" : '—'}</td><td class="num">${Math.round(s.cov * 100)}%</td><td class="num">${s.far}</td><td class="num">${s.tower}</td></tr>`).join('') + '</tbody>';
  try {
    const a = JSON.parse(store.get('buildme.answers') || 'null');
    if (a && a.plot) { st.plot = a.plot; st.rules = P.cdaRules(a.plot); st.opts = a.opts || P.defaultOpts(a.plot); st.facing = a.facing || 'N'; st.corner = !!a.corner; $('#corner').checked = st.corner; st.projectName = `${a.plot.common} house`; }
  } catch (e) { }
  renderPlotChoices(); renderFacing(); renderAllow(); updateCount(); estInit();
  const h = (location.hash || '').replace('#', '');
  go(['new', 'projects', 'plots', 'cost', 'bylaws'].includes(h) ? h : 'dashboard');
})();
