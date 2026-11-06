/* BuildMe — application shell: dashboard, design assistant, guided questions, workspace, projects, tools */
(function () {
  'use strict';
  const P = window.BuildMe, V = window.BuildMeRender, M3 = window.BuildMe3D, X = window.BuildMeExport, H = window.BuildMeHelp, I = window.BuildMeInterior, I3 = window.BuildMeInterior3D, DT = window.BuildMeDetail;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  const FACING = { N: 'north', E: 'east', S: 'south', W: 'west' };
  const STEP_NAMES = ['Plot', 'House', 'Rooms', 'Review'];
  const fmtN = n => Math.round(n).toLocaleString('en-PK');
  const AU = P.AUTH;

  const st = {
    route: 'dashboard', step: 0, plot: null, facing: 'N', corner: false, opts: null, rules: null, seed: 20261020,
    options: [], opt: 0, cur: null, finish: store.get('buildme.finish') || 'standard', hist: [], fut: [], sel: null, floor: 0, tab: 'plans',
    projectId: null, projectName: 'My house', dirty: false, authority: (AU && AU.byId[store.get('buildme.authority')]) ? store.get('buildme.authority') : 'cda',
    locked: false, interior: {},
  };
  const PL = () => AU ? AU.plotsFor(st.authority) : PL();
  const RF = p => P.rulesFor ? P.rulesFor(p, st.authority) : RF(p);
  const AUN = () => (AU && AU.byId[st.authority]) || { short: 'CDA', name: 'Capital Development Authority', city: 'Islamabad' };
  // nearest standard plot of the current authority to a target area
  const nearestPlot = sqft => PL().reduce((b, p) => Math.abs(p.sqft - sqft) < Math.abs(b.sqft - sqft) ? p : b, PL()[0]);
  function setAuthority(id, quiet) {
    if (!AU || !AU.byId[id]) return; const changed = id !== st.authority; st.authority = id; store.set('buildme.authority', id);
    if (st.plot && changed && !st.plot.custom && !PL().some(p => p.id === st.plot.id)) { st.plot = nearestPlot(st.plot.sqft); st.opts = P.defaultOpts(st.plot); st.projectName = `${st.plot.common} house`; }
    if (st.plot) st.rules = RF(st.plot);
    renderAuthUI(); if (typeof renderPlotChoices === 'function') { renderPlotChoices(); renderAllow(); }
    if (st.route === 'dashboard') renderDashboard(); if (st.route === 'bylaws') renderBylaws();
    catDone = false; if (st.route === 'plots') buildCatalogue(); if (typeof estInit === 'function' && st.route === 'cost') { estFill(); renderEstimator(); }
    saveAnswers();
    if (changed && !quiet && H) H.toast({ title: `Using ${AUN().short} bylaws`, text: `${AUN().city}: setbacks, coverage and FAR now follow ${AUN().name}.`, mood: 'idea', ms: 5000 });
  }

  // ======================= PROJECTS (browser storage) =======================
  const Projects = {
    all() { try { return JSON.parse(store.get('buildme.projects') || '[]'); } catch (e) { return []; } },
    save(list) { return store.set('buildme.projects', JSON.stringify(list)); },
    upsert(p) { const l = this.all(); const i = l.findIndex(x => x.id === p.id); if (i >= 0) l[i] = p; else l.unshift(p); if (!this.save(l)) { p.thumb = null; if (i >= 0) l[i] = p; return this.save(l); } return true; },
    remove(id) { this.save(this.all().filter(x => x.id !== id)); },
    get(id) { return this.all().find(x => x.id === id); },
  };

  // ======================= ROUTING =======================
  const TITLES = { dashboard: 'Dashboard', new: 'New design', design: 'Design workspace', projects: 'My projects', plots: 'Plot sizes', cost: 'Cost estimator', bylaws: 'Bylaws', interior: 'Interior design', help: 'Help & FAQ' };
  function go(route, opt) {
    if (route === 'design' && !st.cur) route = 'new';
    if (route === 'interior' && (!st.cur || !st.locked)) { if (st.cur && H) H.toast({ title: 'Lock the design first', text: 'Interiors start once the layout is locked — press “Lock & design interiors”.', mood: 'think' }); route = st.cur ? 'design' : 'new'; }
    st.route = route;
    $$('[data-view]').forEach(s => s.hidden = s.dataset.view !== route);
    $$('.nav [data-route]').forEach(b => b.setAttribute('aria-current', b.dataset.route === route ? 'page' : 'false'));
    $('#page-title').textContent = TITLES[route];
    $('#page-crumb').textContent = (route === 'design' || route === 'interior') && st.plot ? `${st.plot.w} × ${st.plot.d} · ${st.plot.common}` : route === 'new' ? `Step ${st.step + 1} of 4 · ${STEP_NAMES[st.step]}` : '';
    try { if (location.hash !== '#' + route) history.replaceState(null, '', '#' + route); } catch (e) { }
    closeMenu();
    if (route === 'dashboard') renderDashboard();
    if (route === 'new') goStep(opt && opt.step != null ? opt.step : st.step, true);
    if (route === 'projects') renderProjects();
    if (route === 'plots' && !catDone) buildCatalogue();
    if (route === 'cost') { estFill(); renderEstimator(); }
    if (route === 'bylaws') renderBylaws();
    if (route === 'design') { renderResults(); }
    if (route === 'interior') renderInterior();
    if (H) {
      if (route === 'help') H.mountHelpPage($('#help-page'));
      const qa = { dashboard: ['#quick-dash', 'Questions people ask', 'Tap a question for Mimar\u2019s answer'], new: ['#quick-new', 'Quick answers', 'About plots, bylaws and what fits'], design: ['#quick-design', 'Quick answers', 'About this layout and downloads'],
        projects: ['#quick-projects', 'Quick answers', 'About saving and files'], plots: ['#quick-plots', 'Quick answers', 'About plot sizes'], cost: ['#quick-cost', 'Quick answers', 'About the estimate'], bylaws: ['#quick-bylaws', 'Quick answers', 'About building rules'] }[route];
      if (qa) H.mountQuick($(qa[0]), route, { title: qa[1], sub: qa[2], n: route === 'dashboard' ? 6 : 4 });
      H.setScreen(route);
    }
    window.scrollTo({ top: 0 });
  }
  window.addEventListener('hashchange', () => { const h = (location.hash || '').replace('#', ''); if (TITLES[h] && h !== st.route) go(h); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-route]'); if (b && !b.closest('[data-view="bylaws"] a')) { e.preventDefault(); go(b.dataset.route); } });
  const side = $('#side'), scrim = $('#scrim');
  function closeMenu() { side.classList.remove('open'); scrim.hidden = true; }
  $('#menu-btn').addEventListener('click', () => { side.classList.add('open'); scrim.hidden = false; });
  scrim.addEventListener('click', closeMenu);

  // ======================= DASHBOARD =======================
  const EXAMPLES = ['10 marla in Lahore, 5 bedrooms, double storey, drawing room', '1 kanal DHA Islamabad, 6 beds, road east, modern', '240 sq yd Karachi, 4 bedrooms', '5 marla Islamabad single storey, 2 bedrooms', '35x70 corner plot, 4 beds, 2 downstairs, spanish'];
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
    if (dim) { const w = +dim[1], d = +dim[2]; plot = PL().find(p => p.w === w && p.d === d) || (w >= 20 && w <= 120 && d >= 30 && d <= 200 ? { id: w + 'x' + d, w, d, sqft: w * d, sqyd: Math.round(w * d / 9), common: (w * d / 225).toFixed(1) + ' Marla', custom: true } : null); }
    const kan = /(\d+(?:\.\d+)?)?\s*kanal/.exec(t), mar = /(\d+(?:\.\d+)?)\s*marla/.exec(t);
    const au = AU ? AU.detect(t) : null; if (au) { out.authority = au; out.found.push(`${AU.byId[au].short} bylaws (${AU.byId[au].city})`); }
    const plots = AU ? AU.plotsFor(au || st.authority) : PL(); const near = a => plots.reduce((b, p) => Math.abs(p.sqft - a) < Math.abs(b.sqft - a) ? p : b, plots[0]);
    const mSize = AU && ['pda', 'qda'].includes(au || st.authority) ? AU.MARLA_KP : 225;
    const yds = /(\d{2,4})\s*(?:sq\.?\s*)?(?:yd|yds|yards?|gaz)\b/.exec(t);
    if (!plot && dim) plot = plots.find(p => p.w === +dim[1] && p.d === +dim[2]) || plot;
    if (!plot && kan) { const k = kan[1] ? +kan[1] : 1; plot = near(k * 20 * mSize); }
    if (!plot && mar) { const m = +mar[1]; plot = near(m * mSize); }
    if (!plot && yds) plot = near(+yds[1] * 9);
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
    const plot = b.plot || (AU ? AU.plotsFor(b.authority || st.authority) : PL())[3] || PL()[0];
    const defs = P.defaultOpts(plot); const filled = [];
    if (!b.plot) filled.push(`${plot.w} × ${plot.d} plot (${plot.common}) — no size given`);
    if (!b.authority) filled.push(`${AUN().short} bylaws (${AUN().city}) — no location given`);
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
    if (b.authority) setAuthority(b.authority, true);
    const plot = b.plot || PL()[3] || PL()[0];
    st.plot = plot; st.rules = RF(plot); st.opts = P.defaultOpts(plot);
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
      kpi('ok', 'Bylaw compliant', list.length ? `${pass} / ${list.length}` : '—', 'Projects passing every bylaw check'),
    ].join('');
    const rec = $('#recent');
    if (!list.length) rec.innerHTML = `<div class="empty-state">No saved projects yet. Describe a house above or <button class="btn link" data-route="new">start a new design</button>.</div>`;
    else { rec.innerHTML = `<div class="proj-grid">${list.slice(0, 6).map(projCard).join('')}</div>`; bindProjCards(rec); }
    // plot capacity bars
    const rows = PL().map(p => { const r = RF(p); return { p, gf: r.cov * p.sqft, tot: r.far * p.sqft }; });
    const mx = Math.max(...rows.map(r => r.tot)); $('#bars-sub').textContent = `Maximum built area under ${AUN().short} rules (${AUN().city}), in ft² — designs use up to two storeys`;
    $('#plot-bars').innerHTML = rows.map(r => `<div class="bar-row"><span class="nm">${r.p.w}×${r.p.d}<small>${r.p.common}</small></span><div class="bar-track" title="Ground ${fmtN(r.gf)} ft², total ${fmtN(r.tot)} ft²"><i class="t" style="width:${(r.tot / mx * 100).toFixed(1)}%"></i><i class="g" style="width:${(r.gf / mx * 100).toFixed(1)}%"></i></div><span class="val">${fmtN(r.tot)}</span></div>`).join('');
    $('#quick').innerHTML = PL().map(p => `<button type="button" data-plot="${p.id}"><b>${p.w} × ${p.d}</b><span>${p.common} · ${p.sqyd} yd²</span></button>`).join('');
    $$('#quick [data-plot]').forEach(b => b.addEventListener('click', () => { const p = PL().find(x => x.id === b.dataset.plot); startWithPlot(p); }));
  }
  function startWithPlot(p) { st.plot = p; st.rules = RF(p); st.opts = P.defaultOpts(p); st.projectId = null; st.projectName = `${p.common} house`; renderPlotChoices(); renderAllow(); saveAnswers(); go('new', { step: 1 }); }
  function projCard(pr) {
    const s = pr.summary || {};
    const thumb = pr.thumb ? `<img alt="" src="${pr.thumb}">` : (pr.planThumb || '');
    return `<button type="button" class="proj-card" data-open="${esc(pr.id)}"><div class="thumb">${thumb}</div><div class="meta"><b>${esc(pr.name)}</b><span>${esc(pr.plot.w + ' × ' + pr.plot.d)} · ${s.beds || '?'} beds · ${s.built ? fmtN(s.built) + ' ft²' : ''}</span></div></button>`;
  }
  function bindProjCards(root) { root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.open))); }

  // ======================= LOCATION / AUTHORITY =======================
  const REGIONS = ['Islamabad', 'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Societies'];
  function renderAuthUI() {
    if (!AU) return; const a = AUN();
    const opts = REGIONS.map(r => { const list = AU.AUTHORITIES.filter(x => x.region === r); return list.length ? `<optgroup label="${r === 'Societies' ? 'Housing societies' : r}">${list.map(x => `<option value="${x.id}">${esc(x.city)} — ${esc(x.short)}</option>`).join('')}</optgroup>` : ''; }).join('');
    ['#ask-loc', '#bl-auth'].forEach(sel => { const el = $(sel); if (el) { if (!el.dataset.ready) { el.innerHTML = opts; el.dataset.ready = '1'; el.addEventListener('change', e => setAuthority(e.target.value)); } el.value = st.authority; } });
    const grid = $('#auth-choices');
    if (grid) {
      grid.innerHTML = '';
      REGIONS.forEach(r => { const list = AU.AUTHORITIES.filter(x => x.region === r); if (!list.length) return;
        const row = document.createElement('div'); row.className = 'auth-row';
        row.innerHTML = `<span class="lab">${r === 'Societies' ? 'Housing societies' : r}</span><div class="auth-chips"></div>`;
        list.forEach(x => { const b = document.createElement('button'); b.type = 'button'; b.className = 'auth-chip'; b.setAttribute('aria-pressed', String(x.id === st.authority)); b.title = x.name;
          const cityTxt = x.city.replace(/ \(CDA sectors\)/, '').replace(x.short, '').replace(/^Town /, '').trim(); b.innerHTML = `<b>${esc(x.short)}</b>${cityTxt && x.region !== 'Societies' ? `<span>${esc(cityTxt)}</span>` : ''}`; b.addEventListener('click', () => setAuthority(x.id)); row.lastChild.appendChild(b); });
        grid.appendChild(row); });
    }
    const info = $('#auth-info');
    if (info) info.innerHTML = `<span class="pill ${a.conf === 'official' ? 'ok' : 'warn'}">${esc(a.conf)}</span> <b>${esc(a.name)}</b> — ${esc(a.source.name)}. <span class="hint">${esc(AU.CONF[a.conf] || '')}</span>`;
    const ch = $('#loc-chip'); if (ch) ch.textContent = `${a.short} · ${a.city}`;
  }
  function renderBylaws() {
    if (!AU) return; renderAuthUI(); const a = AUN(); const host = $('#bl-table'); if (!host) return;
    const plots = PL();
    const rows = plots.map(p => { const r = RF(p); return `<tr><td><b>${p.w} × ${p.d}</b> <span class="hint">${esc(p.common)}</span><br><span class="hint">${esc(r.band || r.row)}</span></td><td class="num">${r.front}′</td><td class="num">${r.rear}′</td><td class="num">${r.sideL || r.sideR ? `${r.sideL}′ / ${r.sideR}′` : '—'}</td><td class="num">${Math.round(r.cov * 100)}%</td><td class="num">${(+r.far).toFixed(2)}</td><td class="num">${r.authority === 'cda' ? '2 · 30′' : `${r.storeys} · ${r.height}′`}</td><td class="num">${r.noMumty ? 'not allowed' : r.tower ? r.tower + ' ft²' : '—'}</td></tr>`; }).join('');
    host.innerHTML = `<thead><tr><th>Plot</th><th class="num">Front</th><th class="num">Rear</th><th class="num">Sides</th><th class="num">Coverage</th><th class="num">FAR</th><th class="num">Storeys · height</th><th class="num">Mumty</th></tr></thead><tbody>${rows}</tbody>`;
    $('#bl-src').innerHTML = `<span class="pill ${a.conf === 'official' ? 'ok' : 'warn'}">${esc(a.conf)}</span> ${esc(AU.CONF[a.conf] || '')}. Source: <a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.name)}</a>. BuildMe designs up to two storeys; FAR shown is the published value, or ground + first floor where the authority sets none.`;
    $('#bl-all').innerHTML = AU.AUTHORITIES.map(x => `<li><b>${esc(x.short)}</b> — ${esc(x.city)}: <a href="${esc(x.source.url)}" target="_blank" rel="noopener">${esc(x.source.name)}</a> <span class="pill ${x.conf === 'official' ? 'ok' : 'warn'}">${esc(x.conf)}</span></li>`).join('');
  }

  // ======================= QUESTIONS =======================
  function choiceBtn(big, small, pressed) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice';
    b.setAttribute('aria-pressed', String(!!pressed));
    b.innerHTML = `<span class="big">${big}</span>${small ? `<span class="small">${small}</span>` : ''}`;
    return b;
  }
  function renderPlotChoices() {
    const el = $('#plot-choices'); el.innerHTML = '';
    PL().forEach(p => { const b = choiceBtn(`${p.w} × ${p.d}`, `${p.common} · ${p.sqyd} sq yd`, st.plot && st.plot.id === p.id && !st.plot.custom); b.addEventListener('click', () => choosePlot(p)); el.appendChild(b); });
  }
  function choosePlot(p) {
    const changed = !st.plot || st.plot.id !== p.id;
    st.plot = p; st.rules = RF(p); if (changed) { st.opts = P.defaultOpts(p); st.projectName = `${p.common} house`; }
    $('#plot-msg').textContent = ''; renderPlotChoices(); renderAllow(); syncStep(); saveAnswers();
  }
  $('#custom-go').addEventListener('click', () => {
    const w = Math.round(+$('#cw').value), d = Math.round(+$('#cd').value); const m = $('#plot-msg');
    if (!(w >= 20 && w <= 120)) { m.textContent = 'Enter a width between 20 and 120 ft.'; m.className = 'msg err'; $('#cw').focus(); if (H) H.toast({ kind: 'bad', title: 'That width won\u2019t work', text: 'BuildMe designs plots 20\u2013120 ft wide (the side facing the road).' }); return; }
    if (!(d >= 30 && d <= 200)) { m.textContent = 'Enter a depth between 30 and 200 ft.'; m.className = 'msg err'; $('#cd').focus(); if (H) H.toast({ kind: 'bad', title: 'That depth won\u2019t work', text: 'BuildMe designs plots 30\u2013200 ft deep.' }); return; }
    if (w < 25 && H) H.toast({ title: 'Narrow plot', text: 'Under 25 ft wide, BuildMe puts the bedrooms upstairs \u2014 choose double storey on the next step.', mood: 'think' });
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
    const au = AUN();
    return `<h3>What ${esc(au.short)} allows on a ${p.w} × ${p.d} plot</h3><div class="allow-grid">
      ${cell('Ground floor, max', fmtN(R.cov * A) + ' ft²')}${cell('Total built, max', fmtN(R.far * A) + ' ft²')}
      ${cell('Front / rear open', `${R.front}' / ${R.rear}'`)}${cell('Side open', R.sideL + R.sideR ? `${R.sideL}' / ${R.sideR}'` : 'none (terraced)')}
      ${cell('Floors', R.authority && R.authority !== 'cda' ? `up to ${R.storeys} · ${R.height}′` : '2 + mumty')}${cell('Car porch', pr.total + ' ft²')}</div>
      ${R.authority && R.authority !== 'cda' ? `<p><span class="pill ${R.conf === 'official' ? 'ok' : 'warn'}">${R.conf}</span> ${esc(au.name)} · ${esc(R.band)} — ${esc(R.source.name)}.${R.note ? ' ' + esc(R.note) + '.' : ''} BuildMe designs up to 2 storeys.</p>` : `<p>Category ${R.cat} · ${esc(R.row)} — CDA Residential Sectors Zoning Regulation 1993, Schedule A.${R.servantRequired ? ' A servant room with bath is required on this plot size.' : ''}</p>`}`;
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
  $('#r-reset').addEventListener('click', () => { st.rules = RF(st.plot); renderReview(); });
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
  function saveAnswers() { store.set('buildme.answers', JSON.stringify({ plot: st.plot, facing: st.facing, corner: st.corner, opts: st.opts, authority: st.authority })); }

  // ======================= DESIGN =======================
  function design(newSeed) {
    if (newSeed) st.seed = (st.seed * 1103515245 + 12345) >>> 0;
    if (st.route !== 'new') go('new', { step: st.step });
    $$('[data-step]').forEach(c => c.hidden = true); $('#working').hidden = false;
    if (H) { const f = H.FAQ[Math.floor(Math.random() * H.FAQ.length)]; $('#working').innerHTML = `<span class="w-mm">${H.mimarSVG('mood-think')}</span><div><b>Mimar is drawing layouts that fit your plot\u2026</b><span class="hint">Did you know? ${esc(f.tip || f.q)}</span></div>`; }
    setTimeout(() => {
      const diag = {}; let err = null;
      try { st.options = P.generate(st.plot, Object.assign({}, st.opts, { corner: st.corner }), st.rules, st.seed, 100, diag); }
      catch (e) { st.options = []; err = e; if (window.console) console.error(e); }
      $('#working').hidden = true;
      if (!st.options.length) { goStep(3, true); explainNoFit(diag, err); return; }
      $('#nav-design').hidden = false;
      loadOption(0); go('design');
      const notes = (st.options[0].notes || []).filter((v, i, a) => a.indexOf(v) === i && !/^First floor:/.test(v));
      if (H && notes.length) H.toast({ title: `Mimar adjusted ${notes.length} thing${notes.length > 1 ? 's' : ''} to make it fit`, text: notes[0], action: { label: 'Why?', run: () => explainAdjust(notes) }, ms: 9000 });
      else if (H) H.say(`${st.options.length} layout${st.options.length > 1 ? 's' : ''} fit your plot. Click one to compare, then try the 3D tab.`, 'happy');
    }, 30);
  }

  // ---------- explaining failures and adjustments (Mimar pop-ups) ----------
  function fitFacts() {
    const R = st.rules, p = st.plot; const W = p.w - R.sideL - R.sideR, D = p.d - R.front - R.rear;
    return { W, D, cov: Math.round(R.cov * p.sqft), far: Math.round(R.far * p.sqft) };
  }
  function explainNoFit(diag, err) {
    if (!H) { alert('No layout fits these answers. Try fewer rooms or double storey.'); return; }
    const o = st.opts, p = st.plot, f = fitFacts(); const reasons = []; const fx = P.fmt;
    const keys = Object.keys(diag || {}).filter(k => typeof diag[k] === 'number');
    const has = re => keys.some(k => re.test(k));
    if (err) reasons.push({ title: 'Something went wrong while designing', text: String(err.message || err).slice(0, 140) });
    if (has(/^scheme$/) || f.W < 16) reasons.push({ title: `Only ${fx(Math.max(0, f.W))} of buildable width`, text: `After side setbacks the house can be at most ${fx(Math.max(0, f.W))} wide; BuildMe needs at least 16'-0" for a room beside the stairs.` });
    if (has(/middle row/)) reasons.push({ title: 'Lounge, kitchen and stairs don\u2019t fit across', text: `With the bedrooms you asked for, the middle row needs more than the ${fx(f.W)} the house can be wide.` });
    if (has(/front row/)) reasons.push({ title: 'The front row is too crowded', text: `The car porch (${o.cars >= 2 ? '18\'-6"' : '10\'-6"'} wide) plus the rooms beside it need more than ${fx(f.W)}.` });
    if (has(/rear row/)) reasons.push({ title: 'The bedrooms don\u2019t fit across the back', text: `Each bedroom with its bath needs about 15 ft of width; ${fx(f.W)} isn\u2019t enough for that many in one row.` });
    if (has(/^depth$/)) reasons.push({ title: 'Not enough depth within the coverage limit', text: `The ground floor may cover ${f.cov.toLocaleString('en-PK')} ft\u00b2 (${Math.round(st.rules.cov * 100)}%), which leaves too little depth for every row.` });
    if (has(/^unreach/)) reasons.push({ title: 'Some rooms ended up without a door', text: 'Every arrangement tried left a room reachable only through another room.' });
    if (!reasons.length) reasons.push({ title: `The brief needs more space than ${AUN().short} allows here`, text: `Ground floor max ${f.cov.toLocaleString('en-PK')} ft\u00b2, total max ${f.far.toLocaleString('en-PK')} ft\u00b2.` });
    const fixes = []; const redo = ch => () => { Object.assign(st.opts, ch); if (st.opts.gfBeds > st.opts.beds) st.opts.gfBeds = st.opts.beds; saveAnswers(); design(); };
    if (o.storeys === 1) fixes.push({ label: 'Make it double storey', run: redo({ storeys: 2, gfBeds: Math.min(1, o.beds) }) });
    if (o.beds > 1) fixes.push({ label: `Try ${o.beds - 1} bedroom${o.beds - 1 > 1 ? 's' : ''}`, run: redo({ beds: o.beds - 1 }) });
    if (o.drawing) fixes.push({ label: 'Without the drawing room', run: redo({ drawing: false }) });
    if (o.cars >= 2) fixes.push({ label: 'One-car porch', run: redo({ cars: 1 }) });
    if (o.dining) fixes.push({ label: 'Dining in the lounge', run: redo({ dining: false }) });
    if (p.w < 25) fixes.push({ label: `Use a ${PL()[1].w} \u00d7 ${PL()[1].d} plot instead`, run: () => { const q = PL()[1]; st.plot = q; st.rules = RF(q); st.opts.storeys = 2; renderPlotChoices(); renderAllow(); saveAnswers(); design(); } });
    H.oops({
      title: `No layout fits ${p.w} \u00d7 ${p.d} with this brief`,
      lead: `I tried hundreds of arrangements for ${o.storeys === 2 ? 'a double' : 'a single'} storey with ${o.beds} bedroom${o.beds > 1 ? 's' : ''}${o.drawing ? ', a drawing room' : ''}${o.dining ? ', separate dining' : ''}. Here\u2019s what got in the way:`,
      reasons: reasons.slice(0, 4), fixes: fixes.slice(0, 4), faqs: p.w < 25 ? ['narrow', 'howmany', 'nofit'] : ['nofit', 'howmany', 'order'],
      closeLabel: 'Change my answers',
    });
  }
  function explainAdjust(notes) {
    if (!H) return;
    H.oops({ kind: 'info', title: 'Here\u2019s what I changed, and why', lead: `Your full brief didn\u2019t fit ${st.plot.w} \u00d7 ${st.plot.d} under ${AUN().short} rules, so I made the gentlest changes that work:`,
      reasons: notes.map(n => ({ title: n })), fixLabel: 'Prefer something else?',
      fixes: [{ label: 'Change my answers', run: () => go('new', { step: 1 }) }].concat(st.opts.storeys === 1 ? [{ label: 'Try double storey', run: () => { st.opts.storeys = 2; st.opts.gfBeds = Math.min(1, st.opts.beds); saveAnswers(); design(); } }] : []),
      faqs: ['order', 'fewer', 'howmany'], closeLabel: 'Keep these layouts' });
  }
  $('#change').addEventListener('click', () => go('new', { step: 3 }));
  $('#more-opts').addEventListener('click', () => design(true));
  function loadOption(i) {
    st.opt = i; const p = st.options[i];
    st.cur = p ? { scheme: p.scheme, plan: p } : null; st.hist = []; st.fut = []; st.locked = false; st.interior = {}; st.iroom = null; st.sel = null; st.floor = 0; st._animate3d = true; st.dirty = true;
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
    if (st.locked) { say('The design is locked for interiors. Unlock it (green bar above) to change rooms.', true); return false; }
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
    $('#notes').hidden = !nts.length; $('#notes').innerHTML = nts.length ? 'Adjusted to fit: ' + esc(nts.join(' ')) + ' <button class="btn link" type="button" id="notes-why">Why?</button>' : '';
    if (nts.length) $('#notes-why').addEventListener('click', () => explainAdjust(nts));
    if (st.floor >= p.floors.length + (p.floors.length > 1 ? 1 : 0)) st.floor = 0;
    const tabs = p.floors.map((f, i) => i ? 'First floor' : 'Ground floor'); if (p.floors.length > 1) tabs.push('Roof');
    $('#floor-tabs').innerHTML = tabs.map((t, i) => `<button role="tab" aria-selected="${i === st.floor}" data-f="${i}">${t}</button>`).join('');
    $$('#floor-tabs button').forEach(b => b.addEventListener('click', () => { st.floor = +b.dataset.f; renderResults(); }));
    const rot = { N: 0, E: -90, S: 180, W: 90 }[st.facing];
    $('#north').innerHTML = `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9" fill="#fff" stroke="currentColor" stroke-width=".8"/><g transform="rotate(${rot})"><path d="M0 -7 L3 4 L0 2 L-3 4 Z" fill="var(--primary)"/></g></svg><span>North</span>`;
    const label = FACING[st.facing].toUpperCase();
    $('#plan-view').innerHTML = st.floor < p.floors.length ? V.renderFloor(p, st.floor, { facing: label, uid: 'm', sel: st.sel }) : V.renderRoof(p, { facing: label, uid: 'rf' });
    renderFacts(p); renderTips(p); renderChecks(p); renderSchedule(p); renderEditor(); renderInspector();
    $('#lock-banner').hidden = !st.locked; $('#lock-btn').hidden = st.locked; $('#nav-interior').hidden = !st.locked; renderPhase();
    ['#more-opts', '#change', '#mirror', '#undo', '#redo', '#revert'].forEach(id => { const b = $(id); if (b && st.locked) b.disabled = true; });
    if (!st.locked) { $('#more-opts').disabled = false; $('#change').disabled = false; $('#mirror').disabled = false; }
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
    else tips.push({ k: 'good', t: `Within ${AUN().short} bylaws`, d: `Setbacks, coverage, FAR, porch and room sizes all pass for a ${p.plot.common} plot.` });
    if (p.floors.length > 1 && s.far / s.farMax < 0.88) tips.push({ t: 'Room to grow upstairs', d: `You're using ${Math.round(s.far / s.farMax * 100)}% of the allowed built area — about ${fmtN(s.farMax - s.far)} ft² is unused. Add a study or family lounge upstairs.`, a: ['edit', 'Add a room'] });
    if (p.floors[0].rooms.some(r => r.skylight)) tips.push({ t: 'Lounge needs a skylight', d: 'The TV lounge has no outside wall, so it relies on a skylight. Swap it with a room on the front or rear row for a window.', a: ['edit', 'Customise'] });
    warns.forEach(w => tips.push({ k: 'warn', t: w.label, d: w.detail }));
    p.floors.forEach((f, fi) => f.issues.forEach(i => tips.push({ t: (fi ? 'First floor: ' : 'Ground floor: ') + i, d: 'Try mirroring the layout or swapping it with a room on an outside wall.', a: ['edit', 'Customise'] })));
    if (p.floors[0].rooms.some(r => r.kitchenEntry)) tips.push({ k: 'warn', t: 'Kitchen door from the porch', d: 'On this tight plot the kitchen opens from the porch. Pick another layout or drop a room for a separate entrance.', a: ['faq:kitchenentry', 'Why?'] });
    if (p.notes && p.notes.length) tips.push({ t: 'Brief adjusted to fit', d: p.notes.slice(0, 2).join(' '), a: ['why', 'See what changed'] });
    const sun = { N: 'Road on the north: front rooms stay cool and evenly lit — large front windows work well.', S: 'Road on the south: the front gets strong sun. Deep sunshades (Contemporary style) keep front rooms cooler.', E: 'Road on the east: morning sun on the front. Bedrooms at the back stay cooler in the evening.', W: 'Road on the west: harsh afternoon sun on the front. Use sunshades or louvers (Modern style) on front windows.' };
    tips.push({ t: 'Orientation', d: sun[st.facing] });
    if (v3style === 'massing') tips.push({ t: 'Pick an elevation style', d: 'See the house in Modern, Spanish, French and other Pakistani styles, and include its finish in the cost.', a: ['3d', 'Open 3D & styles'] });
    if (!st.projectId || st.dirty) tips.push({ t: st.projectId ? 'Unsaved changes' : 'Save this design', d: 'Save it to your projects to compare designs from the dashboard later.', a: ['save', 'Save project'] });
    $('#tips').innerHTML = tips.slice(0, 7).map(x => `<li class="${x.k || ''}"><b>${esc(x.t)}</b><span>${esc(x.d)}</span>${x.a ? `<button class="btn sm soft act" data-tip="${x.a[0]}">${esc(x.a[1])}</button>` : ''}</li>`).join('');
    $$('#tips [data-tip]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.tip; if (a === 'save') saveProject(); else if (a === 'why') explainAdjust((p.notes || []).filter((v, i, x) => x.indexOf(v) === i)); else if (a.startsWith('faq:') && H) H.openFaq(a.slice(4)); else selectTab(a); }));
  }
  function renderChecks(p) {
    const bad = p.checks.filter(c => c.s === 'bad').length, warn = p.checks.filter(c => c.s === 'warn').length;
    $('#checks-sum').textContent = bad ? `${bad} issue${bad > 1 ? 's' : ''} to fix` : warn ? `All checks pass · ${warn} note${warn > 1 ? 's' : ''}` : `All ${p.checks.length} ${AUN().short} checks pass`;
    $('#compliance').innerHTML = p.checks.map(c => `<li><span class="pill ${c.s}">${c.s === 'ok' ? 'Pass' : c.s === 'warn' ? 'Note' : 'Fail'}</span><span><b>${esc(c.label)}.</b> ${esc(c.detail)}</span></li>`).join('');
  }
  const ORD = ['porch', 'foyer', 'drawing', 'powder', 'lounge', 'flounge', 'dining', 'kitchen', 'store', 'bed', 'dress', 'bath', 'study', 'servant', 'sbath', 'laundry', 'stair', 'passage', 'terrace', 'court', 'proof'];
  function renderSchedule(p) {
    const names = ['Ground floor', 'First floor']; let n = 0;
    const rows = ['<thead><tr><th>Room</th><th class="num">Size (clear)</th><th class="num">Area ft²</th><th>Minimum size</th></tr></thead><tbody>'];
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
      plot: st.plot, facing: st.facing, corner: st.corner, opts: st.opts, rules: st.rules, authority: st.authority, locked: st.locked, interior: st.interior, scheme: st.cur.scheme, style: v3style, finish: st.finish,
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
    if (pr.authority && AU && AU.byId[pr.authority]) { st.authority = pr.authority; store.set('buildme.authority', pr.authority); renderAuthUI(); }
    st.plot = pr.plot; st.facing = pr.facing; st.corner = pr.corner; st.opts = pr.opts; st.rules = pr.rules; st.finish = pr.finish || 'standard';
    st.locked = !!pr.locked; st.interior = pr.interior || {};
    st.projectId = pr.id; st.projectName = pr.name; st.options = [plan]; st.opt = 0;
    st.cur = { scheme: plan.scheme, plan }; st.hist = []; st.fut = []; st.sel = null; st.floor = 0; st._animate3d = true; st.dirty = false;
    if (M3 && pr.style && M3.STYLES[pr.style]) { v3style = pr.style; $$('#style-chips button').forEach(x => x.setAttribute('aria-checked', String(x.dataset.k === v3style))); $('#style-blurb').textContent = M3.STYLES[v3style].blurb; if (viewer) viewer.setStyle(v3style); }
    lastPlan = null; $('#nav-design').hidden = false; $('#nav-interior').hidden = !st.locked; renderOpts(); go('design'); selectTab('plans');
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
    catDone = true; const grid = $('#cat-grid'); $('#cat-sub').textContent = `Best suggestion for each standard ${AUN().short} plot (${AUN().city}) with typical answers. Pick one to start designing.`; grid.innerHTML = '<p class="hint">Designing a plan for every plot…</p>'; let i = 0; let first = true;
    const next = () => {
      if (i >= PL().length) return; const plot = PL()[i++]; const R = RF(plot);
      const plans = P.generate(plot, P.defaultOpts(plot), R, catSeed + i * 101, 60); const p = plans[0];
      if (first) { grid.innerHTML = ''; first = false; }
      const card = document.createElement('article'); card.className = 'card cat-card';
      if (!p) card.innerHTML = `<div class="top"><h3>${plot.w} × ${plot.d}</h3></div><p class="hint" style="padding:0 16px">No layout found.</p>`;
      else {
        const bad = p.checks.filter(c => c.s === 'bad').length;
        card.innerHTML = `<div class="top"><h3>${plot.w} × ${plot.d}</h3><span>${plot.common} · ${plot.sqyd} sq yd · ${R.authority && R.authority !== 'cda' ? esc(R.auth) : 'Cat ' + R.cat}</span></div>
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
    estFill();
    $('#est-style').innerHTML = M3 ? Object.entries(M3.STYLES).filter(([k]) => k !== 'massing').map(([k, s]) => `<option value="${k}">${s.name} (+${Math.round(s.premium * 100)}%)</option>`).join('') : '<option value="">Plain</option>';
    $('#est-style').value = 'minimalist';
    ['est-plot', 'est-storeys'].forEach(id => $('#' + id).addEventListener('change', () => { estArea(true); renderEstimator(); }));
    ['est-style', 'est-area'].forEach(id => $('#' + id).addEventListener('input', renderEstimator));
    $('#est-design').addEventListener('click', () => startWithPlot(PL().find(p => p.id === $('#est-plot').value)));
    estArea(true);
  }
  function estFill() { $('#est-plot').innerHTML = PL().map(p => `<option value="${p.id}">${p.w} × ${p.d} — ${p.common} (${p.sqyd} yd²)</option>`).join(''); $('#est-plot').value = (st.plot && PL().some(p => p.id === st.plot.id) && st.plot.id) || (PL()[3] || PL()[0]).id; estArea(true); }
  function estMax() { const p = PL().find(x => x.id === $('#est-plot').value); const R = RF(p); const one = $('#est-storeys').value === '1'; return { p, R, max: Math.round(one ? R.cov * p.sqft : R.far * p.sqft) }; }
  function estArea(reset) { const m = estMax(); if (reset || !$('#est-area').value) $('#est-area').value = Math.round(m.max * 0.92 / 10) * 10; }
  function renderEstimator() {
    const m = estMax(); const area = Math.max(0, +$('#est-area').value || 0); const sk = $('#est-style').value; const prem = M3 && M3.STYLES[sk] ? M3.STYLES[sk].premium : 0;
    $('#est-max').textContent = `${AUN().short} allows up to ${fmtN(m.max)} ft² on this plot ${$('#est-storeys').value === '1' ? '(single storey, ' + Math.round(m.R.cov * 100) + '% coverage)' : '(FAR ' + m.R.far + ')'}.${area > m.max ? ' Your figure is above that limit.' : ''}`;
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
      generator: `BuildMe (rule-based, ${AUN().name} bylaws)`, authority: st.authority, project: st.projectName, units: 'ft', plot: { w: p.plot.w, d: p.plot.d, sqyd: p.plot.sqyd, road: FACING[st.facing] },
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

  // ======================= PHASES, LOCK & INTERIORS =======================
  function renderPhase() {
    const names = ['Brief', 'Floor plans', 'Lock', 'Interiors', 'Design package'];
    const now = st.route === 'interior' ? 3 : st.locked ? 3 : 1;
    const html = names.map((n, i) => `<li class="${i < now ? 'done' : i === now ? 'now' : ''}"><span class="n">${i < now ? '✓' : i + 1}</span>${n}</li>`).join('');
    ['#phase-d', '#phase-i'].forEach(id => { const el = $(id); if (el) el.innerHTML = html; });
  }
  function lockDesign() {
    if (!st.cur) return; const fails = st.cur.plan.checks.filter(c => c.s === 'bad');
    const go2 = () => { st.locked = true; st.dirty = true; st.iroom = null; st.ifloor = 0; $('#nav-interior').hidden = false; go('interior'); if (H) H.say('Pick a room on the plan. I\u2019ve furnished every room to start — drag things around in 3D.', 'idea'); };
    if (!H) { go2(); return; }
    H.oops({ kind: 'info', kicker: 'Next phase', title: 'Lock this layout and design the interiors?', lead: 'Locking freezes the floor plan so furniture layouts stay valid. You can unlock later.',
      reasons: [{ title: `${st.cur.plan.floors.reduce((a, f) => a + f.rooms.filter(r => !I.NOFURN.has(r.t)).length, 0)} rooms to furnish`, text: 'Every room starts with an automatic furniture layout you can change.' }].concat(fails.length ? [{ title: `${fails.length} bylaw issue${fails.length > 1 ? 's' : ''} still open`, text: fails.map(f => f.label).join(', ') }] : []),
      fixes: [{ label: 'Lock and start interiors', run: go2 }], fixLabel: 'Ready?', closeLabel: 'Not yet', faqs: ['interiors', 'package'] });
  }
  $('#lock-btn').addEventListener('click', lockDesign);
  $('#unlock-btn').addEventListener('click', () => { st.locked = false; st.dirty = true; $('#nav-interior').hidden = true; renderResults(); toast('Design unlocked — you can edit rooms again.'); });

  const ITHEME = () => (I && I.THEMES[store.get('buildme.itheme')]) ? store.get('buildme.itheme') : 'modern';
  st.itheme = ITHEME(); st.ifloor = 0; st.iroom = null; let rv = null, rvFailed = false;
  function iGet(g) {
    let r = st.interior[g.key];
    if (!r) { r = st.interior[g.key] = { items: I.layout(g, lctx(g)), fin: I.defaultFinish(g.t), touched: false, done: false }; }
    if (!r.fin) r.fin = I.defaultFinish(g.t); return r;
  }
  function lctx(g, role) { // layout context: dining room present, which bedroom is the master, how many bedrooms
    const p = st.cur.plan; const f = p.floors[g.fi]; const beds = []; p.floors.forEach((ff, fi) => ff.rooms.forEach(r => { if (r.t === 'bed') beds.push({ fi, r, a: (r.w - 0.75) * (r.h - 0.75) }); }));
    const top = beds.filter(b => b.fi === p.floors.length - 1).sort((a, b) => b.a - a.a)[0]; const saved = st.interior[g.key];
    return { hasDining: f.rooms.some(x => x.t === 'dining'), largestBed: !!top && top.fi === g.fi && I.roomGeom(p, top.fi, top.r).key === g.key && g.fi === 1, bedCount: beds.length, role: role || (saved && saved.role) || undefined };
  }
  function iRooms(fi) { const p = st.cur.plan; return p.floors[fi].rooms.filter(r => !I.NOFURN.has(r.t)).map(r => I.roomGeom(p, fi, r)); }
  function iGeom(key) { const p = st.cur.plan; for (let fi = 0; fi < p.floors.length; fi++) for (const r of p.floors[fi].rooms) { if (I.NOFURN.has(r.t)) continue; const g = I.roomGeom(p, fi, r); if (g.key === key) return g; } return null; }
  const pkrR = r => X.pkrRange({ lo: r[0], hi: r[1] });
  const istat = (t, err) => { const m = $('#int-status'); m.textContent = t; m.className = 'msg' + (err ? ' err' : t ? ' ok' : ''); };
  function renderInterior() {
    if (!I || !st.cur) return; const p = st.cur.plan; renderPhase();
    if (st.ifloor >= p.floors.length) st.ifloor = 0;
    const all = []; p.floors.forEach((f, fi) => iRooms(fi).forEach(g => all.push(g)));
    const done = all.filter(g => iGet(g).done).length, edited = all.filter(g => iGet(g).touched && !iGet(g).done).length;
    const tot = all.reduce((a, g) => { const b = I.roomBudget(g, iGet(g).items, iGet(g).fin, st.itheme).total; return [a[0] + b[0], a[1] + b[1]]; }, [0, 0]);
    $('#int-sub').textContent = `${p.plot.w} × ${p.plot.d} · ${all.length} rooms · ${done} done · ${edited} edited · ${all.length - done - edited} auto · interior budget ${pkrR(tot)}`;
    const ts = $('#int-theme'); if (!ts.dataset.ready) { ts.innerHTML = Object.entries(I.THEMES).map(([k, t]) => `<option value="${k}">${t.n} — ${t.blurb}</option>`).join(''); ts.dataset.ready = '1'; ts.addEventListener('change', e => { st.itheme = e.target.value; store.set('buildme.itheme', st.itheme); st.dirty = true; renderInterior(); }); }
    ts.value = st.itheme;
    $('#int-floors').innerHTML = p.floors.map((f, i) => `<button role="tab" aria-selected="${i === st.ifloor}" data-f="${i}">${i ? 'First floor' : 'Ground floor'}</button>`).join('');
    $$('#int-floors button').forEach(b => b.addEventListener('click', () => { st.ifloor = +b.dataset.f; const first = iRooms(st.ifloor)[0]; st.iroom = first ? first.key : null; renderInterior(); }));
    const rooms = iRooms(st.ifloor); if (!st.iroom || !rooms.some(g => g.key === st.iroom) && !iGeom(st.iroom)) st.iroom = (rooms.find(g => g.t === 'lounge') || rooms[0] || {}).key || null;
    let svg = V.renderFloor(p, st.ifloor, { facing: FACING[st.facing].toUpperCase(), uid: 'in' });
    svg = I.inject(svg, I.floorLayer(p, st.ifloor, iGet, st.itheme, { selKey: st.iroom, badges: true, fadeAuto: true }));
    $('#int-plan').innerHTML = svg;
    $$('#int-plan .rm-hit').forEach(r => r.addEventListener('click', () => selectIRoom(r.dataset.key)));
    $('#int-rooms').innerHTML = rooms.map(g => { const r = iGet(g); const c = r.done ? '#16865A' : r.touched ? '#1E6FD9' : '#B9C7D6'; return `<li><button type="button" data-key="${esc(g.key)}" aria-current="${g.key === st.iroom}"><i style="background:${c}"></i><span>${esc(g.name)}</span><small>${Math.round(g.area)} ft²</small></button></li>`; }).join('');
    $$('#int-rooms [data-key]').forEach(b => b.addEventListener('click', () => selectIRoom(b.dataset.key)));
    renderRoomPanel();
  }
  function selectIRoom(key) { st.iroom = key; const g = iGeom(key); if (g) st.ifloor = g.fi; renderInterior(); if (window.innerWidth < 1150) { const el = $('.int-room'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  function initRV() {
    if (rv || rvFailed || !I3) return rv;
    try {
      rv = new I3.RoomViewer($('#rm3d'));
      rv.onSelect = () => renderSel();
      rv.onChange = () => { const g = iGeom(st.iroom); if (!g) return; const r = iGet(g); r.touched = true; st.dirty = true; renderInteriorLite(); };
    } catch (e) { rvFailed = true; $('#rm-status').textContent = '3D view unavailable here (needs WebGL). The 2D plan still updates.'; }
    return rv;
  }
  function renderInteriorLite() { // refresh plan + lists without rebuilding the 3D scene
    const p = st.cur.plan; let svg = V.renderFloor(p, st.ifloor, { facing: FACING[st.facing].toUpperCase(), uid: 'in' });
    svg = I.inject(svg, I.floorLayer(p, st.ifloor, iGet, st.itheme, { selKey: st.iroom, badges: true, fadeAuto: true }));
    $('#int-plan').innerHTML = svg; $$('#int-plan .rm-hit').forEach(r => r.addEventListener('click', () => selectIRoom(r.dataset.key)));
    $$('#int-rooms [data-key]').forEach(b => { const g = iGeom(b.dataset.key); if (!g) return; const r = iGet(g); b.querySelector('i').style.background = r.done ? '#16865A' : r.touched ? '#1E6FD9' : '#B9C7D6'; });
    renderSched(); renderSel(); renderDraw();
    const g = st.iroom && iGeom(st.iroom); if (g) { const r = iGet(g); $('#rm-sub').textContent = `${I.ft(g.W)} × ${I.ft(g.H)} clear · ${Math.round(g.area)} ft² · ${r.done ? 'done' : r.touched ? 'edited by you' : 'auto-furnished'}`; }
  }
  function renderRoomPanel() {
    const g = st.iroom && iGeom(st.iroom); const has = !!g;
    $('#rm-title').textContent = has ? `${g.fi ? 'First floor' : 'Ground floor'} · ${g.name}` : 'Pick a room';
    if (!has) { $('#rm-sub').textContent = ''; return; }
    const r = iGet(g);
    $('#rm-sub').textContent = `${I.ft(g.W)} × ${I.ft(g.H)} clear · ${Math.round(g.area)} ft² · ${r.done ? 'done' : r.touched ? 'edited by you' : 'auto-furnished'}`;
    $('#rm-done').textContent = r.done ? 'Done ✓ (reopen)' : 'Mark room done'; $('#rm-done').classList.toggle('primary', !r.done);
    $('#rm-add').innerHTML = I.addList(g.t).map(k => `<option value="${k}">${esc(I.F[k].n)}</option>`).join('');
    $('#rm-floor').innerHTML = Object.entries(I.FLOORS).map(([k, f]) => `<button type="button" data-k="${k}" aria-pressed="${r.fin.floor === k}">${esc(f.n)}</button>`).join('');
    $$('#rm-floor [data-k]').forEach(b => b.addEventListener('click', () => { r.fin.floor = b.dataset.k; r.touched = true; st.dirty = true; renderRoomPanel(); renderInteriorLite(); }));
    $('#rm-wall').innerHTML = g.open ? '<span class="hint">Open area — no walls to paint.</span>' : Object.entries(I.WALLS).map(([k, w]) => `<button type="button" data-k="${k}" title="${esc(w.n)}" aria-label="${esc(w.n)} walls" aria-pressed="${r.fin.wall === k}" style="background:${w.color}"></button>`).join('');
    $$('#rm-wall [data-k]').forEach(b => b.addEventListener('click', () => { r.fin.wall = b.dataset.k; r.touched = true; st.dirty = true; renderRoomPanel(); }));
    const roles = I.ROLES[g.t === 'flounge' ? 'lounge' : g.t]; $('#rm-purpose-row').hidden = !roles;
    if (roles) { const cur = r.role || I.autoRole(g, lctx(g)); $('#rm-role').innerHTML = Object.entries(roles).map(([k, n]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(n)}</option>`).join(''); }
    requestAnimationFrame(() => { if (initRV()) { const keep = rv.g && rv.g.key === g.key; if (!keep) rv.sel = null; rv.setRoom(g, r.items, r.fin, st.itheme, keep); } renderSel(); });
    renderSched(); renderDraw();
  }
  // ---- room drawings, specs and BOQ tabs ----
  st.rtab = '3d';
  function renderChecks() { const g = st.iroom && iGeom(st.iroom); if (!g) { $('#rm-checks').innerHTML = ''; return; } const col = { ok: '#16865A', warn: '#B7700E', bad: '#C2392D' };
    $('#rm-checks').innerHTML = I.spaceCheck(g, iGet(g).items).map(c => `<li><i style="background:${col[c.s]}"></i><span>${esc(c.text)}</span></li>`).join(''); }
  function renderDraw() {
    renderChecks(); const t = st.rtab; const g = st.iroom && iGeom(st.iroom); const is3d = t === '3d' || !g || !DT;
    $('#rm-stage').hidden = !is3d; $('#rm-draw').hidden = is3d; $('#rm-views').style.visibility = is3d ? '' : 'hidden';
    $$('#rm-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === (is3d ? '3d' : t))));
    if (is3d) { if (rv) { rv.resize(); rv.kick(); } return; }
    const r = iGet(g); const th = st.itheme, fin = r.fin, items = r.items; const box = $('#rm-draw'); const num = v => Math.round(v).toLocaleString('en-PK');
    const openNote = '<p class="hint">Open-to-sky area — no walls or ceiling to detail.</p>';
    if (t === 'plan') box.innerHTML = DT.planSVG(g, items, th, fin) + '<p class="hint">Dashed blue zones are the clear space each piece needs; orange dimensions are walkways and openings. Numbers match the schedule below.</p>';
    else if (t === 'elev') box.innerHTML = g.open ? openNote : '<div class="el-grid">' + DT.elevations(g, items, th, fin, DT.electrical(g, items)).map(e => `<div>${e.svg}</div>`).join('') + '</div>';
    else if (t === 'rcp') { const cl = DT.ceiling(g, items); box.innerHTML = g.open ? openNote : DT.ceilingSVG(g, items, cl) + `<p class="hint">${esc(cl.note)}</p>`; }
    else if (t === 'elec') { const cl = DT.ceiling(g, items), el = DT.electrical(g, items); const c = {}; el.forEach(e => { c[e.label] = (c[e.label] || 0) + 1; }); box.innerHTML = (g.open ? '' : DT.electricalSVG(g, items, th, el, cl)) + '<h4>Points</h4><table><tbody>' + Object.entries(c).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="num">${n}</td></tr>`).join('') + '</tbody></table>'; }
    else if (t === 'floor') { const f = DT.flooring(g, fin); box.innerHTML = f.svg + `<p class="hint">${esc(f.fl.spec)} — ${Math.round(f.area)} ft² laid, order ${Math.round(f.order)} ft² (${f.pieces} pieces)${f.skirting ? `, ${Math.round(f.skirting)} rft skirting` : ''}.</p>`; }
    else if (t === 'boq') { const sp = DT.specs(g, items, fin, th), bq = DT.boq(g, items, fin, th);
      box.innerHTML = '<h4>Specifications</h4><table><tbody>' + sp.surfaces.map(([k, v]) => `<tr><th style="width:120px">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('') + '</tbody></table><h4>Bill of quantities</h4><table><thead><tr><th>Code</th><th>Description</th><th class="num">Qty</th><th class="num">Rate PKR</th><th class="num">Amount PKR</th></tr></thead><tbody>' +
        bq.rows.map(x => `<tr><td>${x.code}</td><td>${esc(x.desc)}</td><td class="num">${x.qty} ${esc(x.unit)}</td><td class="num">${num(x.rate[0])}–${num(x.rate[1])}</td><td class="num">${num(x.amt[0])}–${num(x.amt[1])}</td></tr>`).join('') + `<tr class="tot"><td></td><td>Room total</td><td></td><td></td><td class="num">${num(bq.total[0])}–${num(bq.total[1])}</td></tr></tbody></table>`; }
  }
  $$('#rm-tabs button').forEach(b => b.addEventListener('click', () => { st.rtab = b.dataset.t; renderDraw(); }));
  $('#rm-role').addEventListener('change', e => { const g = iGeom(st.iroom); if (!g) return; const r = iGet(g); r.role = e.target.value; r.items = I.layout(g, lctx(g, r.role)); r.touched = true; st.dirty = true; if (rv) { rv.sel = null; rv.items = r.items; rv.refresh(); } renderInteriorLite(); renderDraw(); $('#rm-status').textContent = `Re-planned as ${I.ROLES[g.t === 'flounge' ? 'lounge' : g.t][r.role]}.`; });
  $('#rm-swap').addEventListener('change', e => { const k2 = e.target.value; const it = selItem(); if (!it || !k2) return; mutate((r, g) => { const n = I.swap(g, r.items, it, k2); r.items = r.items.map(x => x === it ? n : x); rv.sel = n.id; }, `Swapped for ${I.F[k2].n}.`); });
  function renderSched() {
    const g = st.iroom && iGeom(st.iroom); if (!g) return; const r = iGet(g); const rows = I.schedule(r.items, st.itheme); const b = I.roomBudget(g, r.items, r.fin, st.itheme);
    $('#rm-sched').innerHTML = '<thead><tr><th>Item</th><th class="num">Size</th><th class="num">Qty</th><th class="num">PKR</th></tr></thead><tbody>' + (rows.length ? rows.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${esc(x.size)}</td><td class="num">${x.qty}</td><td class="num">${x.hi ? pkrR([x.lo, x.hi]).replace('PKR ', '') : '—'}</td></tr>`).join('') : '<tr><td colspan="4" class="hint">No furniture yet — add some above.</td></tr>') + '</tbody>';
    $('#rm-budget').textContent = `Room budget ${pkrR(b.total)} — furniture ${pkrR(b.furn)}, flooring ${pkrR(b.floor)}${g.open ? '' : `, paint ${pkrR(b.paint)}`}. 2026 market ranges, ${I.THEMES[st.itheme].n} theme.`;
  }
  function selItem() { const g = st.iroom && iGeom(st.iroom); if (!g || !rv) return null; return iGet(g).items.find(i => i.id === rv.sel) || null; }
  function renderSel() {
    const it = selItem(); $('#rm-selname').textContent = it ? `${I.F[it.k].n} · ${I.ft(it.w)} × ${I.ft(it.d)}${rv.clash(it) ? ' · overlaps something' : ''}` : 'Nothing selected — click furniture in 3D';
    ['#rm-rot', '#rm-dup', '#rm-del'].forEach(id => $(id).disabled = !it);
    const sl = it ? I.swapList(it.k) : []; const sw = $('#rm-swap'); sw.disabled = !sl.length; sw.innerHTML = '<option value="">' + (sl.length ? 'Swap style…' : 'No other styles') + '</option>' + sl.map(k => `<option value="${k}">${esc(I.F[k].n)}</option>`).join('');
  }
  function mutate(fn, msg) { const g = st.iroom && iGeom(st.iroom); if (!g) return; const r = iGet(g); fn(r, g); r.touched = true; st.dirty = true; if (rv) { rv.items = r.items; rv.refresh(); } renderInteriorLite(); if (msg) $('#rm-status').textContent = msg; }
  $('#rm-rot').addEventListener('click', () => { const it = selItem(); if (!it) return; mutate((r, g) => { it.rot = (it.rot + 90) % 360; it.wall = null; const fp = I.footprint(it); it.cx = Math.max(fp.fw / 2, Math.min(g.W - fp.fw / 2, it.cx)); it.cy = Math.max(fp.fd / 2, Math.min(g.H - fp.fd / 2, it.cy)); }, 'Rotated.'); });
  $('#rm-del').addEventListener('click', () => { const it = selItem(); if (!it) return; mutate(r => { r.items = r.items.filter(x => x !== it); rv.sel = null; }, `${I.F[it.k].n} removed.`); });
  $('#rm-dup').addEventListener('click', () => { const it = selItem(); if (!it) return; mutate((r, g) => { const c = Object.assign({}, it, { id: 'f' + Date.now().toString(36), cx: Math.min(g.W - 1, it.cx + 1), cy: Math.min(g.H - 1, it.cy + 1), wall: null }); r.items.push(c); rv.sel = c.id; }, 'Duplicated — drag it into place.'); });
  $('#rm-addgo').addEventListener('click', () => { const k = $('#rm-add').value; mutate((r, g) => { const it = I.place(g, r.items, k); r.items.push(it); if (rv) rv.sel = it.id; }, `${I.F[k].n} added${''}.`); });
  $('#rm-auto').addEventListener('click', () => { const g = iGeom(st.iroom); if (!g) return; const f = st.cur.plan.floors[g.fi]; const r = iGet(g); void f; r.items = I.layout(g, lctx(g)); r.touched = false; r.done = false; if (rv) { rv.sel = null; rv.items = r.items; rv.refresh(); } renderInterior(); $('#rm-status').textContent = 'Back to the automatic layout.'; });
  $('#rm-done').addEventListener('click', () => { const g = iGeom(st.iroom); if (!g) return; const r = iGet(g); r.done = !r.done; st.dirty = true;
    if (r.done) { const next = (() => { const p = st.cur.plan; for (let fi = 0; fi < p.floors.length; fi++) for (const gg of iRooms(fi)) if (!iGet(gg).done) return gg; return null; })(); if (next) { st.iroom = next.key; st.ifloor = next.fi; if (H) H.toast({ title: `${g.name} done`, text: `Next up: ${next.name}.`, mood: 'happy', ms: 3500 }); } else if (H) H.toast({ title: 'Every room is done', text: 'Download the design package when you\u2019re ready.', mood: 'wave', action: { label: 'Download', run: () => $('#int-pkg').click() } }); }
    renderInterior(); });
  $$('#rm-views button').forEach(b => b.addEventListener('click', () => { $$('#rm-views button').forEach(x => x.setAttribute('aria-selected', String(x === b))); if (rv) rv.view(b.dataset.v); }));
  $('#rm3d').addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') $('#rm-rot').click(); if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('#rm-del').click(); } });
  $('#rm3d').setAttribute('tabindex', '0'); $('#rm3d').setAttribute('aria-label', 'Room in 3D. Drag furniture to move it. Press R to rotate the selected piece, Delete to remove it.');
  $('#int-auto').addEventListener('click', () => { Object.keys(st.interior).forEach(k => { if (!st.interior[k].touched && !st.interior[k].done) delete st.interior[k]; }); if (rv) rv.g = null; renderInterior(); istat('Untouched rooms re-furnished. Your edited rooms are kept.'); });
  async function interiorPackage(pdfOnly) {
    if (!st.cur || !I3) return; const btns = ['#int-pkg', '#int-pdf'].map(id => $(id)); btns.forEach(b => b.disabled = true);
    try {
      initRV(); istat('Preparing the design package…');
      const res = await I3.buildPackage({ plan: st.cur.plan, getRoom: iGet, theme: st.itheme, project: st.projectName || 'My house', authority: `${AUN().short} · ${AUN().city}`, road: FACING[st.facing].toUpperCase(), date: today(), X, V, viewer: rv, onStatus: istat });
      const base = (st.projectName || 'BuildMe').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'BuildMe'; const name = `BuildMe_${base}_interiors`;
      if (pdfOnly) { await save(name + '.pdf', res.pdf); }
      else {
        const z = new JSZip(); z.file('interior-design-package.pdf', res.pdf); res.files.forEach(f => z.file(f.path, f.blob || f.text));
        if (res.glb) z.file('model/furnished-house.glb', res.glb); z.file('interior.json', JSON.stringify(res.json, null, 2));
        z.file('README.txt', 'BuildMe interior design package\r\n- interior-design-package.pdf: cover with BOQ summary, furnished floor plans, then for every room: 3D overview + walk-in render, dimensioned furniture plan with clearances and schedule, four wall elevations, ceiling/lighting plan, electrical layout, flooring layout, specifications and a priced bill of quantities; house BOQ summary at the end.\r\n- drawings/<room>/: the same drawings as vector SVG (open in a browser, Illustrator, Inkscape or import into AutoCAD).\r\n- images/: furnished floor plans and room renders.\r\n- boq.csv: every BOQ line for every room (opens in Excel / Google Sheets).\r\n- model/furnished-house.glb: the furnished house in 3D (Blender, SketchUp, Windows 3D Viewer).\r\n- interior.json: rooms, finishes and furniture positions.\r\n');
        istat('Compressing…'); await save(name + '.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
      }
      istat(`Design package ready — ${res.pages} pages, total ${pkrR(res.total)}.`);
      if (H) H.toast({ title: 'Design package saved', text: `Room-by-room interiors for ${st.projectName || 'your house'}.`, mood: 'wave' });
    } catch (e) { console.error(e); istat('The package could not be built: ' + (e.message || e), true); if (H) H.oops({ title: 'The design package didn\u2019t finish', lead: String(e.message || e), reasons: [], faqs: ['package'] }); }
    finally { btns.forEach(b => b.disabled = false); }
  }
  $('#int-pkg').addEventListener('click', () => interiorPackage(false));
  $('#int-pdf').addEventListener('click', () => interiorPackage(true));

  // ======================= STATIC CONTENT + BOOT =======================
  $('#sched-table').innerHTML = '<thead><tr><th>Type</th><th class="num">Front</th><th class="num">Sides</th><th class="num">Cover</th><th class="num">FAR</th><th class="num">Mumty</th></tr></thead><tbody>' +
    P.SCHED_A.map(s => `<tr><td>${s.cat} · ${s.row}</td><td class="num">${s.front}'</td><td class="num">${s.side1 || s.side2 ? s.side1 + "' / " + s.side2 + "'" : '—'}</td><td class="num">${Math.round(s.cov * 100)}%</td><td class="num">${s.far}</td><td class="num">${s.tower}</td></tr>`).join('') + '</tbody>';
  try {
    const a = JSON.parse(store.get('buildme.answers') || 'null');
    if (a && a.authority && AU && AU.byId[a.authority]) st.authority = a.authority;
    if (a && a.plot) { st.plot = a.plot; st.rules = RF(a.plot); st.opts = a.opts || P.defaultOpts(a.plot); st.facing = a.facing || 'N'; st.corner = !!a.corner; $('#corner').checked = st.corner; st.projectName = `${a.plot.common} house`; }
  } catch (e) { }
  renderAuthUI(); renderPlotChoices(); renderFacing(); renderAllow(); updateCount(); estInit();
  const h = (location.hash || '').replace('#', '');
  go(['new', 'projects', 'plots', 'cost', 'bylaws', 'help'].includes(h) ? h : 'dashboard');
})();
