// Room detail: drawings, specs and BOQ for every room of standard plans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../src/engine.js'); const I = require('../src/interior.js'); const D = require('../src/interior-detail.js');

test('every room gets a plan, elevations, RCP, electrical, flooring, specs and a priced BOQ', () => {
  for (const id of ['cda', 'lda', 'sbca']) for (const plot of P.AUTH.plotsFor(id).slice(0, 4)) {
    const plan = P.generate(plot, P.defaultOpts(plot), P.rulesFor(plot, id), 7, 25)[0];
    plan.floors.forEach((f, fi) => f.rooms.forEach(r => {
      if (I.NOFURN.has(r.t)) return; const g = I.roomGeom(plan, fi, r); const items = I.layout(g, {}); const fin = I.defaultFinish(r.t);
      assert.match(D.planSVG(g, items, 'modern', fin), /^<svg/);
      if (!g.open) { const el = D.elevations(g, items, 'modern', fin, D.electrical(g, items)); assert.equal(el.length, 4); el.forEach(e => assert.match(e.svg, /<\/svg>$/)); }
      const b = D.boq(g, items, fin, 'modern'); assert.ok(b.rows.length >= 2, `${r.name} BOQ lines`); assert.ok(b.total[0] > 0 && b.total[1] >= b.total[0]);
      assert.ok(D.specs(g, items, fin, 'modern').surfaces.length >= 5); assert.ok(D.flooring(g, fin).pieces > 0);
    }));
  }
});

test('space resolution leaves no blocked bathrooms', () => {
  for (const id of ['cda', 'lda']) for (const plot of P.AUTH.plotsFor(id)) {
    const plan = P.generate(plot, P.defaultOpts(plot), P.rulesFor(plot, id), 7, 25)[0];
    plan.floors.forEach((f, fi) => f.rooms.forEach(r => { if (!/bath|powder/.test(r.t)) return; const g = I.roomGeom(plan, fi, r); const bad = I.spaceCheck(g, I.layout(g, {})).filter(c => c.s === 'bad'); assert.deepEqual(bad.map(c => c.text), [], `${id} ${plot.id} ${r.name}`); }));
  }
});
