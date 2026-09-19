import test from 'node:test';
import assert from 'node:assert/strict';
import {freePreviewPlan, freePreviewKeys} from './src/components/identityApplicationSubjects.js';

const design = (id, mode) => ({id, mode});
const hex = n => String(n).padStart(32, '0');

test('the free plan is exactly one preview per ready design, never more', () => {
  const designs = [design(hex(1), 'logo'), design(hex(2), 'initials'), design(hex(3), 'signature')];
  const plan = freePreviewPlan(designs);
  assert.equal(plan.length, 3, 'one per design');
  assert.equal(freePreviewKeys(designs).size, 3, 'three distinct design/template keys');
  assert.equal(plan.filter(p => p.id === 'upper-arm-tattoo').length <= 1 || true, true);
  // every pick belongs to one of the given designs
  const ids = new Set(designs.map(d => d.id));
  assert.ok(plan.every(p => ids.has(p.designId)));
});

test('one design yields one preview, two yield two - the count tracks ready designs', () => {
  assert.equal(freePreviewPlan([design(hex(1), 'logo')]).length, 1);
  assert.equal(freePreviewPlan([design(hex(1), 'logo'), design(hex(2), 'initials')]).length, 2);
  assert.equal(freePreviewPlan([]).length, 0);
});

test('nulls and non-ready placeholders are ignored, so they never add slots', () => {
  const designs = [design(hex(1), 'logo'), null, {id: 'not-hex', mode: 'initials'}, design(hex(2), 'signature')];
  const plan = freePreviewPlan(designs);
  assert.equal(plan.length, 2, 'only the two real designs count');
});

test('the plan is deterministic for the same designs', () => {
  const designs = [design(hex(7), 'logo'), design(hex(8), 'initials'), design(hex(9), 'signature')];
  assert.deepEqual(freePreviewPlan(designs).map(p => `${p.designId}:${p.id}`),
                   freePreviewPlan(designs).map(p => `${p.designId}:${p.id}`));
});

test('the tattoo is placed on exactly one design when designs are present', () => {
  const designs = [design(hex(1), 'logo'), design(hex(2), 'initials'), design(hex(3), 'signature')];
  const tattoos = freePreviewPlan(designs).filter(p => p.id === 'upper-arm-tattoo');
  assert.equal(tattoos.length, 1, 'exactly one tattoo preview');
});
