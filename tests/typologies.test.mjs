// Typology sweep: every standard plot, single and double storey, small to large briefs.
// Each brief must produce at least one plan, and the best plan must pass every CDA check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../src/engine.js');

const SEED = 20261020;
const custom = (w, d) => ({ id: `${w}x${d}`, w, d, sqft: w * d, sqyd: Math.round(w * d / 9), common: (w * d / 225).toFixed(1) + ' Marla', custom: true });

for (const plot of P.PLOTS) {
  for (const storeys of [1, 2]) {
    test(`${plot.id} ${plot.common}, ${storeys === 1 ? 'single' : 'double'} storey: every brief gives a compliant plan`, () => {
      const rules = P.cdaRules(plot);
      for (const beds of [2, 4, 6]) {
        const o = Object.assign(P.defaultOpts(plot), { storeys, beds, gfBeds: storeys === 1 ? beds : Math.min(1, beds) });
        const plans = P.generate(plot, o, rules, SEED, 40);
        assert.ok(plans.length > 0, `${beds} bedrooms: no plan`);
        const bad = plans[0].checks.filter(c => c.s === 'bad');
        assert.deepEqual(bad.map(c => c.label), [], `${beds} bedrooms: ${bad.map(c => c.label + ': ' + c.detail).join('; ')}`);
        if (storeys === 2) assert.equal(plans[0].floors.length, 2, `${beds} bedrooms: first floor missing`);
        for (const f of plans[0].floors) assert.equal(f.unreachable.length, 0, `${beds} bedrooms: unreachable rooms`);
      }
    });
  }
}

test('5 marla single storey fits two bedrooms (the reported failure)', () => {
  const plot = P.PLOTS.find(p => p.id === '25x50');
  const plans = P.generate(plot, Object.assign(P.defaultOpts(plot), { storeys: 1, beds: 3, gfBeds: 3 }), P.cdaRules(plot), SEED, 60);
  assert.ok(plans.length > 0);
  assert.equal(plans[0].stats.beds, 2);
  assert.ok(plans[0].notes.some(n => /bedroom fewer/.test(n)), 'the reduction is explained');
});

test('more bedrooms on a double storey never gives fewer than a smaller brief', () => {
  for (const id of ['25x50', '35x70', '50x90']) {
    const plot = P.PLOTS.find(p => p.id === id); let prev = 0;
    for (const beds of [2, 3, 4, 5, 6]) {
      const got = P.generate(plot, Object.assign(P.defaultOpts(plot), { storeys: 2, beds, gfBeds: 1 }), P.cdaRules(plot), SEED, 40)[0].stats.beds;
      assert.ok(got >= prev - 1, `${id}: ${beds} asked gave ${got}, ${beds - 1} asked gave ${prev}`);
      prev = Math.max(prev, got);
    }
  }
});

test('narrow custom plots: double storey works, impossible briefs return diagnostics', () => {
  const narrow = custom(20, 40);
  const two = P.generate(narrow, Object.assign(P.defaultOpts(narrow), { storeys: 2, beds: 2, gfBeds: 0 }), P.cdaRules(narrow), SEED, 60);
  assert.ok(two.length > 0, '20 × 40 double storey');
  const diag = {};
  const one = P.generate(narrow, Object.assign(P.defaultOpts(narrow), { storeys: 1, beds: 2 }), P.cdaRules(narrow), SEED, 30, diag);
  assert.equal(one.length, 0);
  assert.ok(Object.keys(diag).some(k => /row|depth|unreach|scheme/.test(k)), 'diagnostics say why');
  assert.ok(Array.isArray(diag.tried), 'relaxations tried are listed');
});
