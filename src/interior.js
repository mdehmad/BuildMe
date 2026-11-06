/* BuildMe interiors — furniture catalogue, room geometry, space-resolved furniture layout, space checks, 2D plans, budgets.
   Pure logic (no DOM, no three.js), so it runs in node tests too. Exposes window.BuildMeInterior / module.exports.
   Units: feet. Room-local coordinates: origin at the room's inner top-left corner, x → east, y → away from the road.
   Every item: { k, w, d, rot (0 = back on north wall, facing south), cx, cy } plus optional y0 (mounting height). */
(function (root) {
  'use strict';
  const WALL = 0.75, CEIL = 9.5;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = v => +(+v).toFixed(2);
  const ft = v => { const t = Math.round(v * 12); return Math.floor(t / 12) + "'-" + (t % 12) + '"'; };

  // ---------- catalogue ----------
  // w along the front, d deep, h tall, y0 mounting height; clr = clear depth needed in front; side = clear width needed at the sides;
  // ok = items allowed inside this item's clear zone; g = swap group; spec = material keys resolved per theme
  const F = {
    // beds
    bed_king: { n: 'King bed with upholstered headboard', g: 'bed', w: 6.6, d: 7.1, h: 1.9, hb: 4, cat: 'bed', clr: 2.5, side: 2, ok: ['bench', 'rug', 'ottoman', 'nightstand', 'nightstand_float', 'art'], price: [150000, 320000], spec: ['wood', 'fabric'], size: '72" × 78" mattress' },
    bed_queen: { n: 'Queen bed', g: 'bed', w: 5.6, d: 7, h: 1.9, hb: 3.8, cat: 'bed', clr: 2.5, side: 2, ok: ['bench', 'rug', 'ottoman', 'nightstand', 'nightstand_float', 'art'], price: [110000, 250000], spec: ['wood', 'fabric'], size: '60" × 78" mattress' },
    bed_double: { n: 'Double bed', g: 'bed', w: 4.9, d: 6.7, h: 1.8, hb: 3.5, cat: 'bed', clr: 2.25, side: 1.75, ok: ['bench', 'rug', 'ottoman', 'nightstand', 'nightstand_float', 'art'], price: [80000, 180000], spec: ['wood', 'fabric'], size: '54" × 75" mattress' },
    bed_storage: { n: 'Queen bed with hydraulic storage', g: 'bed', w: 5.6, d: 7, h: 1.9, hb: 3.8, cat: 'bed', clr: 2.5, side: 2, ok: ['rug', 'nightstand', 'nightstand_float', 'art'], price: [140000, 290000], spec: ['wood', 'fabric'], size: '60" × 78" mattress, lift-up base' },
    bed_single: { n: 'Single bed', g: 'bed', w: 3.5, d: 6.7, h: 1.7, hb: 3, cat: 'bed', clr: 2.25, side: 0, ok: ['rug', 'nightstand', 'art', 'toybox'], price: [40000, 90000], spec: ['wood'], size: '36" × 75" mattress' },
    bed_bunk: { n: 'Bunk bed', g: 'bed', w: 3.6, d: 6.8, h: 5.6, cat: 'bed', clr: 2.5, side: 0, ok: ['rug'], tall: true, price: [70000, 160000], spec: ['wood'], size: '2 × 36" × 75" mattresses' },
    daybed: { n: 'Day bed / divan', g: 'bed', w: 3.2, d: 6.5, h: 1.5, cat: 'bed', clr: 2, side: 0, ok: ['rug', 'coffee'], price: [45000, 110000], spec: ['wood', 'fabric'] },
    nightstand: { n: 'Bedside table with drawer', g: 'bedside', w: 1.7, d: 1.4, h: 2, cat: 'wood', clr: 0, price: [15000, 40000], spec: ['wood', 'metal'] },
    nightstand_float: { n: 'Floating bedside shelf', g: 'bedside', w: 1.6, d: 1.1, h: 0.7, y0: 1.6, mount: 'wall', cat: 'wood', clr: 0, price: [9000, 22000], spec: ['wood'] },
    wardrobe: { n: 'Wardrobe, hinged doors', g: 'wardrobe', w: 6, d: 2, h: 7.5, cat: 'wood', tall: true, clr: 2.5, var: [3, 12], perFt: [30000, 60000], spec: ['carcass', 'shutter'] },
    wardrobe_slide: { n: 'Wardrobe, sliding doors', g: 'wardrobe', w: 6, d: 2.1, h: 8, cat: 'wood', tall: true, clr: 1.75, var: [4, 12], perFt: [38000, 72000], spec: ['carcass', 'shutter'] },
    dresser: { n: 'Dressing table with mirror', g: 'dresser', w: 3.6, d: 1.5, h: 2.6, cat: 'wood', clr: 2.5, ok: ['ottoman', 'rug'], price: [40000, 90000], spec: ['wood', 'mirror'] },
    dresser_wall: { n: 'Wall-hung dresser with mirror', g: 'dresser', w: 3, d: 1.1, h: 0.6, y0: 2.4, mount: 'wall', cat: 'wood', clr: 2, price: [30000, 70000], spec: ['wood', 'mirror'] },
    chest: { n: 'Chest of drawers', g: 'dresser', w: 3.2, d: 1.6, h: 3.2, cat: 'wood', clr: 2.5, price: [35000, 85000], spec: ['wood', 'metal'] },
    bench: { n: 'Bed-end bench', g: 'seat', w: 4.2, d: 1.4, h: 1.5, cat: 'soft', clr: 0, price: [20000, 50000], spec: ['fabric', 'wood'] },
    ottoman: { n: 'Pouf / ottoman', g: 'seat', w: 1.6, d: 1.6, h: 1.4, cat: 'soft', clr: 0, price: [9000, 25000], spec: ['fabric'] },
    armchair: { n: 'Accent armchair', g: 'seat', w: 2.6, d: 2.7, h: 2.8, cat: 'soft', clr: 1.5, ok: ['sidetable', 'ottoman', 'rug', 'floorlamp'], price: [35000, 90000], spec: ['fabric', 'wood'] },
    recliner: { n: 'Recliner chair', g: 'seat', w: 3, d: 3.2, h: 3.3, cat: 'soft', clr: 2, ok: ['rug'], price: [70000, 160000], spec: ['fabric', 'metal'] },
    cradle: { n: 'Baby cot', g: 'kids', w: 2.4, d: 4.4, h: 3.2, cat: 'wood', clr: 2, price: [25000, 70000], spec: ['wood'] },
    toybox: { n: 'Toy storage bench', g: 'kids', w: 3, d: 1.4, h: 1.7, cat: 'wood', clr: 1.5, price: [12000, 30000], spec: ['laminate'] },
    kidsdesk: { n: 'Kids study desk', g: 'desk', w: 3.6, d: 1.8, h: 2.3, cat: 'wood', clr: 2.3, ok: ['officechair', 'rug'], price: [20000, 50000], spec: ['laminate', 'metal'] },
    desk: { n: 'Study / work desk', g: 'desk', w: 4.5, d: 2, h: 2.5, cat: 'wood', clr: 2.5, ok: ['officechair', 'rug'], price: [35000, 90000], spec: ['wood', 'metal'] },
    officechair: { n: 'Ergonomic desk chair', g: 'chair', w: 2.1, d: 2.1, h: 3.4, cat: 'soft', clr: 0, price: [20000, 60000], spec: ['mesh'] },
    bookshelf: { n: 'Bookshelf', g: 'storage', w: 3, d: 1.2, h: 6.8, cat: 'wood', tall: true, clr: 2, price: [25000, 70000], spec: ['wood'] },
    // living
    sofa3: { n: 'Three-seat sofa', g: 'sofa', w: 7, d: 3.1, h: 2.8, cat: 'soft', clr: 1.5, ok: ['coffee', 'coffee_round', 'rug', 'ottoman'], price: [120000, 300000], spec: ['fabric', 'wood'] },
    sofa2: { n: 'Two-seat sofa', g: 'sofa', w: 5.2, d: 3.1, h: 2.8, cat: 'soft', clr: 1.5, ok: ['coffee', 'coffee_round', 'rug', 'ottoman'], price: [80000, 200000], spec: ['fabric', 'wood'] },
    sofaL: { n: 'L-shaped sectional sofa', g: 'sofa', w: 9, d: 6.2, h: 2.8, lshape: 3.1, cat: 'soft', clr: 1.5, ok: ['coffee', 'coffee_round', 'rug', 'ottoman'], price: [220000, 480000], spec: ['fabric', 'wood'] },
    sofa1: { n: 'Single-seat sofa', g: 'seat', w: 2.9, d: 3, h: 2.8, cat: 'soft', clr: 1.5, ok: ['coffee', 'coffee_round', 'rug', 'sidetable', 'ottoman'], price: [45000, 110000], spec: ['fabric', 'wood'] },
    floorseat: { n: 'Floor seating (gaddi + gao takiye)', g: 'sofa', w: 6.5, d: 2.6, h: 1.4, cat: 'soft', clr: 1.5, ok: ['coffee', 'rug'], price: [35000, 90000], spec: ['fabric'] },
    coffee: { n: 'Centre table', g: 'table', w: 4, d: 2.2, h: 1.4, cat: 'wood', clr: 0, price: [25000, 70000], spec: ['wood', 'stone'] },
    coffee_round: { n: 'Round centre table', g: 'table', w: 3, d: 3, h: 1.4, round: true, cat: 'wood', clr: 0, price: [22000, 65000], spec: ['wood', 'stone'] },
    sidetable: { n: 'Side table', g: 'table', w: 1.7, d: 1.7, h: 1.9, round: true, cat: 'wood', clr: 0, price: [10000, 30000], spec: ['wood', 'metal'] },
    tvunit: { n: 'TV console with 55" TV', g: 'tv', w: 6.5, d: 1.5, h: 1.6, cat: 'wood', clr: 2, ok: ['rug'], price: [140000, 380000], spec: ['wood', 'tv'] },
    tvwall: { n: 'TV wall panel with floating console and 65" TV', g: 'tv', w: 8, d: 1.3, h: 1.2, y0: 0.8, panel: true, cat: 'wood', clr: 2, ok: ['rug'], price: [220000, 560000], spec: ['fluted', 'tv'] },
    console: { n: 'Console table', g: 'storage', w: 4, d: 1.3, h: 2.6, cat: 'wood', clr: 1.5, price: [30000, 80000], spec: ['wood', 'metal'] },
    sideboard: { n: 'Sideboard', g: 'storage', w: 5, d: 1.6, h: 2.8, cat: 'wood', clr: 2.5, price: [60000, 150000], spec: ['wood', 'metal'] },
    crockery: { n: 'Crockery cabinet with glass doors', g: 'storage', w: 4, d: 1.6, h: 6.8, cat: 'wood', tall: true, clr: 2.5, price: [75000, 180000], spec: ['wood', 'glass'] },
    shoe: { n: 'Shoe cabinet', g: 'storage', w: 3, d: 1.2, h: 3.4, cat: 'wood', clr: 2, price: [15000, 40000], spec: ['laminate'] },
    prayer: { n: 'Prayer corner (jai-namaz shelf + mat)', g: 'decor', w: 2.6, d: 4.2, h: 0.05, cat: 'rug', clr: 0, price: [12000, 35000], spec: ['wood'] },
    rug: { n: 'Rug', g: 'decor', w: 8, d: 5, h: 0.05, cat: 'rug', clr: 0, var: [3, 14], price: [25000, 90000], spec: ['rug'] },
    plant: { n: 'Indoor plant in planter', g: 'decor', w: 1.5, d: 1.5, h: 4.5, round: true, cat: 'plant', clr: 0, price: [4000, 15000], spec: ['plant'] },
    floorlamp: { n: 'Floor lamp', g: 'decor', w: 1.4, d: 1.4, h: 5.6, round: true, cat: 'metal', clr: 0, price: [12000, 40000], spec: ['metal'] },
    art: { n: 'Framed wall art', g: 'wall', w: 3.2, d: 0.12, h: 2.4, y0: 4.6, mount: 'wall', cat: 'art', clr: 0, price: [8000, 40000], spec: ['art'] },
    mirror: { n: 'Wall mirror', g: 'wall', w: 2.4, d: 0.12, h: 3.6, y0: 3, mount: 'wall', cat: 'glass', clr: 0, price: [10000, 35000], spec: ['mirror'] },
    mirror_full: { n: 'Full-length mirror', g: 'wall', w: 2, d: 0.12, h: 5.6, y0: 1, mount: 'wall', cat: 'glass', clr: 1.5, price: [12000, 30000], spec: ['mirror'] },
    ac: { n: '1.5-ton inverter split AC (indoor unit)', g: 'appliance', w: 3, d: 0.8, h: 1, y0: 7.4, mount: 'wall', cat: 'white', clr: 0, price: [180000, 280000], appliance: true, spec: ['appliance'] },
    // dining
    dining4: { n: 'Dining table, 4 seats', g: 'dining', w: 4, d: 3, h: 2.5, cat: 'wood', ring: 2.6, ok: ['chair', 'rug'], price: [60000, 140000], seats: 4, spec: ['wood', 'stone'] },
    dining6: { n: 'Dining table, 6 seats', g: 'dining', w: 6, d: 3.5, h: 2.5, cat: 'wood', ring: 2.75, ok: ['chair', 'rug'], price: [90000, 220000], seats: 6, spec: ['wood', 'stone'] },
    dining8: { n: 'Dining table, 8 seats', g: 'dining', w: 8, d: 3.8, h: 2.5, cat: 'wood', ring: 2.75, ok: ['chair', 'rug'], price: [140000, 320000], seats: 8, spec: ['wood', 'stone'] },
    round4: { n: 'Round dining table, 4 seats', g: 'dining', w: 3.8, d: 3.8, h: 2.5, round: true, cat: 'wood', ring: 2.5, ok: ['chair', 'rug'], price: [55000, 130000], seats: 4, spec: ['wood', 'stone'] },
    chair: { n: 'Dining chair', g: 'chair', w: 1.6, d: 1.7, h: 3.2, cat: 'wood', clr: 0, price: [12000, 30000], spec: ['wood', 'fabric'] },
    barstool: { n: 'Bar stool', g: 'chair', w: 1.4, d: 1.4, h: 2.6, round: true, cat: 'metal', clr: 0, price: [9000, 25000], spec: ['metal', 'fabric'] },
    // kitchen
    counter: { n: 'Base cabinets + quartz top + wall cabinets', g: 'kitchen', w: 8, d: 2, h: 2.9, cat: 'kitchen', clr: 3.5, var: [3, 16], perFt: [22000, 42000], spec: ['kcarcass', 'kshutter', 'stone'] },
    island: { n: 'Kitchen island / breakfast counter', g: 'kitchen', w: 5, d: 2.8, h: 3, cat: 'kitchen', clr: 3, ok: ['barstool'], price: [90000, 220000], spec: ['kcarcass', 'stone'] },
    fridge: { n: 'Refrigerator, 14 cu ft', g: 'kitchen', w: 2.7, d: 2.4, h: 6, cat: 'white', tall: true, clr: 3, price: [150000, 300000], appliance: true, spec: ['appliance'] },
    fridge2: { n: 'Side-by-side refrigerator', g: 'kitchen', w: 3, d: 2.4, h: 6, cat: 'white', tall: true, clr: 3, price: [280000, 520000], appliance: true, spec: ['appliance'] },
    ovencol: { n: 'Tall unit with built-in oven + microwave', g: 'kitchen', w: 2, d: 2, h: 7.3, cat: 'kitchen', tall: true, clr: 3, price: [140000, 320000], spec: ['kcarcass', 'appliance'] },
    dispenser: { n: 'Water dispenser', g: 'kitchen', w: 1.1, d: 1.1, h: 3.4, cat: 'white', clr: 1.5, price: [25000, 60000], appliance: true, spec: ['appliance'] },
    // bath
    wc: { n: 'Floor-mounted WC with concealed cistern', g: 'wc', w: 1.6, d: 2.3, h: 2.6, cat: 'white', clr: 1.75, side: 0.8, price: [35000, 90000], spec: ['sanitary'] },
    wc_wall: { n: 'Wall-hung WC with concealed cistern', g: 'wc', w: 1.6, d: 1.9, h: 2.6, cat: 'white', clr: 1.75, side: 0.8, price: [55000, 130000], spec: ['sanitary'] },
    basin: { n: 'Vanity with basin, mirror cabinet', g: 'basin', w: 2.4, d: 1.7, h: 2.8, cat: 'white', clr: 1.75, price: [35000, 90000], spec: ['vanity', 'sanitary'] },
    basin_wall: { n: 'Compact wall-hung basin, mirror', g: 'basin', w: 1.75, d: 1.35, h: 2.8, cat: 'white', clr: 1.6, price: [18000, 45000], spec: ['sanitary'] },
    basin2: { n: 'Double-basin vanity, mirror', g: 'basin', w: 4.2, d: 1.8, h: 2.8, cat: 'white', clr: 2, price: [70000, 170000], spec: ['vanity', 'sanitary'] },
    showerzone: { n: 'Wet area: rain shower, floor drain, glass splash panel', g: 'shower', w: 3, d: 3, h: 0.02, cat: 'glass', clr: 0, price: [30000, 80000], spec: ['cp', 'glassbath'] },
    shower: { n: 'Shower enclosure, glass, rain shower', g: 'shower', w: 3, d: 3, h: 7, cat: 'glass', tall: true, clr: 2, price: [55000, 140000], spec: ['glassbath', 'cp'] },
    bathtub: { n: 'Acrylic bathtub with mixer', g: 'shower', w: 5.2, d: 2.6, h: 1.9, cat: 'white', clr: 2, price: [90000, 250000], spec: ['sanitary', 'cp'] },
    geyser: { n: 'Instant electric geyser', g: 'appliance', w: 1.3, d: 0.6, h: 1.8, y0: 6, mount: 'wall', cat: 'white', clr: 0, price: [25000, 60000], appliance: true, spec: ['appliance'] },
    towel: { n: 'Towel rail + robe hooks', g: 'wall', w: 2.2, d: 0.3, h: 0.3, y0: 4, mount: 'wall', cat: 'metal', clr: 0, price: [6000, 18000], spec: ['cp'] },
    // utility
    washer: { n: 'Front-load washing machine', g: 'laundry', w: 2.2, d: 2.2, h: 2.8, cat: 'white', clr: 2.5, price: [110000, 220000], appliance: true, spec: ['appliance'] },
    dryer: { n: 'Dryer / spin unit', g: 'laundry', w: 2.2, d: 2.2, h: 2.8, cat: 'white', clr: 2.5, price: [70000, 160000], appliance: true, spec: ['appliance'] },
    utsink: { n: 'Utility sink cabinet', g: 'laundry', w: 2.2, d: 1.8, h: 2.9, cat: 'kitchen', clr: 2, price: [25000, 60000], spec: ['kcarcass', 'sanitary'] },
    shelf: { n: 'Storage shelving', g: 'storage', w: 4, d: 1.5, h: 6.5, cat: 'metal', tall: true, clr: 2, var: [2, 12], perFt: [5000, 10000], spec: ['metal'] },
    // outdoor
    car: { n: 'Car (for scale)', g: 'outdoor', w: 6.2, d: 15, h: 4.8, cat: 'car', clr: 0, price: [0, 0], noBudget: true },
    otable: { n: 'Outdoor table', g: 'outdoor', w: 3, d: 3, h: 2.4, round: true, cat: 'metal', ring: 2.2, ok: ['ochair'], price: [20000, 60000], spec: ['outdoor'] },
    ochair: { n: 'Outdoor chair', g: 'outdoor', w: 2, d: 2, h: 2.8, cat: 'metal', clr: 0, price: [8000, 20000], spec: ['outdoor'] },
    lounger: { n: 'Sun lounger', g: 'outdoor', w: 2.3, d: 6.5, h: 1.3, cat: 'metal', clr: 1.5, price: [25000, 70000], spec: ['outdoor'] },
    swing: { n: 'Garden swing (jhoola)', g: 'outdoor', w: 6, d: 4, h: 6.5, cat: 'metal', clr: 3, price: [45000, 120000], spec: ['outdoor'] },
    bbq: { n: 'BBQ counter', g: 'outdoor', w: 4, d: 2, h: 3, cat: 'kitchen', clr: 3, price: [40000, 110000], spec: ['outdoor'] },
    planter: { n: 'Planter with shrub', g: 'outdoor', w: 1.6, d: 1.6, h: 3.5, round: true, cat: 'plant', clr: 0, price: [5000, 15000], spec: ['plant'] },
  };
  Object.values(F).forEach(s => { s.y0 = s.y0 || 0; if (s.clr == null) s.clr = 0; s.ok = s.ok || []; });

  // ---------- themes, finishes ----------
  const THEMES = {
    modern: { n: 'Modern', wood: '#A67C52', soft: '#8E99A4', accent: '#2F6FB0', metal: '#2B2B2B', light: '#ECE8E2', mult: 1.0, blurb: 'Oak, grey fabric, black metal',
      mat: { wood: 'Oak veneer on E1 MDF, matt PU lacquer', fabric: 'Grey woven polyester, high-rub (35,000 cycles)', metal: 'Powder-coated black mild steel', stone: 'Engineered quartz top, 20 mm', carcass: '18 mm moisture-resistant MDF carcass, white laminate inside', shutter: 'Oak-veneer shutters, soft-close hinges, black profile handles', laminate: 'High-pressure laminate on MDF', mesh: 'Black mesh back, nylon base, gas lift', fluted: 'Fluted oak-veneer wall panel with LED backlight', mirror: '5 mm silver mirror, polished edge', glass: '5 mm tinted toughened glass doors', kcarcass: '18 mm marine plywood carcass (BWP)', kshutter: 'Acrylic gloss shutters, soft-close, handle-less profile', vanity: 'Marine plywood vanity, acrylic shutters', sanitary: 'Vitreous china, white', glassbath: '8 mm clear toughened glass, chrome hardware', cp: 'Chrome-plated brass fittings', tv: 'Smart LED TV', rug: 'Hand-tufted wool blend', plant: 'Fibre-glass planter, live plant', art: 'Canvas print, oak frame', appliance: 'Inverter / energy-rated appliance', outdoor: 'Powder-coated aluminium, outdoor fabric' } },
    classic: { n: 'Classic', wood: '#6B4226', soft: '#D8C7A8', accent: '#8C2F39', metal: '#B08D3C', light: '#F1E7D6', mult: 1.25, blurb: 'Walnut, beige upholstery, brass',
      mat: { wood: 'Solid walnut-stained sheesham, satin polish', fabric: 'Beige velvet, piping detail', metal: 'Antique-brass finish', stone: 'Beige marble top, bevelled edge', carcass: '18 mm plywood carcass, walnut laminate inside', shutter: 'Raised-panel walnut veneer shutters, brass knobs', laminate: 'Walnut veneer on plywood', mesh: 'Leatherette upholstery, brass castors', fluted: 'Walnut panelling with moulding', mirror: '5 mm bevelled mirror, gilt frame', glass: 'Bevelled clear glass doors', kcarcass: '18 mm marine plywood carcass (BWP)', kshutter: 'Shaker-style painted shutters, brass handles', vanity: 'Teak-finish vanity, marble top', sanitary: 'Vitreous china, ivory', glassbath: '8 mm clear toughened glass, brass hardware', cp: 'Brushed-gold brass fittings', tv: 'Smart LED TV', rug: 'Hand-knotted wool, traditional pattern', plant: 'Ceramic planter, live plant', art: 'Oil-on-canvas print, ornate frame', appliance: 'Inverter / energy-rated appliance', outdoor: 'Cast-aluminium, cushioned' } },
    minimal: { n: 'Minimal', wood: '#D9C2A0', soft: '#E9E6DF', accent: '#7A8B7A', metal: '#9A9A9A', light: '#F6F3EE', mult: 0.9, blurb: 'Light oak, linen, soft green',
      mat: { wood: 'Light-oak laminate on MDF, matt', fabric: 'Linen-look cotton blend, removable covers', metal: 'Satin-grey steel', stone: 'White solid-surface top', carcass: '18 mm MDF carcass, white laminate', shutter: 'Matt white lacquer shutters, J-pull handles', laminate: 'Matt white laminate', mesh: 'Grey mesh, white frame', fluted: 'Light-oak slatted panel', mirror: '5 mm mirror, frameless', glass: 'Frosted glass doors', kcarcass: '18 mm marine plywood carcass (BWP)', kshutter: 'Matt anti-fingerprint laminate shutters', vanity: 'Wall-hung vanity, matt white', sanitary: 'Vitreous china, white', glassbath: '8 mm clear glass, frameless', cp: 'Brushed-steel fittings', tv: 'Smart LED TV', rug: 'Flat-weave cotton dhurrie', plant: 'Cement planter, live plant', art: 'Line-art print, thin oak frame', appliance: 'Inverter / energy-rated appliance', outdoor: 'Teak-finish aluminium' } },
    traditional: { n: 'Traditional', wood: '#5A3420', soft: '#9C2F2F', accent: '#C9A227', metal: '#A57C2C', light: '#EFE1C8', mult: 1.15, blurb: 'Sheesham wood, maroon, gold',
      mat: { wood: 'Solid sheesham with hand carving, melamine polish', fabric: 'Maroon jamawar / velvet with gold piping', metal: 'Hand-beaten brass', stone: 'Green onyx top', carcass: '18 mm plywood carcass, sheesham veneer', shutter: 'Carved sheesham shutters, brass handles', laminate: 'Sheesham veneer', mesh: 'Leather upholstery', fluted: 'Carved jali wood panel', mirror: 'Mirror in carved wooden frame', glass: 'Clear glass with brass grille', kcarcass: '18 mm marine plywood carcass (BWP)', kshutter: 'Sheesham-veneer shutters, brass knobs', vanity: 'Sheesham vanity, onyx top', sanitary: 'Vitreous china, ivory', glassbath: '8 mm clear toughened glass', cp: 'Antique-brass fittings', tv: 'Smart LED TV', rug: 'Hand-knotted Afghan/Bokhara rug', plant: 'Terracotta planter, live plant', art: 'Truck-art / calligraphy panel', appliance: 'Inverter / energy-rated appliance', outdoor: 'Wrought iron with cushions' } },
  };
  const FLOORS = {
    marble: { n: 'Marble', spec: 'Ziarat / Botticino marble, 24" × 24" × 20 mm, polished, 1/16" joints', color: '#ECE8E1', tile: [2, 2], rate: [650, 1200] },
    porcelain: { n: 'Porcelain tiles', spec: 'Glazed porcelain 24" × 24" (600 × 600 mm), matt, rectified, 2 mm joints', color: '#D8D5CF', tile: [2, 2], rate: [350, 600] },
    largeslab: { n: 'Large porcelain slabs', spec: 'Porcelain slab 24" × 48" (600 × 1200 mm), satin, rectified', color: '#DEDAD3', tile: [4, 2], rate: [550, 950] },
    wood: { n: 'Wooden flooring', spec: 'Engineered oak, 8" × 48" planks, 14 mm, click-lock on 3 mm underlay', color: '#B88A5E', tile: [4, 0.67], plank: true, rate: [700, 1400] },
    laminate: { n: 'Laminate flooring', spec: 'AC4 laminate, 8" × 48" planks, 8 mm, on foam underlay', color: '#C49B70', tile: [4, 0.67], plank: true, rate: [320, 550] },
    terrazzo: { n: 'Terrazzo', spec: 'Cast-in-situ terrazzo, 3/4" chips, ground and polished, brass strips at 4 ft', color: '#CFC8BC', tile: [4, 4], rate: [300, 550] },
    ceramic: { n: 'Anti-slip ceramic', spec: 'Anti-slip ceramic 12" × 12" (300 × 300 mm), R11, 3 mm joints, epoxy grout', color: '#C9CED3', tile: [1, 1], rate: [250, 450] },
    pavers: { n: 'Outdoor pavers', spec: 'Concrete / porcelain outdoor pavers 18" × 18", R12 anti-slip', color: '#B9B2A6', tile: [1.5, 1.5], rate: [200, 400] },
  };
  const WALLS = {
    ivory: { n: 'Ivory', color: '#F1ECE2' }, warm: { n: 'Warm white', color: '#F7F4EE' }, sage: { n: 'Sage', color: '#C7D2BE' }, sky: { n: 'Sky', color: '#CFE0EE' },
    sand: { n: 'Sand', color: '#E5D5BD' }, greige: { n: 'Greige', color: '#D7D1C7' }, clay: { n: 'Terracotta', color: '#D8A283' }, charcoal: { n: 'Charcoal', color: '#5C6066' },
  };
  const PAINT = [70, 110];
  const WET = new Set(['bath', 'sbath', 'powder', 'laundry']);
  const OUT = new Set(['porch', 'terrace', 'court']);
  const NOFURN = new Set(['stair', 'passage', 'shaft', 'proof']);
  function defaultFinish(t) {
    if (WET.has(t)) return { floor: 'ceramic', wall: 'warm' };
    if (OUT.has(t)) return { floor: 'pavers', wall: 'warm' };
    if (t === 'bed' || t === 'study' || t === 'dress') return { floor: 'wood', wall: t === 'bed' ? 'sage' : 'ivory' };
    if (t === 'kitchen') return { floor: 'porcelain', wall: 'warm' };
    if (t === 'servant' || t === 'store') return { floor: 'terrazzo', wall: 'warm' };
    if (t === 'lounge' || t === 'flounge') return { floor: 'largeslab', wall: 'greige' };
    return { floor: 'marble', wall: t === 'drawing' ? 'sand' : 'ivory' };
  }
  // room purposes (change the automatic layout)
  const ROLES = { bed: { master: 'Master bedroom', couple: 'Couple / guest bedroom', parents: 'Parents’ bedroom', kids: 'Kids’ bedroom (2 beds)', nursery: 'Nursery' }, lounge: { family: 'Family lounge', tv: 'TV lounge with floor seating' }, drawing: { formal: 'Formal drawing room', majlis: 'Majlis (floor seating)' } };
  // what can be added to each room type
  const DECOR = ['plant', 'floorlamp', 'rug', 'art', 'mirror', 'armchair', 'sidetable', 'ac'];
  const ADD = {
    bed: ['bed_king', 'bed_queen', 'bed_storage', 'bed_double', 'bed_single', 'bed_bunk', 'daybed', 'cradle', 'nightstand', 'nightstand_float', 'wardrobe', 'wardrobe_slide', 'dresser', 'dresser_wall', 'chest', 'bench', 'ottoman', 'recliner', 'desk', 'kidsdesk', 'officechair', 'bookshelf', 'toybox', 'tvwall', 'prayer', 'mirror_full'],
    servant: ['bed_single', 'wardrobe', 'chest', 'chair', 'ac'],
    lounge: ['sofaL', 'sofa3', 'sofa2', 'sofa1', 'floorseat', 'coffee', 'coffee_round', 'tvunit', 'tvwall', 'console', 'bookshelf', 'dining4', 'dining6', 'round4', 'chair', 'crockery', 'prayer'],
    flounge: ['sofaL', 'sofa3', 'sofa2', 'sofa1', 'floorseat', 'coffee', 'coffee_round', 'tvunit', 'tvwall', 'bookshelf', 'desk', 'prayer'],
    drawing: ['sofa3', 'sofa2', 'sofa1', 'floorseat', 'coffee', 'coffee_round', 'console', 'sideboard', 'crockery'],
    dining: ['dining4', 'dining6', 'dining8', 'round4', 'chair', 'sideboard', 'crockery', 'console'],
    kitchen: ['counter', 'island', 'fridge', 'fridge2', 'ovencol', 'dispenser', 'round4', 'dining4', 'chair', 'barstool'],
    bath: ['wc', 'wc_wall', 'basin', 'basin_wall', 'basin2', 'showerzone', 'shower', 'bathtub', 'geyser', 'towel', 'mirror'], sbath: ['wc', 'basin', 'basin_wall', 'showerzone', 'shower', 'geyser', 'towel'], powder: ['wc', 'wc_wall', 'basin', 'basin_wall', 'mirror', 'towel'],
    dress: ['wardrobe', 'wardrobe_slide', 'dresser', 'chest', 'ottoman', 'mirror_full', 'shoe'], study: ['desk', 'officechair', 'bookshelf', 'sofa2', 'armchair', 'floorlamp'],
    laundry: ['washer', 'dryer', 'utsink', 'shelf', 'counter'], store: ['shelf'], foyer: ['console', 'shoe', 'mirror', 'plant', 'art'],
    porch: ['car', 'planter'], terrace: ['otable', 'ochair', 'lounger', 'swing', 'bbq', 'planter'], court: ['planter', 'otable', 'ochair', 'swing', 'lounger'],
  };
  const addList = t => Array.from(new Set((ADD[t] || []).concat(OUT.has(t) || WET.has(t) || t === 'store' ? [] : DECOR)));
  const swapList = k => { const s = F[k]; if (!s) return []; return Object.keys(F).filter(x => F[x].g === s.g && x !== k && !(s.mount === 'wall') === !(F[x].mount === 'wall')); };

  // ---------- geometry ----------
  const footprint = it => (it.rot % 180 === 0 ? { fw: it.w, fd: it.d } : { fw: it.d, fd: it.w });
  const rectOf = it => { const { fw, fd } = footprint(it); return { x: it.cx - fw / 2, y: it.cy - fd / 2, w: fw, h: fd }; };
  const overlap = (a, b, pad) => { pad = pad || 0; return a.x < b.x + b.w - pad && b.x < a.x + a.w - pad && a.y < b.y + b.h - pad && b.y < a.y + a.h - pad; };
  const spec = it => F[it.k] || { h: 2, y0: 0, clr: 0, ok: [] };
  const yr = it => { const s = spec(it); const y0 = it.y0 != null ? it.y0 : s.y0; return [y0, y0 + s.h + (s.hb && !it.y0 ? s.hb - s.h : 0)]; };
  const vOverlap = (a, b) => { const A = yr(a), B = yr(b); return A[0] < B[1] - 0.05 && B[0] < A[1] - 0.05; };
  function roomKey(fi, r) { return `${fi}:${r.t}:${Math.round(r.x * 4)}:${Math.round(r.y * 4)}`; }
  function roomGeom(plan, fi, r) {
    const f = plan.floors[fi]; const h = WALL / 2;
    const x0 = r.x + h, y0 = r.y + h, W = Math.max(1, r.w - WALL), H = Math.max(1, r.h - WALL);
    const ops = [];
    const put = (o, kind, extra) => {
      let side, a, b;
      if (o.orient === 'h') {
        if (Math.abs(o.at - r.y) < 0.12) side = 'N'; else if (Math.abs(o.at - (r.y + r.h)) < 0.12) side = 'S'; else return;
        a = Math.max(o.p0, r.x) - x0; b = Math.min(o.p1, r.x + r.w) - x0;
      } else {
        if (Math.abs(o.at - r.x) < 0.12) side = 'W'; else if (Math.abs(o.at - (r.x + r.w)) < 0.12) side = 'E'; else return;
        a = Math.max(o.p0, r.y) - y0; b = Math.min(o.p1, r.y + r.h) - y0;
      }
      const len = side === 'N' || side === 'S' ? W : H; a = Math.max(0, a); b = Math.min(len, b);
      if (b - a > 0.4) ops.push(Object.assign({ side, a, b, kind }, extra || {}));
    };
    f.doors.filter(d => d.a === r.id || d.b === r.id).forEach(d => put(d, d.kind === 'open' ? 'open' : 'door', { hingeA: !!d.hingeStart, into: d.b === r.id, entry: d.kind === 'entry' || d.a === 'out' }));
    f.windows.filter(w => w.room === r.id).forEach(w => put(w, 'window'));
    const open = OUT.has(r.t);
    return { key: roomKey(fi, r), fi, id: r.id, t: r.t, name: r.name, x0, y0, W, H, ops, open, area: W * H };
  }
  const wallLen = (g, s) => (s === 'N' || s === 'S' ? g.W : g.H);
  function zones(g, shallow) {
    return g.ops.filter(o => o.kind !== 'window').map(o => {
      const dz = shallow ? 1.4 : Math.min(3.2, Math.max(2.5, o.b - o.a)), a = o.a - 0.2, len = o.b - o.a + 0.4;
      if (o.side === 'N') return { x: a, y: 0, w: len, h: dz }; if (o.side === 'S') return { x: a, y: g.H - dz, w: len, h: dz };
      if (o.side === 'W') return { x: 0, y: a, w: dz, h: len }; return { x: g.W - dz, y: a, w: dz, h: len };
    });
  }
  const front = it => ({ 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] }[((it.rot % 360) + 360) % 360]);
  // clear zones needed around an item (front; plus sides for beds, WCs; ring for dining tables)
  function clearZones(it, k) {
    const s = spec(it); k = k == null ? 1 : k; const out = []; const r = rectOf(it);
    if (s.ring) { const c = s.ring * k; out.push({ x: r.x - c, y: r.y - c, w: r.w + 2 * c, h: r.h + 2 * c, ring: true }); return out; }
    const c = s.clr * k; const fv = front(it);
    if (c > 0) {
      if (fv[1] === 1) out.push({ x: r.x, y: r.y + r.h, w: r.w, h: c }); else if (fv[1] === -1) out.push({ x: r.x, y: r.y - c, w: r.w, h: c });
      else if (fv[0] === 1) out.push({ x: r.x + r.w, y: r.y, w: c, h: r.h }); else out.push({ x: r.x - c, y: r.y, w: c, h: r.h });
    }
    const sd = (s.side || 0) * k;
    if (sd > 0) { if (fv[1] !== 0) { out.push({ x: r.x - sd, y: r.y + r.h * 0.25, w: sd, h: r.h * 0.75, sideZ: true }); out.push({ x: r.x + r.w, y: r.y + r.h * 0.25, w: sd, h: r.h * 0.75, sideZ: true }); } else { out.push({ x: r.x + r.w * 0.25, y: r.y - sd, w: r.w * 0.75, h: sd, sideZ: true }); out.push({ x: r.x + r.w * 0.25, y: r.y + r.h, w: r.w * 0.75, h: sd, sideZ: true }); } }
    return out;
  }
  const isWallItem = it => spec(it).mount === 'wall' || (it.y0 != null && it.y0 >= 2.4);
  const FLAT = new Set(['rug', 'prayer', 'showerzone']);
  const floorBlocks = it => !FLAT.has(it.k) && yr(it)[0] < 2.4;
  function atWall(g, k, side, t, w) {
    const s = F[k]; const it = { k, w: w || s.w, d: s.d, rot: { N: 0, E: 90, S: 180, W: 270 }[side], wall: side };
    if (side === 'N') { it.cx = t; it.cy = it.d / 2; } else if (side === 'S') { it.cx = t; it.cy = g.H - it.d / 2; }
    else if (side === 'W') { it.cy = t; it.cx = it.d / 2; } else { it.cy = t; it.cx = g.W - it.d / 2; }
    return it;
  }
  // can `it` go here? Checks the room, doors, windows, other items (height-aware) and clear zones both ways.
  function fits(g, it, placed, zs, opts) {
    opts = opts || {}; const s = spec(it); const r = rectOf(it); const k = opts.relax ? 0.7 : 1;
    if (r.x < -0.01 || r.y < -0.01 || r.x + r.w > g.W + 0.01 || r.y + r.h > g.H + 0.01) return false;
    const wall = isWallItem(it);
    if (!wall && !opts.ignoreZones && it.k !== 'rug' && zs.some(z => overlap(r, z, 0.05))) return false;
    if (it.wall) {
      const half = it.w / 2, t = it.wall === 'N' || it.wall === 'S' ? it.cx : it.cy;
      const hit = g.ops.filter(o => o.side === it.wall && t - half < o.b + 0.15 && t + half > o.a - 0.15);
      if (wall && hit.length) return false;                                                       // nothing hangs over an opening
      if ((s.tall || s.panel || opts.noWindow) && hit.some(o => o.kind === 'window')) return false;
      if (hit.some(o => o.kind !== 'window')) return false;
    }
    for (const p of placed) {
      if (FLAT.has(p.k) || FLAT.has(it.k)) { if ((it.k === 'prayer' || it.k === 'showerzone') && floorBlocks(p) && overlap(r, rectOf(p), 0.02)) return false; if (FLAT.has(p.k) && FLAT.has(it.k) && p.k !== 'rug' && it.k !== 'rug' && overlap(r, rectOf(p), 0.02)) return false; continue; }
      if (overlap(r, rectOf(p), 0.02) && vOverlap(it, p)) return false;
    }
    if (opts.noClear) return true;
    // my body must stay out of others' clear zones (unless I belong there); my clear zone must stay free of others' bodies
    if (!wall) for (const p of placed) { if (p.k === 'rug' || isWallItem(p)) continue; const ps = spec(p); if (ps.ok.includes(it.k)) continue;
      if (clearZones(p, k).some(z => overlap(r, z, 0.05))) return false; }
    const mz = clearZones(it, k);
    for (const z of mz) {
      if (!z.ring && !z.sideZ && (z.x < -0.3 || z.y < -0.3 || z.x + z.w > g.W + 0.3 || z.y + z.h > g.H + 0.3)) return false;
      for (const p of placed) { if (!floorBlocks(p) || s.ok.includes(p.k)) continue; if (overlap(z, rectOf(p), 0.05)) return false; }
    }
    return true;
  }
  function tryWall(g, placed, zs, k, sides, align, w, opts) {
    const s = F[k]; const width = w || s.w; opts = opts || {};
    for (const relax of opts.strict ? [false] : [false, true]) {
      for (const side of sides) {
        const len = wallLen(g, side); if (len < width) continue;
        const cands = []; for (let t = width / 2; t <= len - width / 2 + 1e-6; t += 0.25) cands.push(t);
        const doorMid = g.ops.filter(o => o.kind !== 'window').map(o => ({ o, m: (o.a + o.b) / 2 }));
        const score = t => {
          if (align === 'start') return t; if (align === 'end') return -t;
          if (align === 'far') { const same = doorMid.filter(d => d.o.side === side); return same.length ? -Math.min(...same.map(d => Math.abs(d.m - t))) : Math.abs(t - len / 2); }
          if (typeof align === 'number') return Math.abs(t - align);
          return Math.abs(t - len / 2);
        };
        cands.sort((a, b) => score(a) - score(b));
        for (const t of cands) { const it = atWall(g, k, side, t, width); if (s.y0) it.y0 = s.y0; if (fits(g, it, placed, zs, Object.assign({}, opts, { relax }))) { if (relax) it.tight = true; placed.push(it); return it; } }
      }
    }
    return null;
  }
  const opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const perp = s => (s === 'N' || s === 'S' ? ['W', 'E'] : ['N', 'S']);
  function freeItem(g, placed, zs, k, cx, cy, rot, opts) { const s = F[k]; const it = { k, w: (opts && opts.w) || s.w, d: (opts && opts.d) || s.d, rot: rot || 0, cx, cy }; if (s.y0) it.y0 = s.y0; if (fits(g, it, placed, zs, opts)) { placed.push(it); return it; } return null; }
  function rankWalls(g, wantLong) {
    const sides = ['N', 'E', 'S', 'W'];
    const doorLen = s => g.ops.filter(o => o.side === s && o.kind !== 'window').reduce((a, o) => a + (o.b - o.a), 0);
    const winLen = s => g.ops.filter(o => o.side === s && o.kind === 'window').reduce((a, o) => a + (o.b - o.a), 0);
    return sides.slice().sort((a, b) => (doorLen(a) - doorLen(b)) * 10 + (winLen(a) - winLen(b)) * 2 + (wantLong ? wallLen(g, b) - wallLen(g, a) : 0));
  }
  const solidWalls = g => rankWalls(g, true).filter(s => !g.ops.some(o => o.side === s && o.kind === 'window'));

  // ---------- recipes ----------
  function autoRole(g, ctx) {
    if (g.t === 'bed') { if (ctx.role) return ctx.role; if (g.fi === 1 && ctx.largestBed) return 'master'; if (g.fi === 0) return 'parents'; return g.area < 135 && ctx.bedCount >= 3 ? 'kids' : 'couple'; }
    if (g.t === 'lounge' || g.t === 'flounge') return ctx.role || 'family';
    if (g.t === 'drawing') return ctx.role || 'formal';
    return ctx.role || null;
  }
  function decorate(g, placed, zs, opts) {
    opts = opts || {};
    // AC on a wall without windows or doors, facing the main seating / bed
    if (opts.ac && g.area >= 70) tryWall(g, placed, zs, 'ac', opts.acSides || solidWalls(g), 'center', null, { ignoreZones: true });
    if (opts.art) for (const a of [].concat(opts.art)) { const host = placed.find(p => p.k === a); if (host && host.wall) { const t = host.wall === 'N' || host.wall === 'S' ? host.cx : host.cy; tryWall(g, placed, zs, 'art', [host.wall], t, null, { ignoreZones: true }); } }
    if (opts.plant) tryWall(g, placed, zs, 'plant', rankWalls(g), 'end');
    if (opts.lamp) tryWall(g, placed, zs, 'floorlamp', rankWalls(g), 'start');
  }
  function layout(g, ctx) {
    ctx = ctx || {}; const placed = [], zs = zones(g), t = g.t; const W = g.W, H = g.H;
    const ranked = rankWalls(g, true); const role = autoRole(g, ctx);
    if (NOFURN.has(t) || W < 2.5 || H < 2.5) return [];
    const wardrobe = (sides, maxLen, slide) => { const k = slide ? 'wardrobe_slide' : 'wardrobe'; for (const side of sides) { const len = Math.min(maxLen || 8, wallLen(g, side) - 0.5); for (let L = Math.floor(len * 2) / 2; L >= 3; L -= 0.5) { if (tryWall(g, placed, zs, k, [side], 'far', L)) return true; } } return false; };
    if (t === 'bed' || t === 'servant') {
      const big = Math.min(W, H) >= 13 && g.area >= 180, mid = Math.min(W, H) >= 10.5;
      if (role === 'kids' && t === 'bed') {
        const sides = ranked; let n = 0;
        if (Math.max(W, H) >= 8.5) for (const s of sides) { if (n >= 2) break; if (tryWall(g, placed, zs, 'bed_single', [s], n ? 'end' : 'start')) n++; }
        if (n < 2 && !n) tryWall(g, placed, zs, 'bed_bunk', sides, 'center');
        placed.filter(p => p.k === 'bed_single').forEach(b => { const tt = b.wall === 'N' || b.wall === 'S' ? b.cx : b.cy; const it = atWall(g, 'nightstand', b.wall, tt + (b.w / 2 + 0.9) * (tt < wallLen(g, b.wall) / 2 ? 1 : -1)); if (fits(g, it, placed, zs)) placed.push(it); });
        wardrobe(ranked, 6, Math.min(W, H) < 10);
        const desk = tryWall(g, placed, zs, 'kidsdesk', ranked, 'center'); if (desk) { const fv = front(desk); freeItem(g, placed, zs, 'officechair', desk.cx + fv[0] * (desk.d / 2 + 1.1), desk.cy + fv[1] * (desk.d / 2 + 1.1), (desk.rot + 180) % 360, { noClear: true }); }
        tryWall(g, placed, zs, 'toybox', ranked, 'end'); tryWall(g, placed, zs, 'bookshelf', ranked, 'end');
        const b0 = placed.find(p => p.k.startsWith('bed_')); if (b0) placed.unshift({ k: 'rug', w: 5, d: 3.5, rot: b0.rot, cx: Math.min(W - 2.6, Math.max(2.6, W / 2)), cy: Math.min(H - 2, Math.max(2, H / 2)) });
        decorate(g, placed, zs, { ac: true, art: 'bed_single' });
      } else {
        let bk = t === 'servant' ? 'bed_single' : role === 'nursery' ? 'bed_double' : big ? 'bed_king' : mid ? 'bed_queen' : 'bed_double';
        let bed = null; for (const k of [bk, 'bed_queen', 'bed_double', 'bed_single']) { if (F[k].w > Math.max(W, H)) continue; bed = tryWall(g, placed, zs, k, ranked.filter(s => wallLen(g, s) >= F[k].w + (t === 'bed' ? 3 : 0)).concat(ranked), 'center', null, { strict: true }) || tryWall(g, placed, zs, k, ranked, 'center'); if (bed) break; }
        if (bed && t === 'bed') {
          const side = bed.wall, along = side === 'N' || side === 'S' ? bed.cx : bed.cy; const half = bed.w / 2 + 0.9;
          [-1, 1].forEach(sg => { let ns = atWall(g, 'nightstand', side, along + sg * half); if (!fits(g, ns, placed, zs, { noClear: true })) { ns = atWall(g, 'nightstand_float', side, along + sg * (bed.w / 2 + 0.85)); ns.y0 = F.nightstand_float.y0; } if (fits(g, ns, placed, zs, { noClear: true })) placed.push(ns); });
          if (role === 'nursery') tryWall(g, placed, zs, 'cradle', perp(side), 'center');
          const fv = front(bed); const footRoom = (side === 'N' || side === 'S' ? H : W) - bed.d;
          if (footRoom >= 6.5 && role !== 'nursery') freeItem(g, placed, zs, 'bench', bed.cx + fv[0] * (bed.d / 2 + 0.75), bed.cy + fv[1] * (bed.d / 2 + 0.75), bed.rot);
          wardrobe(perp(side).concat([opp[side]]), role === 'master' ? 10 : 8, Math.min(W, H) - bed.d < 6);
          if (g.area >= 135) tryWall(g, placed, zs, role === 'parents' ? 'chest' : 'dresser', [opp[side]].concat(perp(side)), 'center') || tryWall(g, placed, zs, 'dresser_wall', [opp[side]].concat(perp(side)), 'center');
          if (role === 'master' && footRoom >= 7.5) tryWall(g, placed, zs, 'tvwall', [opp[side]], 'center');
          if (role === 'parents' && g.area >= 150) tryWall(g, placed, zs, 'prayer', perp(side).concat([opp[side]]), 'end', null, { ignoreZones: true });
          if (g.area >= 170) { const ac = tryWall(g, placed, zs, role === 'parents' ? 'recliner' : 'armchair', perp(side).concat([opp[side]]), 'end'); if (ac && role === 'master') tryWall(g, placed, zs, 'floorlamp', [ac.wall], 'end'); }
          placed.unshift({ k: 'rug', w: Math.min(bed.w + 2.5, W - 1), d: Math.min(5, bed.d * 0.7), rot: bed.rot, cx: bed.cx + fv[0] * bed.d * 0.22, cy: bed.cy + fv[1] * bed.d * 0.22 });
          decorate(g, placed, zs, { ac: true, acSides: [opp[side]].concat(perp(side)), art: bed.k });
        } else if (bed) { wardrobe(perp(bed.wall).concat([opp[bed.wall]]), 4); decorate(g, placed, zs, { ac: false }); }
      }
    } else if (t === 'lounge' || t === 'flounge' || t === 'drawing') {
      const long = W >= H ? ['N', 'S'] : ['W', 'E'];
      const withDining = t === 'lounge' && !ctx.hasDining && Math.max(W, H) >= 15;
      const zoneSides = long.slice().sort((a, b) => rankWalls(g).indexOf(a) - rankWalls(g).indexOf(b));
      if (t === 'drawing') {
        if (role === 'majlis') { zoneSides.concat(perp(zoneSides[0])).forEach(s => tryWall(g, placed, zs, 'floorseat', [s], 'center')); freeItem(g, placed, zs, 'coffee', W / 2, H / 2, W >= H ? 0 : 90); }
        else {
          const sofa = tryWall(g, placed, zs, 'sofa3', zoneSides, 'center') || tryWall(g, placed, zs, 'sofa2', zoneSides, 'center');
          if (sofa) {
            const fv = front(sofa); const depth = (sofa.wall === 'N' || sofa.wall === 'S') ? H : W;
            const off = Math.min(depth - sofa.d - 1.5, 4.2);
            const ct = freeItem(g, placed, zs, 'coffee', sofa.cx + fv[0] * (sofa.d / 2 + 1.5 + 1.1), sofa.cy + fv[1] * (sofa.d / 2 + 1.5 + 1.1), sofa.rot, { noClear: true }) || freeItem(g, placed, zs, 'coffee_round', sofa.cx + fv[0] * (sofa.d / 2 + off / 1.6 + 1), sofa.cy + fv[1] * (sofa.d / 2 + off / 1.6 + 1), 0, { noClear: true });
            perp(sofa.wall).forEach(ps => { const s1 = tryWall(g, placed, zs, 'sofa1', [ps], ct ? (ps === 'N' || ps === 'S' ? ct.cx : ct.cy) : 'center') || tryWall(g, placed, zs, 'sofa1', [ps], 'center'); if (s1) { const tt = s1.wall === 'N' || s1.wall === 'S' ? s1.cx : s1.cy; tryWall(g, placed, zs, 'sidetable', [ps], tt + (tt > wallLen(g, ps) / 2 ? -2.4 : 2.4), null, { noClear: true }); } });
            tryWall(g, placed, zs, 'console', [opp[sofa.wall]], 'center') || tryWall(g, placed, zs, 'sideboard', ranked, 'center');
            if (ct) placed.unshift({ k: 'rug', w: Math.min(9, W - 3), d: Math.min(6.5, H - 4), rot: sofa.rot, cx: ct.cx, cy: ct.cy });
            decorate(g, placed, zs, { ac: true, art: [sofa.k, 'console'], plant: true, lamp: true });
          }
        }
      } else {
        const tvk = role === 'tv' || Math.max(W, H) < 13 ? 'tvunit' : 'tvwall';
        const tv = tryWall(g, placed, zs, tvk, zoneSides, withDining ? 'start' : 'center') || tryWall(g, placed, zs, 'tvunit', zoneSides.concat(ranked), withDining ? 'start' : 'center');
        if (tv) {
          const s2 = opp[tv.wall]; const along = tv.wall === 'N' || tv.wall === 'S' ? tv.cx : tv.cy;
          let sofa = null;
          const kinds = role === 'tv' ? ['floorseat', 'sofa3', 'sofa2'] : g.area >= 230 && !withDining ? ['sofaL', 'sofa3', 'sofa2'] : ['sofa3', 'sofa2'];
          for (const k of kinds) { const it = atWall(g, k, s2, along, null); if (fits(g, it, placed, zs)) { placed.push(sofa = it); break; } const it2 = tryWall(g, placed, zs, k, [s2], along); if (it2) { sofa = it2; break; } }
          if (!sofa) sofa = tryWall(g, placed, zs, 'sofa2', [s2], 'center');
          if (!sofa) { const fvT = front(tv); const gapT = (tv.wall === 'N' || tv.wall === 'S') ? H : W; // opposite side is open: float the sofa facing the TV
            for (const k of ['sofa3', 'sofa2']) { for (let dist = Math.min(10, gapT - F[k].d / 2 - 0.4); dist >= 6.5 && !sofa; dist -= 0.5) for (const relax of [false, true]) { sofa = freeItem(g, placed, zs, k, tv.cx + fvT[0] * dist, tv.cy + fvT[1] * dist, (tv.rot + 180) % 360, { relax }); if (sofa) break; } if (sofa) break; } }
          if (sofa) {
            const gap = (tv.wall === 'N' || tv.wall === 'S') ? H : W; const fv = front(sofa);
            if (gap >= tv.d + sofa.d + 5.5) freeItem(g, placed, zs, sofa.k === 'sofaL' ? 'coffee_round' : 'coffee', sofa.cx + fv[0] * (sofa.d / 2 + 2.6), sofa.cy + fv[1] * (sofa.d / 2 + 2.6), sofa.rot, { noClear: true });
            if (g.area >= 200 && sofa.k !== 'sofaL') perp(tv.wall).forEach(ps => tryWall(g, placed, zs, 'sofa1', [ps], withDining ? 'start' : 'center'));
            const ct = placed.find(p => p.k === 'coffee' || p.k === 'coffee_round'); if (ct) placed.unshift({ k: 'rug', w: 7.5, d: 5.5, rot: ct.rot, cx: ct.cx, cy: ct.cy });
          }
        }
        if (!placed.some(p => /^sofa|floorseat/.test(p.k))) { const zs2 = zones(g, true); for (const k of ['sofa3', 'sofa2', 'sofa1']) if (tryWall(g, placed, zs2, k, rankWalls(g, true), 'center')) break; if (!placed.some(p => p.k === 'tvunit' || p.k === 'tvwall')) tryWall(g, placed, zs2, 'tvunit', rankWalls(g, true), 'center'); }
        if (withDining) diningSet(g, placed, zs, true);
        if (t === 'flounge' && g.area >= 160) tryWall(g, placed, zs, 'bookshelf', ranked, 'end');
        decorate(g, placed, zs, { ac: true, art: [placed.find(p => /^sofa/.test(p.k)) ? placed.find(p => /^sofa/.test(p.k)).k : 'sofa3'], plant: true, lamp: g.area >= 180 });
      }
    } else if (t === 'dining') {
      diningSet(g, placed, zs, false);
      tryWall(g, placed, zs, g.area >= 150 ? 'crockery' : 'sideboard', ranked, 'center') || tryWall(g, placed, zs, 'sideboard', ranked, 'center') || tryWall(g, placed, zs, 'console', ranked, 'center');
      decorate(g, placed, zs, { ac: g.area >= 120, art: ['sideboard', 'console'], plant: true });
    } else if (t === 'kitchen') {
      const sides = rankWalls(g, true); let runs = 0; let first = null;
      // fridge at the end of the main run, so the aisle opposite stays clear
      const fr = tryWall(g, placed, zs, 'fridge', [sides[0]], 'end', null, { strict: true });
      for (const side of sides) {
        if (runs >= 2) break;
        if (first && side === opp[first] && ((side === 'N' || side === 'S') ? H : W) - 2 * F.counter.d < 3.5) continue;
        const len = wallLen(g, side) - (fr && fr.wall === side ? fr.w + 0.1 : 0);
        for (let L = Math.floor(Math.min(len, 14) * 2) / 2; L >= 4; L -= 0.5) { if (tryWall(g, placed, zs, 'counter', [side], 'start', L)) { runs++; first = first || side; break; } }
      }
      const cs = placed.filter(p => p.k === 'counter'); if (cs[0]) { cs[0].sink = true; (cs[1] || cs[0]).hob = true; }
      if (!fr) tryWall(g, placed, zs, 'fridge', sides, 'end', null, { strict: true }) || tryWall(g, placed, zs, 'fridge', sides, 'end') || tryWall(g, placed, zs, 'fridge', sides, 'end', null, { ignoreZones: true });
      if (g.area >= 100) tryWall(g, placed, zs, 'ovencol', sides, 'end', null, { strict: true });
      if (g.area >= 80) tryWall(g, placed, zs, 'dispenser', sides, 'end', null, { strict: true });
      if (g.area >= 170 && Math.min(W, H) >= 11) freeItem(g, placed, zs, 'island', W / 2, H / 2, W >= H ? 0 : 90);
      else if (g.area >= 115 && Math.min(W, H) >= 9) { const tb = freeItem(g, placed, zs, 'round4', W / 2, H / 2, 0); if (tb) [[0, -2.5, 180], [0, 2.5, 0], [-2.5, 0, 270], [2.5, 0, 90]].forEach(([dx, dy, r]) => freeItem(g, placed, zs, 'chair', tb.cx + dx, tb.cy + dy, (r + 180) % 360, { noClear: true })); }
    } else if (t === 'bath' || t === 'sbath' || t === 'powder') {
      const s = rankWalls(g, false);
      const wck = t === 'powder' || t === 'bath' && g.area < 45 ? 'wc_wall' : 'wc';
      tryWall(g, placed, zs, wck, s, 'far') || tryWall(g, placed, zs, 'wc_wall', s, 'end', null, { ignoreZones: true, relaxAll: true }) || tryWall(g, placed, zs, 'wc_wall', s, 'end', null, { ignoreZones: true, noClear: true });
      const bk = t === 'bath' && Math.max(W, H) >= 9 && g.area >= 55 ? 'basin2' : Math.min(W, H) < 4.5 || t === 'powder' ? 'basin_wall' : 'basin';
      tryWall(g, placed, zs, bk, s, 'start') || tryWall(g, placed, zs, 'basin', s, 'start') || tryWall(g, placed, zs, 'basin_wall', s, 'start') || tryWall(g, placed, zs, 'basin_wall', s, 'start', null, { ignoreZones: true, noClear: true });
      if (t !== 'powder' && g.area >= 30) {
        const roomy = Math.min(W, H) >= 6.5 && g.area >= 50;
        if (!(g.area >= 70 && tryWall(g, placed, zs, 'bathtub', s, 'far'))) { if (!(roomy && tryWall(g, placed, zs, 'shower', s, 'far'))) tryWall(g, placed, zs, 'showerzone', s, 'far', null, { ignoreZones: true }) || tryWall(g, placed, zs, 'showerzone', s, 'far', null, { ignoreZones: true, noClear: true }); }
      }
      if (t !== 'powder') tryWall(g, placed, zs, 'geyser', s, 'end', null, { ignoreZones: true });
      tryWall(g, placed, zs, 'towel', s, 'center', null, { ignoreZones: true });
    } else if (t === 'dress') {
      const long = W >= H ? ['N', 'S'] : ['W', 'E'];
      long.forEach(side => { for (let L = Math.floor((wallLen(g, side) - 0.25) * 2) / 2; L >= 3; L -= 0.5) if (tryWall(g, placed, zs, Math.min(W, H) < 6 ? 'wardrobe_slide' : 'wardrobe', [side], 'center', L)) break; });
      if (!placed.length) wardrobe(rankWalls(g, true), 6, true);
      if (!placed.length) { const zs2 = zones(g, true); for (const side of rankWalls(g, true)) { const L = Math.floor((wallLen(g, side) - 0.25) * 2) / 2; if (L >= 2.5 && tryWall(g, placed, zs2, 'wardrobe_slide', [side], 'center', L, { noClear: true })) break; } }
      if (g.area >= 50) tryWall(g, placed, zs, 'mirror_full', ranked, 'center', null, { ignoreZones: true });
    } else if (t === 'study') {
      const d = tryWall(g, placed, zs, 'desk', solidWalls(g).concat(ranked), 'center');
      if (d) { const fv = front(d); freeItem(g, placed, zs, 'officechair', d.cx + fv[0] * (d.d / 2 + 1.1), d.cy + fv[1] * (d.d / 2 + 1.1), (d.rot + 180) % 360, { noClear: true }); }
      tryWall(g, placed, zs, 'bookshelf', ranked, 'end'); tryWall(g, placed, zs, 'bookshelf', ranked, 'start'); tryWall(g, placed, zs, 'sofa2', ranked, 'center') || tryWall(g, placed, zs, 'armchair', ranked, 'end');
      decorate(g, placed, zs, { ac: true, lamp: true });
    } else if (t === 'laundry') {
      tryWall(g, placed, zs, 'washer', ranked, 'start'); tryWall(g, placed, zs, 'dryer', ranked, 'start'); tryWall(g, placed, zs, 'utsink', ranked, 'end'); tryWall(g, placed, zs, 'shelf', ranked, 'end', Math.min(4, Math.max(W, H) - 1));
    } else if (t === 'store') {
      ranked.slice(0, 2).forEach(side => { const L = Math.min(8, wallLen(g, side) - 0.5); if (L >= 2) tryWall(g, placed, zs, 'shelf', [side], 'center', Math.floor(L * 2) / 2) || tryWall(g, placed, zs, 'shelf', [side], 'center', Math.floor(L * 2) / 2, { noClear: true }); });
    } else if (t === 'foyer') {
      if (Math.min(W, H) >= 5) tryWall(g, placed, zs, 'console', ranked, 'center') || tryWall(g, placed, zs, 'shoe', ranked, 'center');
      if (Math.min(W, H) >= 5) tryWall(g, placed, zs, 'shoe', ranked, 'end');
      const c = placed.find(p => p.k === 'console'); if (c) tryWall(g, placed, zs, 'mirror', [c.wall], c.wall === 'N' || c.wall === 'S' ? c.cx : c.cy, null, { ignoreZones: true });
      tryWall(g, placed, zs, 'plant', ranked, 'end');
    } else if (t === 'servant') {
      // handled with bedrooms
    } else if (t === 'porch') {
      const vertical = H >= W; const car = { k: 'car', w: F.car.w, d: F.car.d, rot: vertical ? 0 : 90, cx: W / 2, cy: H / 2 };
      if ((vertical ? W >= F.car.w + 0.8 && H >= F.car.d + 0.2 : H >= F.car.w + 0.8 && W >= F.car.d + 0.2)) placed.push(car);
      if (Math.min(W, H) >= 10) ['N', 'S'].forEach(s => tryWall(g, placed, zs, 'planter', [s], 'end', null, { ignoreZones: true }));
    } else if (t === 'terrace' || t === 'court') {
      if (g.area >= 160 && Math.min(W, H) >= 9) tryWall(g, placed, zs, 'swing', ranked, 'center');
      if (Math.min(W, H) >= 7) { const tb = freeItem(g, placed, zs, 'otable', W / 2, H / 2, 0) || freeItem(g, placed, zs, 'otable', W * 0.3, H * 0.6, 0); if (tb) { [[-2.6, 0, 90], [2.6, 0, 270]].forEach(([dx, dy, r]) => freeItem(g, placed, zs, 'ochair', tb.cx + dx, tb.cy + dy, r, { noClear: true })); } }
      if (g.area >= 200) tryWall(g, placed, zs, 'lounger', ranked, 'end');
      if (t === 'terrace' && g.area >= 220) tryWall(g, placed, zs, 'bbq', ranked, 'start');
      ['N', 'E', 'S', 'W'].forEach(s => tryWall(g, placed, zs, 'planter', [s], 'start', null, { ignoreZones: true, noClear: true }));
    }
    placed.filter(p => p.k === 'rug').forEach(r => { const fp = footprint(r); const fw = Math.min(fp.fw, W - 1), fd = Math.min(fp.fd, H - 1); if (r.rot % 180 === 0) { r.w = fw; r.d = fd; } else { r.w = fd; r.d = fw; } r.cx = Math.max(fw / 2 + 0.3, Math.min(W - fw / 2 - 0.3, r.cx)); r.cy = Math.max(fd / 2 + 0.3, Math.min(H - fd / 2 - 0.3, r.cy)); });
    if (!ctx.raw) resolve(g, placed, zs);
    return placed.map((p, i) => Object.assign({ id: 'f' + i }, p));
  }
  function diningSet(g, placed, zs, half) {
    const W = g.W, H = g.H; const L = Math.max(W, H), S = Math.min(W, H); const horiz = W >= H;
    const k = S >= 10.5 && L >= 15 ? 'dining8' : S >= 9 && L >= 11.5 ? 'dining6' : S >= 8.5 && L < 10 ? 'round4' : 'dining4'; const s = F[k];
    let cx = W / 2, cy = H / 2;
    if (half) { const zone = L * 0.25; if (horiz) cx = W - Math.max(zone, s.w / 2 + 2.8); else cy = H - Math.max(zone, s.w / 2 + 2.8); }
    const rot = horiz ? 0 : 90; let tb = null;
    const offs = [0]; for (let o = 0.5; o <= L / 2; o += 0.5) offs.push(o, -o);
    for (const kk of k === 'dining4' ? ['dining4', 'round4'] : [k, 'dining6', 'dining4', 'round4']) {
      for (const relax of [false, true]) { for (const o of offs) { tb = freeItem(g, placed, zs, kk, horiz ? cx + o : cx, horiz ? cy : cy + o, F[kk].round ? 0 : rot, { relax }); if (tb) break; } if (tb) break; }
      if (tb) break;
    }
    if (!tb) { const zs2 = zones(g, true); for (const o of offs) { tb = freeItem(g, placed, zs2, 'dining4', horiz ? cx + o : cx, horiz ? cy : cy + o, rot, { noClear: true }); if (tb) break; } }
    if (!tb) return;
    const ts = F[tb.k];
    if (ts.round) { [[0, -1, 0], [0, 1, 180], [-1, 0, 90], [1, 0, 270]].forEach(([dx, dy, r]) => freeItem(g, placed, zs, 'chair', tb.cx + dx * (ts.w / 2 + 0.55), tb.cy + dy * (ts.w / 2 + 0.55), (r + 180) % 360, { noClear: true })); return; }
    const n = ts.seats, perSide = Math.max(1, Math.floor((n - 2) / 2)), tw = ts.w, td = ts.d; const rr = tb.rot;
    for (let i = 0; i < perSide; i++) {
      const off = -tw / 2 + tw * (i + 0.5) / perSide;
      [[1, 0], [-1, 180]].forEach(([sg, r]) => { const lx = off, ly = sg * (td / 2 + 0.55); const [x, y] = rr ? [-ly, lx] : [lx, ly]; freeItem(g, placed, zs, 'chair', tb.cx + x, tb.cy + y, (r + rr + 180) % 360, { noClear: true }); });
    }
    if (n >= 6) [[1, 270], [-1, 90]].forEach(([sg, r]) => { const lx = sg * (tw / 2 + 0.55); const [x, y] = rr ? [0, lx] : [lx, 0]; freeItem(g, placed, zs, 'chair', tb.cx + x, tb.cy + y, (r + rr) % 360, { noClear: true }); });
  }
  // add one item to an existing layout
  function place(g, items, k) {
    const s = F[k]; if (!s) return null; const placed = items.slice(); const zs = zones(g); const w = s.var ? Math.min(s.w, Math.max(s.var[0], Math.max(g.W, g.H) - 1)) : s.w;
    const wallish = s.mount === 'wall' || s.tall || ['bed', 'kitchen'].includes(s.cat) || ['sofa3', 'sofa2', 'sofaL', 'tvunit', 'tvwall', 'console', 'sideboard', 'dresser', 'chest', 'desk', 'kidsdesk', 'wc', 'wc_wall', 'basin', 'basin2', 'nightstand', 'shoe', 'washer', 'dryer', 'utsink', 'toybox', 'floorseat', 'prayer'].includes(k);
    let it = null;
    if (wallish) it = tryWall(g, placed, zs, k, rankWalls(g, true), 'center', w, s.mount === 'wall' ? { ignoreZones: true } : null) || tryWall(g, placed, zones(g, true), k, rankWalls(g, true), 'center', w, { noClear: true });
    if (!it) { for (let y = s.d / 2 + 0.5; y <= g.H - s.d / 2 && !it; y += 0.5) for (let x = w / 2 + 0.5; x <= g.W - w / 2 && !it; x += 0.5) it = freeItem(g, placed, zs, k, x, y, 0, { w }); }
    if (!it) it = { k, w, d: s.d, rot: 0, cx: g.W / 2, cy: g.H / 2, clash: true };
    it.id = 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    return it;
  }
  // replace an item with a variant from its swap group, keeping its wall and centre where possible
  function swap(g, items, it, k2) {
    const s2 = F[k2]; const rest = items.filter(x => x !== it); const zs = zones(g);
    const n = Object.assign({}, it, { k: k2, w: s2.var ? Math.min(Math.max(it.w, s2.var[0]), s2.var[1]) : s2.w, d: s2.d, y0: s2.y0 || undefined, sink: undefined, hob: undefined });
    if (it.wall) { const fresh = atWall(g, k2, it.wall, it.wall === 'N' || it.wall === 'S' ? it.cx : it.cy, n.w); n.cx = fresh.cx; n.cy = fresh.cy; }
    const fp = footprint(n); n.cx = Math.max(fp.fw / 2, Math.min(g.W - fp.fw / 2, n.cx)); n.cy = Math.max(fp.fd / 2, Math.min(g.H - fp.fd / 2, n.cy));
    n.tight = !fits(g, n, rest, zs);
    return n;
  }

  function aheadFree(g, solid, it, dir, from, span0, span1) { // distance from a line to the nearest obstacle within a span
    let best = dir[0] ? (dir[0] > 0 ? g.W - from : from) : (dir[1] > 0 ? g.H - from : from);
    solid.forEach(p => { if (p === it || spec(it).ok.includes(p.k)) return; const r = rectOf(p);
      if (dir[1]) { if (r.x + r.w <= span0 + 0.05 || r.x >= span1 - 0.05) return; const d = dir[1] > 0 ? r.y - from : from - (r.y + r.h); if (d >= -0.05) best = Math.min(best, Math.max(0, d)); }
      else { if (r.y + r.h <= span0 + 0.05 || r.y >= span1 - 0.05) return; const d = dir[0] > 0 ? r.x - from : from - (r.x + r.w); if (d >= -0.05) best = Math.min(best, Math.max(0, d)); } });
    return best;
  }
  function shortFront(g, items) { // pieces whose working space in front is under 75 % of what they need
    const solid = items.filter(floorBlocks);
    return solid.filter(it => { const s = spec(it); if (!s.clr || s.ring) return false; const r = rectOf(it); const fv = front(it);
      const from = fv[1] > 0 ? r.y + r.h : fv[1] < 0 ? r.y : fv[0] > 0 ? r.x + r.w : r.x;
      return aheadFree(g, solid, it, fv, from, fv[1] ? r.x : r.y, fv[1] ? r.x + r.w : r.y + r.h) < s.clr * 0.75 - 0.05; });
  }
  // walkways: grid flood from the doors with a "person" of a given radius (summed-area table, so it is cheap enough to run per candidate)
  function reachInfo(g, items) {
    const solid = items.filter(floorBlocks); const C = 0.25, nx = Math.max(1, Math.round(g.W / C)), ny = Math.max(1, Math.round(g.H / C));
    const sat = new Int32Array((nx + 1) * (ny + 1)); const blk = new Uint8Array(nx * ny);
    solid.forEach(p => { const r = rectOf(p); for (let j = Math.max(0, Math.floor(r.y / C + 0.02)); j < Math.min(ny, Math.ceil((r.y + r.h) / C - 0.02)); j++) for (let i = Math.max(0, Math.floor(r.x / C + 0.02)); i < Math.min(nx, Math.ceil((r.x + r.w) / C - 0.02)); i++) blk[j * nx + i] = 1; });
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) sat[(j + 1) * (nx + 1) + i + 1] = blk[j * nx + i] + sat[j * (nx + 1) + i + 1] + sat[(j + 1) * (nx + 1) + i] - sat[j * (nx + 1) + i];
    const walk = rad => { const R = Math.round(rad / C), ok = new Uint8Array(nx * ny);
      for (let j = R; j < ny - R; j++) for (let i = R; i < nx - R; i++) { const x0 = i - R, y0 = j - R, x1 = i + R + 1, y1 = j + R + 1; ok[j * nx + i] = sat[y1 * (nx + 1) + x1] - sat[y0 * (nx + 1) + x1] - sat[y1 * (nx + 1) + x0] + sat[y0 * (nx + 1) + x0] === 0 ? 1 : 0; }
      return ok; };
    const doorCells = (o, ok, R) => { const cells = []; const d = (R + 1) * C; for (let t = o.a + 0.3; t <= o.b - 0.3; t += C) { let x, y; if (o.side === 'N') { x = t; y = d; } else if (o.side === 'S') { x = t; y = g.H - d; } else if (o.side === 'W') { x = d; y = t; } else { x = g.W - d; y = t; } const i = Math.floor(x / C), j = Math.floor(y / C); if (i >= 0 && j >= 0 && i < nx && j < ny && ok[j * nx + i]) cells.push(j * nx + i); } return cells; };
    const flood = (ok, seeds) => { const seen = new Uint8Array(nx * ny); const q = seeds.slice(); seeds.forEach(c => seen[c] = 1); while (q.length) { const c = q.pop(), i = c % nx, j = (c - i) / nx; if (i + 1 < nx && !seen[c + 1] && ok[c + 1]) { seen[c + 1] = 1; q.push(c + 1); } if (i > 0 && !seen[c - 1] && ok[c - 1]) { seen[c - 1] = 1; q.push(c - 1); } if (j + 1 < ny && !seen[c + nx] && ok[c + nx]) { seen[c + nx] = 1; q.push(c + nx); } if (j > 0 && !seen[c - nx] && ok[c - nx]) { seen[c - nx] = 1; q.push(c - nx); } } return seen; };
    const doors = g.ops.filter(o => o.kind !== 'window');
    const reachAll = rad => { const ok = walk(rad); const R = Math.round(rad / C); const seeds = []; const perDoor = doors.map(o => { const c = doorCells(o, ok, R); seeds.push(...c); return c; }); return { seen: seeds.length ? flood(ok, seeds) : null, perDoor }; };
    const need = solid.filter(it => spec(it).clr > 0 || spec(it).ring);
    const reaches = (res, it) => { if (!res.seen) return false; const zs = clearZones(it, 0.5); const r = rectOf(it); const zz = zs.length ? zs : [{ x: r.x - 0.6, y: r.y - 0.6, w: r.w + 1.2, h: r.h + 1.2 }];
      return zz.some(z => { for (let j = Math.max(0, Math.floor(z.y / C)); j < Math.min(ny, Math.ceil((z.y + z.h) / C)); j++) for (let i = Math.max(0, Math.floor(z.x / C)); i < Math.min(nx, Math.ceil((z.x + z.w) / C)); i++) if (res.seen[j * nx + i]) return true; return false; }); };
    if (!doors.length) return { doors: 0, blocked: [], tight: [], need };
    const mid = reachAll(1.0), narrow = reachAll(0.6); const blocked = need.filter(it => !reaches(narrow, it)); const tight = need.filter(it => reaches(narrow, it) && !reaches(mid, it));
    let allWide = false; if (!blocked.length && !tight.length) { const wide = reachAll(1.25); allWide = need.every(it => reaches(wide, it)); }
    const linked = mid.seen ? mid.perDoor.every(c => c.length && c.some(x => mid.seen[x])) : null;
    return { doors: doors.length, blocked, tight, need, allWide, linked };
  }
  // space resolution: re-seat pieces that the walkway check says can't be reached (or only through a squeeze)
  const FIXED = /^bed_(?!single)|^chair$|^car$|^counter$|^dining|^round4|^island|^rug|^prayer|^showerzone|^officechair|^barstool/;
  function resolve(g, placed, zs) {
    const score = list => { const r = reachInfo(g, list); const sf = shortFront(g, list); r.blocked = r.blocked.concat(sf.filter(x => !r.blocked.includes(x))); return { b: r.blocked.length, t: r.tight.length, r }; };
    for (let pass = 0; pass < 2; pass++) {
      let cur = score(placed); if (!cur.r.doors && !cur.b) return placed;
      const targets = (pass === 0 ? cur.r.blocked : cur.r.tight).filter(it => !FIXED.test(it.k) && !isWallItem(it));
      for (const it of targets) {
        cur = score(placed); const idx = placed.indexOf(it); if (idx < 0) continue; if (!(pass === 0 ? cur.r.blocked : cur.r.tight).includes(it)) continue;
        const rest = placed.filter(p => p !== it && !(isWallItem(p) && p.wall === it.wall && Math.abs((p.wall === 'N' || p.wall === 'S' ? p.cx - it.cx : p.cy - it.cy)) < it.w / 2 && p.k === 'art'));
        const s = F[it.k]; const widths = [it.w]; if (s.var) for (let w = it.w - 0.5; w >= s.var[0]; w -= 0.5) widths.push(w);
        const keys = [it.k].concat(swapList(it.k).map(x => x.k || x).filter(k => k !== it.k && F[k] && F[k].w * F[k].d <= s.w * s.d + 0.01).sort((a, b) => F[a].w * F[a].d - F[b].w * F[b].d));
        let best = null;
        outer: for (const k of keys) for (const w of (k === it.k ? widths : [F[k].w])) for (const relax of [false, true]) for (const side of ['N', 'E', 'S', 'W']) {
          const len = wallLen(g, side); if (len < w) continue;
          for (let t = w / 2; t <= len - w / 2 + 1e-6; t += 0.5) { const c = atWall(g, k, side, t, w); if (F[k].y0) c.y0 = F[k].y0; if (!fits(g, c, rest, zs, { relax })) continue;
            const sc = score(rest.concat([c])); if (sc.b < cur.b || (sc.b === cur.b && sc.t < cur.t)) { if (relax) c.tight = true; best = { c, sc }; if (sc.b === 0 && sc.t === 0) break outer; if (!best || sc.b === 0) break outer; } }
        }
        if (best) { const keep = Object.assign({}, best.c); placed.splice(0, placed.length, ...rest, keep); }
        else if (pass === 0 && !/wardrobe|^wc|^basin|^fridge|^tv|^sofa/.test(it.k)) placed.splice(idx, 1); // cannot be reached anywhere: leave it out
      }
    }
    return placed;
  }

  // ---------- space checks: clearances, walkways, reachability ----------
  function spaceCheck(g, items) {
    const out = []; const add = (s, text) => out.push({ s, text });
    if (g.open || !items.length) { if (!items.length) add('ok', 'Kept clear for circulation.'); return out; }
    const solid = items.filter(floorBlocks);
    const freeAhead = (it, dir, from, span0, span1) => aheadFree(g, solid, it, dir, from, span0, span1);
    solid.forEach(it => {
      const s = spec(it); if (!s.clr && !s.ring) return; const r = rectOf(it); const fv = front(it);
      if (s.ring) { const ds = [[0, -1, r.y, r.x, r.x + r.w], [0, 1, r.y + r.h, r.x, r.x + r.w], [-1, 0, r.x, r.y, r.y + r.h], [1, 0, r.x + r.w, r.y, r.y + r.h]].map(([a, b, f, s0, s1]) => freeAhead(it, [a, b], f, s0, s1));
        const m = Math.min(...ds); add(m >= s.ring - 0.05 ? 'ok' : m >= s.ring * 0.8 ? 'warn' : 'bad', `${s.n}: ${ft(m)} to pull chairs out (needs ${ft(s.ring)})`); return; }
      const from = fv[1] > 0 ? r.y + r.h : fv[1] < 0 ? r.y : fv[0] > 0 ? r.x + r.w : r.x;
      const d = freeAhead(it, fv, from, fv[1] ? r.x : r.y, fv[1] ? r.x + r.w : r.y + r.h);
      const label = /^bed_/.test(it.k) ? 'at the foot of the bed' : it.k === 'counter' ? 'kitchen working aisle' : /wardrobe|chest|dresser|crockery|sideboard/.test(it.k) ? 'to open doors and drawers' : /wc|basin|shower|bathtub/.test(it.k) ? 'in front' : 'in front';
      add(d >= s.clr - 0.05 ? 'ok' : d >= s.clr * 0.75 ? 'warn' : 'bad', `${s.n}: ${ft(d)} ${label} (needs ${ft(s.clr)})`);
      if (s.side) { const sides = fv[1] ? [[-1, 0, r.x], [1, 0, r.x + r.w]] : [[0, -1, r.y], [0, 1, r.y + r.h]]; const ds = sides.map(([a, b, f]) => freeAhead(it, [a, b], f, fv[1] ? r.y + r.h * 0.3 : r.x + r.w * 0.3, fv[1] ? r.y + r.h : r.x + r.w)).map(v => v);
        const m = /^bed_/.test(it.k) ? Math.max(...ds) : Math.min(...ds); const mn = /^bed_/.test(it.k) ? Math.min(...ds) : m;
        if (/^bed_/.test(it.k)) add(mn >= s.side - 0.05 ? 'ok' : m >= s.side ? 'warn' : 'bad', `${s.n}: walkways ${ft(ds[0])} and ${ft(ds[1])} beside the bed (needs ${ft(s.side)} for bedside tables and making the bed)`);
        else add(mn >= s.side - 0.05 ? 'ok' : 'warn', `${s.n}: ${ft(mn)} from centre-line to the side (needs ${ft(s.side + s.w / 2)})`); }
    });
    const info = reachInfo(g, items);
    if (info.doors) {
      const { blocked, tight } = info;
      if (blocked.length) add(g.t === 'dress' && g.area < 25 ? 'warn' : 'bad', `Blocked: ${blocked.map(it => spec(it).n).join(', ')} can’t be reached from the door.`);
      if (tight.length) add('warn', `Tight walkway (under 2'-0") to ${tight.map(it => spec(it).n).join(', ')}.`);
      if (!blocked.length && !tight.length) add('ok', info.allWide ? 'Walkways of 2\'-6" or more reach every piece from the door.' : 'Walkways of 2\'-0" or more reach every piece from the door.');
      if (info.doors > 1 && info.linked != null) add(info.linked ? 'ok' : 'warn', info.linked ? 'Clear path between all doors.' : 'The path between doors is narrower than 2\'-0".');
    }
    // kitchen work triangle
    if (g.t === 'kitchen') { const sk = items.find(i => i.sink), hb = items.find(i => i.hob), fr = items.find(i => /^fridge/.test(i.k));
      const pos = (it, which) => { if (!it) return null; if (it.k !== 'counter') return [it.cx, it.cy]; const fv = front(it); const al = it.rot % 180 === 0 ? [1, 0] : [0, 1]; const off = which === 'sink' ? -it.w / 2 + 1.3 : it.w / 2 - 1.4; return [it.cx + al[0] * off, it.cy + al[1] * off]; };
      const a = pos(sk, 'sink'), b = pos(hb, 'hob'), c = pos(fr); if (a && b && c) { const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]); const tot = dd(a, b) + dd(b, c) + dd(c, a); add(tot >= 10 && tot <= 26 ? 'ok' : 'warn', `Work triangle sink–hob–fridge ${ft(tot)} (good: 12'–26')`); } }
    if (/bath|powder/.test(g.t)) { const w = items.find(i => /^wc/.test(i.k)); if (w) { const r = rectOf(w); const fv = front(w); const c = fv[1] ? r.x + r.w / 2 : r.y + r.h / 2; const lo = fv[1] ? r.x : r.y; void lo; const left = fv[1] ? c : c, right = fv[1] ? g.W - c : g.H - c; const m = Math.min(left, right); add(m >= 1.25 ? 'ok' : 'warn', `WC centre ${ft(m)} from the nearest side wall (min 1'-3")`); } }
    return out;
  }

  // ---------- budgets & schedules ----------
  function itemPrice(it, theme) {
    const s = F[it.k]; if (!s || s.noBudget) return [0, 0]; const m = (THEMES[theme] || THEMES.modern).mult; const am = s.appliance ? 1 : m;
    const base = s.perFt ? [s.perFt[0] * it.w, s.perFt[1] * it.w] : s.price;
    let lo = base[0] * am, hi = base[1] * am;
    if (it.sink) { lo += 45000; hi += 110000; } if (it.hob) { lo += 70000; hi += 170000; }
    return [lo, hi];
  }
  function itemSpec(it, theme) { const s = F[it.k]; if (!s) return ''; const T = THEMES[theme] || THEMES.modern; const parts = (s.spec || []).map(k => T.mat[k]).filter(Boolean); return [s.size].concat(parts).filter(Boolean).join('; ') + (it.sink ? '; stainless-steel sink with pull-out mixer' : '') + (it.hob ? '; 4-burner gas hob, 90 cm chimney hood' : ''); }
  function roomBudget(g, items, fin, theme) {
    const furn = items.reduce((a, it) => { const p = itemPrice(it, theme); return [a[0] + p[0], a[1] + p[1]]; }, [0, 0]);
    const fl = FLOORS[fin.floor] || FLOORS.porcelain; const floor = [g.area * 1.08 * fl.rate[0], g.area * 1.08 * fl.rate[1]];
    const wallArea = g.open ? 0 : 2 * (g.W + g.H) * CEIL - g.ops.reduce((a, o) => a + (o.b - o.a) * (o.kind === 'window' ? 4 : 7), 0);
    const paint = [Math.max(0, wallArea) * PAINT[0], Math.max(0, wallArea) * PAINT[1]];
    return { furn, floor, paint, total: [furn[0] + floor[0] + paint[0], furn[1] + floor[1] + paint[1]] };
  }
  function schedule(items, theme) {
    const rows = {}; items.forEach(it => { const s = F[it.k]; if (!s) return; const key = it.k + (s.var ? ':' + it.w : '') + (it.sink ? ':s' : '') + (it.hob ? ':h' : '');
      if (!rows[key]) rows[key] = { k: it.k, name: s.n + (it.sink ? ' with sink' : '') + (it.hob ? (it.sink ? ' & hob' : ' with hob') : ''), size: `${ft(it.w)} × ${ft(it.d)} × ${ft(s.h + (s.hb ? s.hb - s.h : 0))} H`, spec: itemSpec(it, theme), qty: 0, lo: 0, hi: 0, appliance: !!s.appliance };
      const p = itemPrice(it, theme); rows[key].qty++; rows[key].lo += p[0]; rows[key].hi += p[1]; });
    return Object.values(rows);
  }

  // ---------- 2D furniture symbols (SVG, room-local feet) ----------
  const COL = { bed: '#E9E3F7', wood: '#EADBC6', soft: '#DCE6F1', rug: '#F4EEE4', kitchen: '#F6EBD7', white: '#FFFFFF', glass: '#DFF2F7', metal: '#E3E6EA', plant: '#DCEFD6', car: '#E8ECF1', art: '#FFF6E5' };
  function symbol(it, theme) {
    const s = F[it.k]; if (!s) return ''; const w = it.w, d = it.d; const T = THEMES[theme] || THEMES.modern;
    const ln = 'stroke="#41556B" stroke-width="0.07" fill="none"';
    const wallItem = s.mount === 'wall';
    const base = s.round ? `<ellipse cx="0" cy="0" rx="${f2(w / 2)}" ry="${f2(d / 2)}" fill="${COL[s.cat] || '#fff'}" stroke="#41556B" stroke-width="0.09"/>`
      : `<rect x="${f2(-w / 2)}" y="${f2(-d / 2)}" width="${f2(w)}" height="${f2(d)}" rx="${s.cat === 'soft' ? 0.35 : 0.12}" fill="${COL[s.cat] || '#fff'}" stroke="#41556B" stroke-width="0.09"${wallItem ? ' stroke-dasharray="0.25 0.15"' : ''}/>`;
    let x = '';
    if (it.k === 'rug' || it.k === 'prayer') return `<g transform="translate(${f2(it.cx)} ${f2(it.cy)}) rotate(${it.rot})"><rect x="${f2(-w / 2)}" y="${f2(-d / 2)}" width="${f2(w)}" height="${f2(d)}" rx="0.2" fill="${it.k === 'prayer' ? '#E9DCC0' : T.light}" stroke="${T.accent}" stroke-width="0.08" stroke-dasharray="0.3 0.2" opacity="0.9"/>${it.k === 'prayer' ? `<path d="M${f2(-0.7)} ${f2(-d / 2 + 0.9)}Q0 ${f2(-d / 2 + 0.2)} ${f2(0.7)} ${f2(-d / 2 + 0.9)}" ${ln}/>` : ''}</g>`;
    if (s.cat === 'bed') {
      if (it.k === 'bed_bunk') x = `<path d="M${f2(-w / 2)} ${f2(-d / 2)}L${f2(w / 2)} ${f2(d / 2)}M${f2(w / 2)} ${f2(-d / 2)}L${f2(-w / 2)} ${f2(d / 2)}" ${ln} opacity=".4"/>`;
      else { const single = /single|daybed/.test(it.k); const pw = single ? w - 0.8 : (w - 1) / 2; x = `<rect x="${f2(-w / 2)}" y="${f2(-d / 2)}" width="${f2(w)}" height="0.45" fill="${T.wood}"/>` + (single ? `<rect x="${f2(-pw / 2)}" y="${f2(-d / 2 + 0.65)}" width="${f2(pw)}" height="1" rx="0.3" ${ln}/>` : `<rect x="${f2(-w / 2 + 0.35)}" y="${f2(-d / 2 + 0.65)}" width="${f2(pw)}" height="1" rx="0.3" ${ln}/><rect x="${f2(0.15)}" y="${f2(-d / 2 + 0.65)}" width="${f2(pw)}" height="1" rx="0.3" ${ln}/>`) + `<path d="M${f2(-w / 2)} ${f2(-d / 2 + 2.3)}H${f2(w / 2)}" ${ln}/><path d="M${f2(-w / 2)} ${f2(-d / 2 + 2.3)}L${f2(w / 2)} ${f2(d / 2)}" ${ln} opacity=".3"/>`; }
    } else if (it.k === 'sofaL') { const a = s.lshape; return `<g class="fu" data-fid="${esc(it.id || '')}" transform="translate(${f2(it.cx)} ${f2(it.cy)}) rotate(${it.rot})"><path d="M${f2(-w / 2)} ${f2(-d / 2)}H${f2(w / 2)}V${f2(d / 2)}H${f2(w / 2 - a)}V${f2(-d / 2 + a)}H${f2(-w / 2)}Z" fill="${COL.soft}" stroke="#41556B" stroke-width="0.09"/><path d="M${f2(-w / 2)} ${f2(-d / 2 + 0.8)}H${f2(w / 2 - 0.8)}V${f2(d / 2)}" ${ln} opacity=".6"/></g>`; }
    else if (/^sofa|armchair|recliner|floorseat/.test(it.k)) x = `<rect x="${f2(-w / 2)}" y="${f2(-d / 2)}" width="${f2(w)}" height="0.8" rx="0.3" fill="${T.soft}" opacity=".55"/>` + (it.k === 'floorseat' ? '' : `<rect x="${f2(-w / 2)}" y="${f2(-d / 2)}" width="0.55" height="${f2(d)}" rx="0.25" fill="${T.soft}" opacity=".55"/><rect x="${f2(w / 2 - 0.55)}" y="${f2(-d / 2)}" width="0.55" height="${f2(d)}" rx="0.25" fill="${T.soft}" opacity=".55"/>`);
    else if (s.seats && !s.round) x = `<rect x="${f2(-w / 2 + 0.25)}" y="${f2(-d / 2 + 0.25)}" width="${f2(w - 0.5)}" height="${f2(d - 0.5)}" ${ln} opacity=".5"/>`;
    else if (/chair|stool/.test(it.k)) x = `<rect x="${f2(-w / 2)}" y="${f2(-d / 2)}" width="${f2(w)}" height="0.35" fill="#41556B" opacity=".45"/>`;
    else if (/wardrobe|shelf|bookshelf|crockery|shoe/.test(it.k)) x = `<path d="M${f2(-w / 2)} ${f2(d / 2)}L${f2(w / 2)} ${f2(-d / 2)}" ${ln} opacity=".5"/>` + Array.from({ length: Math.max(1, Math.round(w / 2)) - 1 }, (_, i) => `<path d="M${f2(-w / 2 + (i + 1) * w / Math.max(1, Math.round(w / 2)))} ${f2(-d / 2)}V${f2(d / 2)}" ${ln}/>`).join('');
    else if (it.k === 'counter') x = `<path d="M${f2(-w / 2)} ${f2(-d / 2 + 0.3)}H${f2(w / 2)}" ${ln}/>` + (it.sink ? `<rect x="${f2(-w / 2 + 0.6)}" y="${f2(-d / 2 + 0.45)}" width="1.8" height="1.2" rx="0.2" ${ln}/>` : '') + (it.hob ? `<g ${ln}><circle cx="${f2(w / 2 - 1.8)}" cy="${f2(-0.15)}" r="0.32"/><circle cx="${f2(w / 2 - 1.0)}" cy="${f2(-0.15)}" r="0.32"/><circle cx="${f2(w / 2 - 1.8)}" cy="${f2(0.55)}" r="0.25"/><circle cx="${f2(w / 2 - 1.0)}" cy="${f2(0.55)}" r="0.25"/></g>` : '');
    else if (/^wc/.test(it.k)) x = `<rect x="${f2(-w / 2)}" y="${f2(-d / 2)}" width="${f2(w)}" height="0.55" fill="#fff" stroke="#41556B" stroke-width="0.07"/><ellipse cx="0" cy="${f2(d / 2 - 0.8)}" rx="0.6" ry="0.78" ${ln}/>`;
    else if (/^basin/.test(it.k)) x = it.k === 'basin2' ? `<ellipse cx="${f2(-w / 4)}" cy="0.1" rx="0.6" ry="0.42" ${ln}/><ellipse cx="${f2(w / 4)}" cy="0.1" rx="0.6" ry="0.42" ${ln}/>` : `<ellipse cx="0" cy="0.1" rx="0.7" ry="0.45" ${ln}/>`;
    else if (it.k === 'shower') x = `<path d="M${f2(-w / 2)} ${f2(-d / 2)}L${f2(w / 2)} ${f2(d / 2)}M${f2(w / 2)} ${f2(-d / 2)}L${f2(-w / 2)} ${f2(d / 2)}" ${ln} opacity=".4"/><circle cx="0" cy="0" r="0.18" fill="#41556B"/>`;
    else if (it.k === 'bathtub') x = `<rect x="${f2(-w / 2 + 0.3)}" y="${f2(-d / 2 + 0.3)}" width="${f2(w - 0.6)}" height="${f2(d - 0.6)}" rx="0.8" ${ln}/>`;
    else if (/^tv/.test(it.k)) x = `<rect x="${f2(-2.4)}" y="${f2(-d / 2 + 0.12)}" width="4.8" height="0.22" fill="#222"/>`;
    else if (/fridge|washer|dryer|ovencol|dispenser/.test(it.k)) x = `<path d="M${f2(-w / 2 + 0.2)} ${f2(d / 2 - 0.25)}H${f2(w / 2 - 0.2)}" ${ln}/>` + (/washer|dryer/.test(it.k) ? `<circle cx="0" cy="0" r="0.6" ${ln}/>` : '');
    else if (s.cat === 'plant') x = `<circle cx="0" cy="0" r="${f2(w / 2 - 0.1)}" fill="#9CC28E" stroke="#5C8A4E" stroke-width="0.07"/>`;
    else if (it.k === 'car') x = `<rect x="${f2(-w / 2 + 0.5)}" y="${f2(-d / 2 + 3.6)}" width="${f2(w - 1)}" height="6.6" rx="0.8" ${ln}/><path d="M${f2(-w / 2 + 0.6)} ${f2(-d / 2 + 4.6)}H${f2(w / 2 - 0.6)}M${f2(-w / 2 + 0.6)} ${f2(d / 2 - 5.2)}H${f2(w / 2 - 0.6)}" ${ln}/>`;
    else if (it.k === 'ac') x = `<path d="M${f2(-w / 2 + 0.2)} ${f2(d / 2 - 0.15)}H${f2(w / 2 - 0.2)}" ${ln}/>`;
    else if (it.k === 'swing') x = `<path d="M${f2(-w / 2)} 0H${f2(w / 2)}" ${ln}/><rect x="${f2(-w / 2 + 1)}" y="-0.8" width="${f2(w - 2)}" height="1.6" rx="0.3" ${ln}/>`;
    else if (it.k === 'coffee' || it.k === 'island' || it.k === 'bbq') x = `<rect x="${f2(-w / 2 + 0.25)}" y="${f2(-d / 2 + 0.25)}" width="${f2(w - 0.5)}" height="${f2(d - 0.5)}" ${ln} opacity=".4"/>`;
    return `<g class="fu" data-fid="${esc(it.id || '')}" transform="translate(${f2(it.cx)} ${f2(it.cy)}) rotate(${it.rot})"${wallItem ? ' opacity="0.8"' : ''}>${base}${x}</g>`;
  }
  const order = it => (it.k === 'rug' || it.k === 'prayer' ? 0 : spec(it).mount === 'wall' ? 2 : 1);
  const symbols = (items, theme) => items.slice().sort((a, b) => order(a) - order(b)).map(i => symbol(i, theme)).join('');

  function floorLayer(plan, fi, getRoom, theme, o) {
    o = o || {}; const f = plan.floors[fi]; const out = ['<g class="furn-layer">'];
    f.rooms.forEach(r => {
      if (NOFURN.has(r.t)) return; const g = roomGeom(plan, fi, r); const st = getRoom(g);
      const auto = !st.touched && !st.done;
      out.push(`<g transform="translate(${f2(g.x0)} ${f2(g.y0)})" opacity="${auto && o.fadeAuto ? 0.55 : 1}">${symbols(st.items, st.theme || theme)}</g>`);
      if (o.selKey === g.key) out.push(`<rect x="${f2(r.x + 0.2)}" y="${f2(r.y + 0.2)}" width="${f2(r.w - 0.4)}" height="${f2(r.h - 0.4)}" fill="none" stroke="#1E6FD9" stroke-width="0.45" rx="0.3"/>`);
      if (o.badges) { const done = st.done; out.push(`<circle cx="${f2(r.x + r.w - 1.1)}" cy="${f2(r.y + 1.1)}" r="0.7" fill="${done ? '#16865A' : st.touched ? '#1E6FD9' : '#B9C7D6'}" stroke="#fff" stroke-width="0.15"/>`); }
      out.push(`<rect class="rm-hit" data-key="${esc(g.key)}" x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" fill="transparent" style="cursor:pointer"/>`);
    });
    out.push('</g>'); return out.join('');
  }
  function inject(svg, layer) {
    const texts = []; svg = svg.replace(/<g pointer-events="none"[^>]*><text[^>]*class="t-room"[\s\S]*?<\/g>/g, m => { texts.push(m); return ''; });
    const halo = texts.map(t => t.replace(/<text /g, '<text stroke="#ffffff" stroke-width="0.32" stroke-linejoin="round" paint-order="stroke" ')).join('');
    return svg.replace(/<\/svg>$/, layer + halo + '</svg>');
  }

  const api = { WALL, CEIL, F, THEMES, FLOORS, WALLS, PAINT, NOFURN, OUT, WET, ADD, ROLES, addList, swapList, reachInfo, resolve, atWall, isWallItem, defaultFinish, roomKey, roomGeom, layout, place, swap, spaceCheck, zones, clearZones, rectOf, footprint, fits, front, yr, itemPrice, itemSpec, roomBudget, schedule, symbol, symbols, floorLayer, inject, autoRole, ft, f2, esc, spec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BuildMeInterior = api;
})(typeof window !== 'undefined' ? window : globalThis);
