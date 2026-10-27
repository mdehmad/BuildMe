/* BuildMe — help layer: Mimar (the architect guide), FAQ library, quick-answer cards, animated pop-ups and toasts.
   Pure DOM + inline SVG; no dependencies. Exposes window.BuildMeHelp. */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // ---------------------------------------------------------------------------
  // FAQ library. screens: where the question is most useful (side cards + Mimar).
  // ---------------------------------------------------------------------------
  const CATS = {
    fit: 'When a plan won’t fit', plots: 'Plots & sizes', bylaws: 'CDA bylaws', design: 'Layouts & rooms',
    cost: 'Cost', files: 'Downloads & files', app: 'Using BuildMe',
  };
  // most bedrooms each standard plot takes with a compliant plan (typology sweep, beds 1–8, all options)
  const FITS = [
    ['25 × 40', '4 Marla', 1, 3], ['25 × 50', '5 Marla', 2, 5], ['30 × 60', '8 Marla', 3, 7], ['35 × 70', '10 Marla', 3, 7],
    ['40 × 80', '14 Marla', 5, '8+'], ['50 × 90', '1 Kanal', 5, '8+'], ['50 × 100', '1 Kanal+', 4, '8+'], ['60 × 120', '1.6 Kanal', '8+', '8+'], ['75 × 120', '2 Kanal', '8+', '8+'],
  ];
  const fitsTable = () => `<div class="tbl-wrap"><table class="faq-tbl"><thead><tr><th>Plot</th><th class="num">Single storey</th><th class="num">Double storey</th></tr></thead><tbody>${FITS.map(r => `<tr><td>${r[0]} <span class="hint">${r[1]}</span></td><td class="num">${r[2]}</td><td class="num">${r[3]}</td></tr>`).join('')}</tbody></table></div><p class="hint">Bedrooms with attached baths, plus lounge, kitchen, stairs and a car porch, within CDA coverage and FAR.</p>`;

  const FAQ = [
    // ---- when a plan won't fit
    { id: 'nofit', cat: 'fit', screens: ['new', 'design', 'dashboard'], tip: 'If a brief can’t fit, I tell you which row overflowed and offer one-click fixes.',
      q: 'Why couldn’t BuildMe make a plan for my brief?',
      a: 'Two things limit every plan: the <b>width</b> left after side setbacks (each row of rooms has to fit across it) and the <b>area</b> CDA lets you cover (ground coverage and FAR). When a brief asks for more than both allow, Mimar shows which row didn’t fit and offers quick fixes: double storey, one bedroom fewer, or no drawing room.' },
    { id: 'fewer', cat: 'fit', screens: ['design', 'new'], tip: 'Fewer bedrooms than you asked for? Coverage and FAR cap the built area — a double storey usually fixes it.',
      q: 'Why did I get fewer bedrooms than I asked for?',
      a: 'Coverage and FAR cap how much you can build. On a 25 × 50 plot, for example, the ground floor can be at most 750 ft². That holds two bedrooms with baths, plus a lounge, kitchen, stairs and porch. Choose <b>double storey</b> to put more bedrooms upstairs. Every adjustment BuildMe makes is listed in the yellow note above the layouts.' },
    { id: 'order', cat: 'fit', screens: ['design'], tip: 'When space runs out I give things up in a fixed order — bedrooms always last.',
      q: 'In what order does BuildMe give things up?',
      a: 'Gentlest change first: ground-floor bedrooms move upstairs (or downstairs if the first floor is full), then dressing rooms become wardrobes, separate dining joins the lounge, the drawing room goes, a 2-car porch becomes 1-car, and an optional servant room goes. Bedrooms are reduced only when nothing else works. If a plot requires a servant room, it’s never removed.' },
    { id: 'howmany', cat: 'fit', screens: ['new', 'plots', 'dashboard', 'help'], tip: 'A 10 marla plot takes about 3 bedrooms single storey, or 7 double storey.',
      q: 'How many bedrooms fit on my plot?', a: () => fitsTable() },
    { id: 'narrow', cat: 'fit', screens: ['new'], tip: 'Plots narrower than 25 ft need a double storey — one floor can’t fit lounge, kitchen, stairs and a bedroom across.',
      q: 'My plot is narrower than 25 ft. Can BuildMe design it?',
      a: 'Yes, as a <b>double storey</b>. On a 20–24 ft wide plot, a single floor can’t fit the lounge, kitchen, stairs and a bedroom across, so BuildMe puts the bedrooms upstairs. Plots under 16 ft of buildable width can’t be designed.' },
    { id: 'relax', cat: 'fit', screens: ['new'], tip: 'Society with its own bylaws? Enter its setbacks, coverage and FAR on the review step.',
      q: 'Can I relax the rules to make my brief fit?',
      a: 'On the review step, open <b>My society has different bylaws</b> and enter your society’s setbacks, coverage and FAR. Plans are designed to those numbers. The bylaw check still compares against CDA rules, so anything looser shows as <i>Fail</i>. That reminds you it isn’t CDA-compliant.' },
    { id: 'kitchenentry', cat: 'fit', screens: ['design'], tip: 'On very tight plots the kitchen may get a door from the porch — common on 4–5 marla houses.',
      q: 'Why does my kitchen open from the porch?',
      a: 'On very tight plots, the only way to give every room a door is sometimes a kitchen door from the porch. That’s common on 4–5 marla houses. Pick another layout, or remove a room, to get a separate entrance hall.' },

    // ---- plots
    { id: 'sizes', cat: 'plots', screens: ['dashboard', 'new', 'plots'], tip: 'Every standard CDA plot is ready to go, from 4 marla to 2 kanal — or type your own size.',
      q: 'Which plot sizes does BuildMe support?',
      a: 'All the standard Islamabad sizes, from 25 × 40 (4 marla) to 75 × 120 (2 kanal). You can also enter any custom size from 20 to 120 ft wide and 30 to 200 ft deep. Width is always the side facing the road.' },
    { id: 'marla', cat: 'plots', screens: ['new', 'plots'], tip: 'Plot names follow local usage; the rules use your real width × depth.',
      q: 'Why is a 25 × 50 plot called “5 marla”?',
      a: 'Names follow how plots are sold in Islamabad: 25 × 50 as “5 marla”, 35 × 70 as “10 marla”, 50 × 90 as “1 kanal”. BuildMe always works from the real width and depth, so the name never changes the rules.' },
    { id: 'corner', cat: 'plots', screens: ['new'], tip: 'Corner plot? Tick it — the side facing the road gets windows.',
      q: 'What changes for a corner plot?',
      a: 'Tick <b>Corner plot</b> on the first step. The side facing the second road counts as an open face, so rooms along it get windows. Setbacks still follow your plot’s CDA category.' },
    { id: 'road', cat: 'plots', screens: ['new', 'design'], tip: 'Tell me which side the road is on and I’ll point the plan and the sun the right way.',
      q: 'Why does it ask which side the road is on?',
      a: 'The plan is always drawn with the road at the bottom. The road side sets the north arrow, which the assistant uses for sun advice. For example, it warns when bedrooms face the hot west sun.' },

    // ---- bylaws
    { id: 'setbacks', cat: 'bylaws', screens: ['new', 'bylaws'], tip: 'Rear open space: 5 ft up to 5 marla, 7 ft below 1 kanal, 10 ft from 1 kanal.',
      q: 'What setbacks does BuildMe apply?',
      a: '<b>Front:</b> from Schedule A, 5 to 20 ft depending on plot category. <b>Rear:</b> current CDA practice, which is 5 ft up to 5 marla, 7 ft below 1 kanal and 10 ft from 1 kanal. <b>Sides:</b> only detached plots (frontage 50 ft and up) have side setbacks; terraced houses share party walls.' },
    { id: 'coverage', cat: 'bylaws', screens: ['new', 'bylaws', 'dashboard'], tip: 'Terraced plots may cover 60% of the plot; detached plots 50%.',
      q: 'How much of my plot can I build on?',
      a: 'Ground coverage is capped at <b>60%</b> on terraced plots (up to 625 yd²) and <b>50%</b> on detached plots. The total built area of both floors is capped by the FAR: 1.2, 1.05, 0.9 or 0.85, depending on category.' },
    { id: 'far', cat: 'bylaws', screens: ['design', 'bylaws'], tip: 'FAR = total floor area ÷ plot area. It’s why the first floor is often smaller.',
      q: 'What is FAR, and why is my first floor smaller?',
      a: 'Floor Area Ratio is the total covered area of all floors divided by the plot area. The first floor gets whatever FAR is left after the ground floor. The rest of the roof becomes an <b>open terrace</b>, which doesn’t count towards FAR.' },
    { id: 'servant', cat: 'bylaws', screens: ['new', 'bylaws'], tip: 'From 501 sq yd (50 × 100 and up) a servant room with bath is mandatory.',
      q: 'Is a servant quarter required?',
      a: 'Yes, on plots of <b>501 yd² and above</b> (clause 10): a servant room with its own bath. BuildMe adds it automatically on those plots and won’t let you remove it. On smaller plots it’s optional.' },
    { id: 'porch', cat: 'bylaws', screens: ['new', 'bylaws'], tip: 'Terraced porch: 180 ft², with no more than 80 ft² in the front setback.',
      q: 'How big can the car porch be?',
      a: 'Terraced: 180 ft² in total, with at most 80 ft² in the front setback. Detached: 200 or 300 ft² for one car, 300 or 400 ft² for two. The porch must be at least 9 ft wide, and its roof can’t be used as a terrace (clause 12.06). Porch area within the limit is excluded from FAR.' },
    { id: 'mumty', cat: 'bylaws', screens: ['bylaws', 'design'], tip: 'The mumty (roof stair tower) is capped at 150, 200 or 250 ft².',
      q: 'What is a mumty, and how big can it be?',
      a: 'The mumty is the stair tower that gives access to the roof. Schedule B caps it at 150 ft² (terraced up to 200 yd²), 200 ft² (201–625 yd²) or 250 ft² (detached), with 7′-6″ internal height.' },
    { id: 'storeys', cat: 'bylaws', screens: ['new', 'bylaws'], tip: 'CDA allows 2 storeys + mumty, up to 30 ft from the road.',
      q: 'How many storeys are allowed?',
      a: 'Two storeys plus the mumty, with the building at most 30 ft above the front road and a 3 ft parapet. BuildMe doesn’t model basements yet.' },
    { id: 'annex', cat: 'bylaws', screens: ['design', 'bylaws'], tip: 'Every habitable room must be at least 100 ft² and 8′-6″ wide.',
      q: 'What are the minimum room sizes?',
      a: 'Annex 1: habitable rooms 100 ft² and 8′-6″ wide; kitchen 45 ft² and 5′-0″; bath 24 ft² and 3′-0″; powder room 15 ft². BuildMe checks each room, using clear sizes inside the walls.' },
    { id: 'units', cat: 'bylaws', screens: ['bylaws'], tip: 'Two living units are allowed only from 488 sq yd.',
      q: 'Can I build two portions (units)?',
      a: 'Clause 16 allows one living unit below 488 yd² and two from 488 yd². BuildMe designs a single family home; the Bylaw check tab shows how many units your plot allows.' },

    // ---- design
    { id: 'how', cat: 'design', screens: ['dashboard', 'design', 'help'], tip: 'No AI here: I lay rooms out in rows, try hundreds of variations and keep the best six that pass the bylaws.',
      q: 'How does BuildMe design a plan?',
      a: 'It’s rule-based. Rooms go in rows from the road: porch and drawing room at the front, then lounge, kitchen and stairs, then bedrooms at the back. BuildMe tries hundreds of variations, rejects any that break a bylaw or leave a room without a door, and keeps the best six. The same answers always give the same layouts.' },
    { id: 'newlayouts', cat: 'design', screens: ['design'], tip: 'Press “New layouts” for six fresh options for the same brief.',
      q: 'How do I get different layouts?',
      a: 'Press <b>New layouts</b> in the workspace. BuildMe starts a fresh search for the same brief and returns up to six new options.' },
    { id: 'customise', cat: 'design', screens: ['design'], tip: 'Drag rooms in the Customise tab — I refuse moves that would break a bylaw and tell you why.',
      q: 'Can I change the layout myself?',
      a: 'Yes. In the <b>Customise</b> tab you can drag a room onto another to swap them, drag it into another row to move it, and click it to resize, flip, add or remove rooms. Changes that would break a bylaw, or leave a room unreachable, are refused with the reason.' },
    { id: 'ensuite', cat: 'design', screens: ['new', 'design'], tip: 'Every bedroom comes with its own attached bath.',
      q: 'Does every bedroom get a bathroom?',
      a: 'Yes. Each bedroom is a suite with an attached bath. On bigger plots, tick <b>Dressing rooms</b> for a walk-in dressing room beside each bath.' },
    { id: 'lawn', cat: 'design', screens: ['new'], tip: 'Front lawn or back yard? I put the spare open space where you want it.',
      q: 'Front lawn or back yard: what’s the difference?',
      a: 'With <b>Front lawn</b>, the house sits on the minimum rear setback and the spare depth becomes a lawn by the road. With <b>Back yard</b>, the house sits on the front setback and the spare depth goes behind it. The rear setback is always kept.' },
    { id: 'corridor', cat: 'design', screens: ['design'], tip: 'Big single-storey plans get corridors so every bedroom has its own door.',
      q: 'Why is there a corridor across my plan?',
      a: 'On large plans with several rows of bedrooms, a corridor behind the lounge (and between later rows) gives every room its own door without walking through another room.' },
    { id: 'stair', cat: 'design', screens: ['design'], tip: 'The stair sits in the middle row so it serves both floors and the roof.',
      q: 'Where does the staircase go?',
      a: 'Usually in the middle row, beside the lounge, so it serves both floors and the roof (mumty). On small plots it may start from the entrance or porch, which is common on 4–5 marla houses.' },
    { id: 'styles', cat: 'design', screens: ['design'], tip: 'Try Modern, Spanish or French in the 3D tab — the model updates live.',
      q: 'Which elevation styles are there?',
      a: 'Massing (plain), Modern, Contemporary, Spanish, Minimalist, French and Industrial, chosen from common Pakistani house styles. Pick one in <b>3D & styles</b>, or tick several to render them all for the report.' },

    // ---- cost
    { id: 'costcalc', cat: 'cost', screens: ['cost', 'design', 'dashboard'], tip: 'Cost = covered area × 2026 Islamabad rate for your finish, plus a style allowance.',
      q: 'How is the construction cost estimated?',
      a: 'Covered area × 2026 Islamabad market rates: grey structure PKR 2,800–3,800/ft², standard finish 5,000–6,500, premium 6,500–9,000. The porch counts at half area. Elevation styles add an allowance: Modern 5%, Contemporary 4%, Spanish 7%, French 6%, Industrial 5%.' },
    { id: 'costex', cat: 'cost', screens: ['cost'], tip: 'Estimates exclude land, CDA fees, architect, boundary wall, furniture and solar.',
      q: 'What does the estimate leave out?',
      a: 'Land, CDA approval fees, the architect and structural engineer, boundary wall and gate, furniture, appliances and solar. Treat the estimate as a planning range, not a quotation.' },
    { id: 'finish', cat: 'cost', screens: ['cost', 'design'], tip: 'Grey structure = shell only; standard = turnkey; premium = imported fittings.',
      q: 'Grey structure, standard or premium: what’s included?',
      a: '<b>Grey structure:</b> foundations, frame, brickwork, roof slab, plaster and basic plumbing and electrical conduits. <b>Standard:</b> turnkey, with tiles, local fittings, woodwork and paint. <b>Premium:</b> imported fittings, stone or porcelain floors, false ceilings and better glazing.' },

    // ---- files
    { id: 'dwg', cat: 'files', screens: ['design'], tip: 'Need DWG? Open the DXF in AutoCAD and Save As DWG.',
      q: 'Can I get a DWG file?',
      a: 'Browsers can’t write DWG, so BuildMe exports <b>DXF</b> (AutoCAD R12, layered, in inches). Open it in AutoCAD, BricsCAD or LibreCAD and use <i>Save As → DWG</i>.' },
    { id: 'pdf', cat: 'files', screens: ['design'], tip: 'The PDF report has every plan, renders, the bylaw check and the cost breakdown.',
      q: 'What’s in the PDF report?',
      a: 'A summary page, every floor plan and the roof plan, a front render plus the styles you ticked, a room schedule, the full bylaw check and a cost breakdown.' },
    { id: 'glb', cat: 'files', screens: ['design'], tip: 'The GLB 3D model opens in Blender, Windows 3D Viewer and most online viewers.',
      q: 'What can I open the GLB 3D model in?',
      a: 'Blender, the Windows 3D Viewer, SketchUp (with a glTF importer), and most online glTF viewers.' },
    { id: 'submit', cat: 'files', screens: ['design', 'bylaws'], tip: 'These are concept designs — a licensed architect prepares the drawings for CDA approval.',
      q: 'Can I submit these drawings to CDA?',
      a: 'No. BuildMe makes concept designs to help you brief an architect and plan a budget. A licensed architect must prepare and sign the drawings you submit for approval.' },

    // ---- app
    { id: 'saved', cat: 'app', screens: ['projects', 'dashboard'], tip: 'Projects are saved in this browser on this device.',
      q: 'Where are my projects saved?',
      a: 'In this browser, on this device. Nothing is uploaded. Clearing site data removes them, so download a ZIP of anything you want to keep.' },
    { id: 'ai', cat: 'app', screens: ['dashboard', 'help'], tip: 'BuildMe uses rules, not AI — same answers, same plans, every time.',
      q: 'Does BuildMe use AI?',
      a: 'No. The brief reader, layouts, checks and tips are all rules, so results are predictable and repeatable. Everything runs in your browser.' },
    { id: 'phone', cat: 'app', screens: ['dashboard'], tip: 'BuildMe works on phones too; the 3D view needs WebGL.',
      q: 'Does it work on a phone?',
      a: 'Yes. The layout adapts to small screens. The 3D view needs WebGL, which almost every modern phone has.' },
    { id: 'brief', cat: 'app', screens: ['dashboard'], tip: 'Type “10 marla, 5 beds, double storey, road east” and I’ll fill in the rest.',
      q: 'What can I type in the brief box?',
      a: 'Plot size (“10 marla”, “1 kanal”, “35x70”), bedrooms and how many downstairs, single or double storey, drawing room, dining, servant quarter, dressing rooms, 1 or 2 cars, road side, corner plot, front lawn or back yard, a style (modern, spanish…) and a finish (premium, grey structure).' },
    { id: 'mimar', cat: 'app', screens: ['help'], tip: 'I’m Mimar — tap me any time for a tip, or minimise me to the corner.',
      q: 'Who is Mimar?',
      a: 'Mimar (معمار, “architect”) is BuildMe’s guide. He offers tips for the screen you’re on, explains why a brief didn’t fit and suggests fixes. Tap him for the next tip, or minimise him to the corner.' },
  ];
  const byId = Object.fromEntries(FAQ.map(f => [f.id, f]));
  const ans = f => typeof f.a === 'function' ? f.a() : f.a;
  function forScreen(screen) { const a = FAQ.filter(f => f.screens.includes(screen)); return a.length ? a : FAQ; }
  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

  // ---------------------------------------------------------------------------
  // Mimar — an original cartoon architect, drawn in SVG. mood: happy | think | oops | idea | wave
  // ---------------------------------------------------------------------------
  let mmN = 0;
  function mimarSVG(cls) {
    const u = 'mm' + (mmN++);
    return `<svg class="mm ${cls || ''}" viewBox="0 0 120 150" aria-hidden="true" focusable="false">
      <defs><clipPath id="${u}h"><circle cx="60" cy="64" r="27"/></clipPath></defs>
      <ellipse class="mm-shadow" cx="60" cy="145" rx="26" ry="3.6" fill="#0F2A43" opacity=".12"/>
      <g class="mm-bob">
        <g class="mm-bp"><rect x="70" y="104" width="44" height="11" rx="5.5" transform="rotate(-28 92 110)" fill="#CFE5FF" stroke="#1659B4" stroke-width="1.6"/>
          <path d="M80 117 104 104" stroke="#1659B4" stroke-width="1" opacity=".6" transform="translate(-2 -1)"/><ellipse cx="111" cy="98.5" rx="3.2" ry="5.6" transform="rotate(-28 111 98.5)" fill="#fff" stroke="#1659B4" stroke-width="1.4"/></g>
        <path d="M30 141c0-22 12-38 30-38s30 16 30 38z" fill="#1E6FD9"/>
        <path d="M49 104l11 13 11-13" fill="#fff"/><path d="M57 113l3 4 3-4-3 22z" fill="#0F2A43" opacity=".85"/>
        <rect x="68" y="120" width="11" height="9" rx="1.5" fill="#1659B4"/><rect x="70" y="113" width="2.2" height="9" rx="1" fill="#FFC531"/><rect x="74" y="115" width="2.2" height="7" rx="1" fill="#F05D5E"/>
        <path d="M84 116c6 3 10 8 12 12" stroke="#1E6FD9" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="96.5" cy="129" r="5" fill="#E8B48D"/>
        <g class="mm-arm"><path d="M36 116c-7 2-12-1-15-7" stroke="#1E6FD9" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="20" cy="107" r="5.2" fill="#E8B48D"/>
          <g class="mm-pencil"><rect x="16.5" y="88" width="3.4" height="16" rx=".8" fill="#FFC531" transform="rotate(-14 18 96)"/><path d="M15.4 87.6l2.1-5.4 2.2 5.2z" fill="#0F2A43" transform="rotate(-14 18 96)"/></g></g>
        <g class="mm-head">
          <circle cx="33.5" cy="66" r="5" fill="#E8B48D"/><circle cx="86.5" cy="66" r="5" fill="#E8B48D"/>
          <circle cx="60" cy="64" r="27" fill="#F2C29B"/>
          <g clip-path="url(#${u}h)"><path d="M33 72c3 17 14 22 27 22s24-5 27-22c-5 9-14 12-27 12S38 81 33 72z" fill="#5B3A29"/></g>
          <path class="mm-mous" d="M50 77c4-3 7-3 10-1 3-2 6-2 10 1-4 2-7 2-10 0-3 2-6 2-10 0z" fill="#5B3A29"/>
          <circle cx="44" cy="74" r="4" fill="#F28C8C" opacity=".35"/><circle cx="76" cy="74" r="4" fill="#F28C8C" opacity=".35"/>
          <g class="mm-eyes"><circle cx="50" cy="64" r="2.6" fill="#0F2A43"/><circle cx="70" cy="64" r="2.6" fill="#0F2A43"/><circle cx="51" cy="63" r=".8" fill="#fff"/><circle cx="71" cy="63" r=".8" fill="#fff"/></g>
          <g fill="none" stroke="#0F2A43" stroke-width="2"><circle cx="50" cy="64" r="7"/><circle cx="70" cy="64" r="7"/><path d="M57 63.5c2-1.5 4-1.5 6 0M43 63l-8-2M77 63l8-2"/></g>
          <g class="mm-brows" stroke="#5B3A29" stroke-width="2.4" stroke-linecap="round"><path class="b1" d="M44 56.5q6-3 11 0"/><path class="b2" d="M65 56.5q5-3 11 0"/></g>
          <path class="mm-m mm-m-happy" d="M53 82q7 6 14 0" stroke="#7A2E2E" stroke-width="2.2" fill="#fff" stroke-linecap="round"/>
          <ellipse class="mm-m mm-m-oops" cx="60" cy="83.5" rx="3.6" ry="4.2" fill="#7A2E2E"/>
          <path class="mm-m mm-m-think" d="M54 83.5q4 1.5 10-1" stroke="#7A2E2E" stroke-width="2.2" fill="none" stroke-linecap="round"/>
          <g class="mm-hat"><path d="M31 49c0-17 13-27 29-27s29 10 29 27z" fill="#FFC531"/><path d="M60 22v27M46 25.5c-3 6-4 14-4 23.5M74 25.5c3 6 4 14 4 23.5" stroke="#E0A817" stroke-width="2.2" fill="none"/>
            <rect x="25" y="46" width="70" height="7.5" rx="3.75" fill="#FFD45E" stroke="#E0A817" stroke-width="1.4"/><rect x="53" y="34" width="14" height="8" rx="2" fill="#1E6FD9"/><path d="M56.5 40v-3.6l3.5-2.4 3.5 2.4V40z" fill="#fff"/></g>
          <path class="mm-sweat" d="M93 40c3 5 4 7 4 9a4 4 0 0 1-8 0c0-2 1-4 4-9z" fill="#8CC2FF" stroke="#1E6FD9" stroke-width="1"/>
        </g>
        <g class="mm-bulb"><circle cx="100" cy="22" r="9" fill="#FFE27A" stroke="#E0A817" stroke-width="1.6"/><rect x="96.5" y="30" width="7" height="5" rx="1.4" fill="#9FB2C6"/>
          <path d="M100 8v-5M88 13l-3-3M112 13l3-3" stroke="#E0A817" stroke-width="1.8" stroke-linecap="round"/></g>
        <g class="mm-q"><text x="98" y="30" font-family="Sora,system-ui,sans-serif" font-weight="700" font-size="22" fill="#1E6FD9">?</text></g>
      </g>
    </svg>`;
  }

  // ---------------------------------------------------------------------------
  // Floating guide (bottom-right). Rotates FAQs for the current screen.
  // ---------------------------------------------------------------------------
  const G = { el: null, screen: 'dashboard', deck: [], cur: null, timer: null, paused: false, shownAnswer: false, typing: null };
  const ROTATE_MS = 16000;
  const GREET = {
    dashboard: 'Salaam! I’m Mimar. Describe your house and I’ll draw it to CDA rules.',
    new: 'Four quick questions and I’ll design layouts that fit your plot.',
    design: 'Here are your layouts. Ask me anything about them.',
    projects: 'Your saved designs live here, in this browser.',
    plots: 'One ready plan for every standard plot. Pick one to start.',
    cost: 'Let’s put a number on it. Change the area and finish to see the range.',
    bylaws: 'These are the rules I follow for every plan.',
    help: 'Search below, or tap me for a random tip.',
  };
  function mountGuide() {
    if (G.el) return G.el;
    const el = document.createElement('div'); el.className = 'mimar'; el.id = 'mimar';
    el.innerHTML = `
      <div class="mm-bubble" id="mm-bubble" role="region" aria-label="Tips from Mimar">
        <div class="mm-top"><span class="mm-kicker" id="mm-kicker">Mimar says</span><span class="grow"></span>
          <button class="mm-x" id="mm-min" type="button" aria-label="Minimise Mimar" title="Minimise"><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button></div>
        <p class="mm-text" id="mm-text" aria-live="polite"></p>
        <div class="mm-answer" id="mm-answer" hidden></div>
        <div class="mm-acts"><button type="button" class="btn sm soft" id="mm-ans">Tell me more</button><button type="button" class="btn sm ghost" id="mm-next">Next tip</button><a class="btn sm ghost" href="#help" data-route="help">All FAQs</a></div>
        <div class="mm-timer"><i id="mm-bar"></i></div>
      </div>
      <button type="button" class="mm-avatar" id="mm-avatar" aria-label="Mimar, your architect guide: show a tip" aria-expanded="true">${mimarSVG('mood-wave')}<span class="mm-badge" id="mm-badge" hidden>1</span></button>`;
    document.body.appendChild(el); G.el = el;
    const minimised = store.get('buildme.mimar') === 'min' || (window.innerWidth < 640 && store.get('buildme.mimar') !== 'open');
    setMin(minimised, true);
    el.querySelector('#mm-min').addEventListener('click', () => setMin(true));
    el.querySelector('#mm-avatar').addEventListener('click', () => { if (el.dataset.state === 'min') { setMin(false); next(); } else next(); poke(); });
    el.querySelector('#mm-next').addEventListener('click', () => next());
    el.querySelector('#mm-ans').addEventListener('click', toggleAnswer);
    el.addEventListener('mouseenter', () => { G.paused = true; el.classList.add('paused'); });
    el.addEventListener('mouseleave', () => { G.paused = false; el.classList.remove('paused'); });
    el.addEventListener('focusin', () => { G.paused = true; el.classList.add('paused'); });
    el.addEventListener('focusout', () => { G.paused = false; el.classList.remove('paused'); });
    return el;
  }
  function setMin(min, silent) {
    const el = G.el; el.dataset.state = min ? 'min' : 'open';
    el.querySelector('#mm-avatar').setAttribute('aria-expanded', String(!min));
    el.querySelector('#mm-avatar').setAttribute('aria-label', min ? 'Mimar, your architect guide: show tips' : 'Next tip from Mimar');
    if (!silent) store.set('buildme.mimar', min ? 'min' : 'open');
    el.querySelector('#mm-badge').hidden = !min;
    schedule();
  }
  function mood(m, svgRoot) {
    const svg = (svgRoot || G.el).querySelector('svg.mm'); if (!svg) return;
    svg.setAttribute('class', 'mm mood-' + m);
  }
  function poke() { const a = G.el.querySelector('.mm-avatar'); a.classList.remove('poke'); void a.offsetWidth; a.classList.add('poke'); }
  function typeText(node, text) {
    clearInterval(G.typing);
    if (reduce()) { node.textContent = text; return; }
    node.textContent = ''; let i = 0; const step = Math.max(1, Math.round(text.length / 60));
    G.typing = setInterval(() => { i += step; node.textContent = text.slice(0, i); if (i >= text.length) clearInterval(G.typing); }, 18);
  }
  function show(f, kicker) {
    const el = G.el; if (!el) return; G.cur = f; G.shownAnswer = false;
    el.querySelector('#mm-kicker').textContent = kicker || (f ? CATS[f.cat] : 'Mimar says');
    typeText(el.querySelector('#mm-text'), f ? f.tip || f.q : kicker);
    const a = el.querySelector('#mm-answer'); a.hidden = true; a.innerHTML = '';
    const b = el.querySelector('#mm-ans'); b.hidden = !f; b.textContent = 'Tell me more';
    mood(f ? (Math.random() < 0.5 ? 'idea' : 'happy') : 'wave');
    const bubble = el.querySelector('.mm-bubble'); bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    schedule();
  }
  function toggleAnswer() {
    const el = G.el, f = G.cur; if (!f) return; const a = el.querySelector('#mm-answer');
    G.shownAnswer = !G.shownAnswer; a.hidden = !G.shownAnswer;
    if (G.shownAnswer) { a.innerHTML = `<b>${esc(f.q)}</b><div>${ans(f)}</div>`; mood('think'); }
    el.querySelector('#mm-ans').textContent = G.shownAnswer ? 'Hide' : 'Tell me more';
    schedule();
  }
  function next() {
    if (!G.deck.length) G.deck = shuffle(forScreen(G.screen)).filter(f => !G.cur || f.id !== G.cur.id);
    show(G.deck.shift());
  }
  function schedule() {
    clearTimeout(G.timer); const bar = G.el && G.el.querySelector('#mm-bar'); if (!bar) return;
    bar.style.animation = 'none'; void bar.offsetWidth;
    if (G.el.dataset.state === 'min' || G.shownAnswer) { bar.style.animation = 'none'; return; }
    bar.style.animation = `mm-timer ${ROTATE_MS}ms linear forwards`;
    G.timer = setTimeout(function tick() { if (G.paused || document.hidden) { G.timer = setTimeout(tick, 1500); return; } next(); }, ROTATE_MS);
  }
  function setScreen(screen) {
    mountGuide(); if (G.screen === screen && G.cur) return; G.screen = screen; G.deck = [];
    G.el.dataset.screen = screen;
    show(null, GREET[screen] || GREET.dashboard);
    G.el.querySelector('#mm-kicker').textContent = 'Mimar says';
    clearTimeout(G.timer); G.timer = setTimeout(() => next(), 6000);
    // busy screens: say hello, then tuck into the corner unless the user is reading
    clearTimeout(G.tuck);
    if ((screen === 'design' || window.innerWidth < 1100) && G.el.dataset.state !== 'min') G.tuck = setTimeout(() => { if (!G.paused && !G.shownAnswer) { G.el.dataset.state = 'min'; G.el.querySelector('#mm-badge').hidden = false; schedule(); } }, 7000);
  }
  function say(text, m) { mountGuide(); show(null, text); G.el.querySelector('#mm-kicker').textContent = 'Mimar says'; if (m) mood(m); if (G.el.dataset.state === 'min') { const b = G.el.querySelector('#mm-badge'); b.hidden = false; poke(); } }
  function hideGuide(h) { if (G.el) G.el.classList.toggle('away', !!h); }

  // ---------------------------------------------------------------------------
  // Quick-answer cards (side panels on several screens)
  // ---------------------------------------------------------------------------
  function mountQuick(host, screen, opts) {
    if (!host) return; opts = opts || {};
    const n = opts.n || 4; let pool = shuffle(forScreen(screen));
    const draw = () => {
      const items = pool.slice(0, n); pool = pool.slice(n).concat(items);
      host.innerHTML = `<div class="card card-pad quick-faq">
        <div class="qf-head"><span class="qf-face">${mimarSVG('mood-happy mini')}</span><div><b>${esc(opts.title || 'Quick answers')}</b><div class="hint">${esc(opts.sub || 'Mimar answers common questions')}</div></div>
          <button class="btn sm ghost qf-more" type="button" aria-label="Show other questions" title="Other questions"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg></button></div>
        <div class="qf-list">${items.map(f => `<details class="faq-item"><summary>${esc(f.q)}</summary><div class="faq-a">${ans(f)}</div></details>`).join('')}</div>
        <a class="btn link" href="#help" data-route="help">All questions</a></div>`;
      const list = host.querySelector('.qf-list'); if (!reduce()) { list.classList.remove('in'); void list.offsetWidth; list.classList.add('in'); }
      host.querySelector('.qf-more').addEventListener('click', draw);
    };
    draw();
  }

  // ---------------------------------------------------------------------------
  // Help page (route #help)
  // ---------------------------------------------------------------------------
  function mountHelpPage(host) {
    if (!host || host.dataset.ready) return; host.dataset.ready = '1';
    host.innerHTML = `
      <div class="card help-hero">
        <div class="help-hero-main">
          <span class="lab">Help &amp; FAQ</span>
          <h2>Ask Mimar</h2>
          <p>Answers about plots, CDA bylaws, layouts, costs and downloads. Type a few words or pick a topic.</p>
          <div class="help-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="faq-q" placeholder="e.g. setbacks, servant room, DWG, how many bedrooms" aria-label="Search questions"></div>
          <div class="chips" id="faq-cats" role="group" aria-label="Topics"></div>
        </div>
        <div class="help-hero-art">${mimarSVG('mood-wave big')}<div class="help-speech" id="help-speech">Tap me for a random tip!</div></div>
      </div>
      <div class="help-grid">
        <div class="faq-list" id="faq-list"></div>
        <aside class="help-side">
          <div class="card card-pad"><h3>How many bedrooms fit?</h3>${fitsTable()}</div>
          <div class="card card-pad tip-of-day"><span class="lab">Tip of the moment</span><p id="tip-now"></p><button class="btn sm soft" id="tip-next" type="button">Another tip</button></div>
        </aside>
      </div>`;
    let cat = 'all', q = '';
    const cats = host.querySelector('#faq-cats');
    cats.innerHTML = [['all', 'All']].concat(Object.entries(CATS)).map(([k, v]) => `<button type="button" data-c="${k}" aria-pressed="${k === 'all'}">${esc(v)}</button>`).join('');
    cats.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; cats.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render(); });
    host.querySelector('#faq-q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
    const strip = h => String(h).replace(/<[^>]+>/g, ' ');
    function render() {
      const words = q.split(/\s+/).filter(Boolean);
      const list = FAQ.filter(f => (cat === 'all' || f.cat === cat) && (!words.length || words.every(w => (f.q + ' ' + strip(ans(f)) + ' ' + (f.tip || '')).toLowerCase().includes(w))));
      const el = host.querySelector('#faq-list');
      if (!list.length) { el.innerHTML = `<div class="empty-state">${mimarSVG('mood-think mini')}<p>Mimar has no answer for “${esc(q)}” yet. Try other words, or browse all topics.</p></div>`; return; }
      const groups = {}; list.forEach(f => (groups[f.cat] = groups[f.cat] || []).push(f));
      el.innerHTML = Object.entries(groups).map(([c, fs]) => `<section class="faq-group"><h3>${esc(CATS[c])}</h3>${fs.map((f, i) => `<details class="faq-item" style="--i:${i}" ${words.length && i === 0 ? 'open' : ''}><summary>${esc(f.q)}</summary><div class="faq-a">${ans(f)}</div></details>`).join('')}</section>`).join('');
    }
    render();
    const tips = shuffle(FAQ); let ti = 0;
    const tip = () => { const f = tips[ti++ % tips.length]; host.querySelector('#tip-now').textContent = f.tip || f.q; };
    tip(); host.querySelector('#tip-next').addEventListener('click', tip);
    const art = host.querySelector('.help-hero-art'); const sp = host.querySelector('#help-speech');
    art.addEventListener('click', () => { const f = tips[ti++ % tips.length]; sp.textContent = f.tip || f.q; sp.classList.remove('pop'); void sp.offsetWidth; sp.classList.add('pop'); const s = art.querySelector('svg.mm'); s.setAttribute('class', 'mm big mood-' + (['idea', 'happy', 'wave', 'think'][ti % 4])); });
  }
  function openFaq(id) {
    location.hash = '#help';
    setTimeout(() => { const host = document.getElementById('faq-list'); if (!host) return; const f = byId[id]; if (!f) return;
      const it = [...host.querySelectorAll('.faq-item')].find(d => d.querySelector('summary').textContent === f.q);
      if (it) { it.open = true; it.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' }); it.classList.add('flash'); setTimeout(() => it.classList.remove('flash'), 1600); } }, 120);
  }

  // ---------------------------------------------------------------------------
  // Animated pop-up ("oops") — used when a brief can't be designed, and for other errors
  // ---------------------------------------------------------------------------
  let lastFocus = null;
  function oops(o) {
    close(true); lastFocus = document.activeElement;
    const kind = o.kind || 'bad'; // bad | info
    const back = document.createElement('div'); back.className = 'oops-back ' + kind; back.id = 'oops';
    const house = `<svg class="oops-house" viewBox="0 0 160 110" aria-hidden="true">
        <path d="M6 104h148" stroke="#C9D7E6" stroke-width="3" stroke-linecap="round"/>
        <g class="blk b1"><rect x="34" y="78" width="30" height="24" rx="2"/></g><g class="blk b2"><rect x="66" y="78" width="30" height="24" rx="2"/></g><g class="blk b3"><rect x="98" y="78" width="28" height="24" rx="2"/></g>
        <g class="blk b4"><rect x="40" y="52" width="40" height="24" rx="2"/></g><g class="blk b5"><rect x="82" y="52" width="38" height="24" rx="2"/></g>
        <g class="blk b6 odd"><rect x="58" y="26" width="58" height="24" rx="2"/><text x="87" y="43" text-anchor="middle">?</text></g>
        <g class="crane"><path d="M140 104V12h-62" stroke="#1E6FD9" stroke-width="3" fill="none" stroke-linejoin="round"/><path class="hook" d="M100 12v9" stroke="#0F2A43" stroke-width="1.6"/></g>
      </svg>`;
    const reasons = (o.reasons || []).map((r, i) => `<li style="--i:${i}"><span class="ri">${r.icon || (kind === 'info' ? 'i' : '!')}</span><div><b>${esc(r.title)}</b>${r.text ? `<span>${esc(r.text)}</span>` : ''}</div></li>`).join('');
    const fixes = (o.fixes || []).map((f, i) => `<button type="button" class="btn ${i === 0 ? 'primary' : ''}" data-fix="${i}" style="--i:${i}">${esc(f.label)}</button>`).join('');
    const faqs = (o.faqs || []).map(id => byId[id]).filter(Boolean).map(f => `<details class="faq-item"><summary>${esc(f.q)}</summary><div class="faq-a">${ans(f)}</div></details>`).join('');
    back.innerHTML = `<div class="oops-card" role="alertdialog" aria-modal="true" aria-labelledby="oops-t" aria-describedby="oops-l">
      <button class="oops-x" type="button" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="oops-stage">${kind === 'bad' ? house : ''}<div class="oops-mm">${mimarSVG(kind === 'bad' ? 'mood-oops' : 'mood-idea')}</div></div>
      <div class="oops-body">
        <span class="lab">${esc(o.kicker || (kind === 'bad' ? 'Mimar couldn’t fit it' : 'Mimar adjusted your brief'))}</span>
        <h2 id="oops-t">${esc(o.title)}</h2>
        ${o.lead ? `<p id="oops-l" class="oops-lead">${esc(o.lead)}</p>` : '<p id="oops-l" hidden></p>'}
        ${reasons ? `<ul class="oops-reasons">${reasons}</ul>` : ''}
        ${fixes ? `<div class="oops-fixes"><span class="lab">${esc(o.fixLabel || 'Try one of these')}</span><div class="row">${fixes}</div></div>` : ''}
        ${faqs ? `<div class="oops-faq"><span class="lab">Related questions</span>${faqs}</div>` : ''}
        <div class="oops-foot"><button type="button" class="btn ghost" data-close>${esc(o.closeLabel || 'Close')}</button>${o.help !== false ? '<a class="btn link" href="#help" data-route="help" data-close>Open Help &amp; FAQ</a>' : ''}</div>
      </div></div>`;
    document.body.appendChild(back); hideGuide(true);
    requestAnimationFrame(() => back.classList.add('in'));
    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('.oops-x') || e.target.closest('[data-close]')) { close(); return; }
      const b = e.target.closest('[data-fix]'); if (b) { const f = o.fixes[+b.dataset.fix]; close(); setTimeout(() => f.run(), 160); }
    });
    back.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') { const f = [...back.querySelectorAll('button,a,summary')].filter(x => x.offsetParent); if (!f.length) return; const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    setTimeout(() => { const t = back.querySelector('[data-fix="0"]') || back.querySelector('.oops-x'); if (t) t.focus({ preventScroll: true }); }, 60);
    return back;
  }
  function close(instant) {
    const back = document.getElementById('oops'); if (!back) return;
    hideGuide(false);
    if (instant || reduce()) back.remove(); else { back.classList.remove('in'); back.classList.add('out'); setTimeout(() => back.remove(), 260); }
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) try { lastFocus.focus({ preventScroll: true }); } catch (e) { }
  }

  // ---------------------------------------------------------------------------
  // Toast — small, self-dismissing note with Mimar's face
  // ---------------------------------------------------------------------------
  function toast(o) {
    let host = document.getElementById('toasts'); if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    const t = document.createElement('div'); t.className = 'toast ' + (o.kind || 'info');
    t.innerHTML = `<span class="t-face">${mimarSVG('mini mood-' + (o.mood || (o.kind === 'bad' ? 'oops' : 'happy')))}</span><div class="t-txt">${o.title ? `<b>${esc(o.title)}</b>` : ''}<span>${esc(o.text || '')}</span></div>${o.action ? `<button type="button" class="btn sm soft">${esc(o.action.label)}</button>` : ''}<button type="button" class="t-x" aria-label="Dismiss"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    host.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    const kill = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); };
    t.querySelector('.t-x').addEventListener('click', kill);
    if (o.action) t.querySelector('.btn').addEventListener('click', () => { kill(); o.action.run(); });
    setTimeout(kill, o.ms || 8000);
    return t;
  }

  root.BuildMeHelp = { FAQ, CATS, FITS, byId, forScreen, mimarSVG, mountGuide, setScreen, say, mood, hideGuide, mountQuick, mountHelpPage, openFaq, oops, close, toast };
})(typeof window !== 'undefined' ? window : globalThis);
