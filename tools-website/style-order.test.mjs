import test from 'node:test';
import assert from 'node:assert/strict';
import {orderStyles, defaultStyleId} from './src/lib/style-order.mjs';

const catalog = [
  {mode: 'logo', id: 'soft-angular'}, {mode: 'logo', id: 'tall-stems'}, {mode: 'logo', id: 'flowing-curves'},
  {mode: 'logo', id: 'hard-angular'}, {mode: 'logo', id: 'geometric-emblem'}, {mode: 'logo', id: 'angular-open'},
  {mode: 'logo', id: 'gothic-weave-logo'}, {mode: 'initials', id: 'woven-serif'}, {mode: 'initials', id: 'deco-lines'},
  {mode: 'signature', id: 'compact-autograph'},
];

test('the compact emblem leads the logos, the tall one follows, the rest keep their order', () => {
  assert.deepEqual(orderStyles(catalog).filter(s => s.mode === 'logo').map(s => s.id),
    ['hard-angular', 'tall-stems', 'soft-angular', 'flowing-curves', 'geometric-emblem', 'angular-open', 'gothic-weave-logo']);
});

test('other modes are left as the catalog lists them', () => {
  assert.deepEqual(orderStyles(catalog).filter(s => s.mode !== 'logo').map(s => s.id), ['woven-serif', 'deco-lines', 'compact-autograph']);
});

test('the default logo is the compact emblem on desktop and the tall one on a phone', () => {
  assert.equal(defaultStyleId(catalog, 'logo'), 'hard-angular');
  assert.equal(defaultStyleId(catalog, 'logo', {phone: true}), 'tall-stems');
  assert.equal(defaultStyleId(catalog, 'initials'), 'woven-serif');
  assert.equal(defaultStyleId(catalog, 'initials', {phone: true}), 'woven-serif');
});

test('a catalog without the preferred style falls back to its first entry', () => {
  const few = [{mode: 'logo', id: 'soft-angular'}, {mode: 'logo', id: 'flowing-curves'}];
  assert.equal(defaultStyleId(few, 'logo'), 'soft-angular');
  assert.equal(defaultStyleId(few, 'logo', {phone: true}), 'soft-angular');
  assert.equal(defaultStyleId([], 'logo'), undefined);
});
