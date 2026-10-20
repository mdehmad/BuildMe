// Engine checks for every standard plot: plans are found, respect CDA bylaws, and stay deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../src/engine.js');

const SEED = 42;

for (const plot of P.PLOTS) {
  test(`${plot.id} (${plot.common}) produces a bylaw-compliant plan`, () => {
    const rules = P.cdaRules(plot);
    const plans = P.generate(plot, P.defaultOpts(plot), rules, SEED, 60);
    assert.ok(plans.length > 0, 'no layout found');
    const p = plans[0];
    const fails = p.checks.filter(c => c.s === 'bad');
    assert.deepEqual(fails, [], fails.map(f => `${f.label}: ${f.detail}`).join('; '));
    assert.ok(p.stats.gfCounted <= p.stats.covMax + 0.5, 'ground coverage over limit');
    assert.ok(p.stats.far <= p.stats.farMax + 0.5, 'FAR over limit');
    const rear = plot.d - p.E.y0 - p.D;
    assert.ok(rear >= rules.rear - 0.01, `rear open ${rear} < ${rules.rear}`);
    for (const f of p.floors) assert.equal(f.unreachable.length, 0, 'unreachable rooms');
  });
}

test('rear setbacks: 5 ft up to 5 marla, 7 ft below 1 kanal, 10 ft from 1 kanal', () => {
  const rear = id => P.cdaRules(P.PLOTS.find(p => p.id === id)).rear;
  assert.equal(rear('25x40'), 5); assert.equal(rear('25x50'), 5);
  assert.equal(rear('30x60'), 7); assert.equal(rear('35x70'), 7); assert.equal(rear('40x80'), 7);
  assert.equal(rear('50x90'), 10); assert.equal(rear('75x120'), 10);
});

test('servant room is mandatory from 501 sq yd', () => {
  assert.equal(P.cdaRules(P.PLOTS.find(p => p.id === '50x90')).servantRequired, false);
  assert.equal(P.cdaRules(P.PLOTS.find(p => p.id === '50x100')).servantRequired, true);
});

test('same seed gives the same layout; realise is deterministic', () => {
  const plot = P.PLOTS.find(p => p.id === '35x70');
  const a = P.generate(plot, P.defaultOpts(plot), P.cdaRules(plot), 7, 40)[0];
  const b = P.generate(plot, P.defaultOpts(plot), P.cdaRules(plot), 7, 40)[0];
  const sig = p => p.floors.map(f => f.rooms.map(r => `${r.t}:${r.x},${r.y},${r.w},${r.h}`).join('|')).join('/');
  assert.equal(sig(a), sig(b));
  const again = P.realise(a.scheme);
  assert.equal(sig(again), sig(a));
});

test('edits that break the plan are refused with a reason', () => {
  const plot = P.PLOTS.find(p => p.id === '35x70');
  const p = P.generate(plot, P.defaultOpts(plot), P.cdaRules(plot), 3, 40)[0];
  const porch = p.scheme.gf.bands[0].items.find(i => i.kind === 'porch');
  const res = P.edit.move(p.scheme, porch.id, 0, 1, 0);
  assert.ok(res.error && /road side/.test(res.error));
  const mir = P.edit.mirror(p.scheme);
  assert.ok(!mir.error, mir.error);
});
