import test from 'node:test';
import assert from 'node:assert/strict';
import {balanceArtwork, artworkCounts, nextArtwork, ARTWORK_MODES} from './src/lib/artwork-mix.mjs';

const subjects = n => Array.from({length: n}, (_, i) => 's' + i);
const all = ARTWORK_MODES;

test('a Studio set splits ten, ten, ten and a Creator set four, three, three', () => {
  const studio = balanceArtwork(subjects(30), all);
  assert.deepEqual(artworkCounts(studio, subjects(30)), {logo: 10, initials: 10, signature: 10});
  const creator = balanceArtwork(subjects(10), all);
  assert.deepEqual(artworkCounts(creator, subjects(10)), {logo: 4, initials: 3, signature: 3});
});

test('the buyer\'s own choices are kept and the rest rebalanced around them', () => {
  const chosen = {s0: 'signature', s1: 'signature', s2: 'signature', s3: 'signature'};
  const mixed = balanceArtwork(subjects(9), all, chosen);
  for (const id of Object.keys(chosen)) assert.equal(mixed[id], 'signature');
  assert.deepEqual(artworkCounts(mixed, subjects(9)), {logo: 3, initials: 2, signature: 4});
});

test('a natural fit wins a tie, and a removed subject drops out', () => {
  const natural = id => (id === 's0' ? 'initials' : null);
  const first = balanceArtwork(['s0', 's1', 's2'], all, {}, natural);
  assert.equal(first.s0, 'initials', 'tattoo-like products get initials when counts are level');
  const fewer = balanceArtwork(['s1', 's2'], all, first, natural);
  assert.equal(fewer.s0, undefined);
  assert.equal(Object.keys(fewer).length, 2);
});

test('only the designs that exist are used', () => {
  const twoOnly = balanceArtwork(subjects(6), ['logo', 'signature']);
  assert.deepEqual(artworkCounts(twoOnly, subjects(6)), {logo: 3, initials: 0, signature: 3});
  assert.deepEqual(balanceArtwork(subjects(3), []), {});
  assert.equal(nextArtwork('logo', all), 'initials');
  assert.equal(nextArtwork('signature', all), 'logo');
  assert.equal(nextArtwork('logo', ['logo', 'signature']), 'signature');
});
