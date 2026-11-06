// Location step: every authority's standard plots must design, pass that authority's checks, and furnish cleanly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../src/engine.js');
const I = require('../src/interior.js');
const AU = P.AUTH;

test('every authority has a source, a confidence level and plots', () => {
  assert.ok(AU.AUTHORITIES.length >= 16);
  for (const a of AU.AUTHORITIES) {
    assert.ok(a.source && a.source.url && a.source.name, `${a.id} source`);
    assert.ok(['official', 'secondary', 'assumed'].includes(a.conf), `${a.id} confidence`);
    assert.ok(AU.plotsFor(a.id).length >= 5, `${a.id} plots`);
  }
});

test('rules differ by authority (LDA 10 marla vs CDA, Karachi 240 yd)', () => {
  const lda = P.rulesFor({ w: 35, d: 65, sqft: 2275 }, 'lda');
  assert.equal(lda.front, 10); assert.equal(lda.rear, 7); assert.equal(lda.cov, 0.70); assert.equal(lda.sideL + lda.sideR, 5);
  const khi = P.rulesFor({ w: 40, d: 54, sqft: 2160 }, 'sbca');
  assert.equal(khi.cov, 0.65); assert.equal(khi.far, 2.0); assert.equal(khi.front, 5);
  const dha = P.rulesFor({ w: 35, d: 65, sqft: 2275 }, 'dhalhr');
  assert.ok(dha.far < 2 * dha.cov + 1e-9, 'DHA Lahore first floor is a share of the ground floor');
});

test('brief parser hints map city words to authorities', () => {
  assert.equal(AU.detect('10 marla in Lahore'), 'lda');
  assert.equal(AU.detect('1 kanal DHA Lahore'), 'dhalhr');
  assert.equal(AU.detect('240 yards karachi'), 'sbca');
  assert.equal(AU.detect('bahria town phase 8 rawalpindi'), 'bahriaisb');
  assert.equal(AU.detect('house in hayatabad peshawar'), 'pda');
});

for (const a of AU.AUTHORITIES) {
  test(`${a.short} (${a.city}): every standard plot designs and passes`, () => {
    for (const plot of AU.plotsFor(a.id)) {
      const R = P.rulesFor(plot, a.id);
      for (const storeys of [1, 2]) {
        const o = Object.assign(P.defaultOpts(plot), { storeys, beds: 3, gfBeds: storeys === 1 ? 3 : 1 });
        const plans = P.generate(plot, o, R, 20261020, 30);
        assert.ok(plans.length > 0, `${plot.id} ${storeys}-storey: no plan`);
        const bad = plans[0].checks.filter(c => c.s === 'bad');
        assert.deepEqual(bad.map(c => c.label), [], `${plot.id} ${storeys}-storey: ${bad.map(c => c.detail).join('; ')}`);
      }
    }
  });
}

test('interiors: every room furnishes inside its walls without overlaps', () => {
  for (const id of ['cda', 'lda', 'sbca', 'dhalhr']) {
    for (const plot of AU.plotsFor(id).slice(0, 5)) {
      const plan = P.generate(plot, P.defaultOpts(plot), P.rulesFor(plot, id), 7, 25)[0];
      plan.floors.forEach((f, fi) => f.rooms.forEach(r => {
        if (I.NOFURN.has(r.t)) return;
        const g = I.roomGeom(plan, fi, r); const items = I.layout(g, { hasDining: f.rooms.some(x => x.t === 'dining') });
        const key = { bed: 'bed_', kitchen: 'counter', bath: 'wc', powder: 'wc', lounge: 'sofa', drawing: 'sofa', dining: 'dining' }[r.t];
        if (key) assert.ok(items.some(i => i.k.startsWith(key)), `${id} ${plot.id} ${r.name}: no ${key}`);
        for (const it of items) { const b = I.rectOf(it); assert.ok(b.x > -0.02 && b.y > -0.02 && b.x + b.w < g.W + 0.02 && b.y + b.h < g.H + 0.02, `${r.name}: ${it.k} outside`); }
        const solid = items.filter(i => !['rug', 'prayer', 'showerzone'].includes(i.k));
        for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
          const A = I.rectOf(solid[i]), B = I.rectOf(solid[j]); const ya = I.yr(solid[i]), yb = I.yr(solid[j]); if (!(ya[0] < yb[1] - 0.05 && yb[0] < ya[1] - 0.05)) continue;
          assert.ok(!(A.x < B.x + B.w - 0.05 && B.x < A.x + A.w - 0.05 && A.y < B.y + B.h - 0.05 && B.y < A.y + A.h - 0.05), `${r.name}: ${solid[i].k} overlaps ${solid[j].k}`);
        }
        const bud = I.roomBudget(g, items, I.defaultFinish(r.t), 'modern');
        assert.ok(bud.total[0] > 0 && bud.total[1] >= bud.total[0], `${r.name}: budget`);
      }));
    }
  }
});
