import test from 'node:test';
import assert from 'node:assert/strict';
import {allowanceFor, gateVisualization, INCLUDED_PREVIEWS} from './generation-allowance.mjs';

const design = 'a'.repeat(32);
const listOf = (n, status = 'succeeded') => Array.from({length: n}, (_, i) => ({id: String(i), status, output: {template: 't' + i, sourceDesignId: design}}));

test('every identity gets the five included previews and nothing more without a purchase', () => {
  assert.equal(allowanceFor(null), INCLUDED_PREVIEWS);
  assert.equal(INCLUDED_PREVIEWS, 5);
  assert.equal(gateVisualization(listOf(4), null, {designId: design, template: 'x'}).allowed, true);
  const sixth = gateVisualization(listOf(5), null, {designId: design, template: 'x'});
  assert.equal(sixth.allowed, false);
  assert.equal(sixth.reason, 'included-used');
});

test('an undelivered purchase adds exactly the package image count', () => {
  const creator = {packageId: 'creator', paidAt: 'now'};
  const studio = {packageId: 'studio', paidAt: 'now'};
  assert.equal(allowanceFor(creator), 15);
  assert.equal(allowanceFor(studio), 20);
  assert.equal(gateVisualization(listOf(14), creator, {designId: design, template: 'x'}).allowed, true);
  const over = gateVisualization(listOf(15), creator, {designId: design, template: 'x'});
  assert.equal(over.allowed, false);
  assert.equal(over.reason, 'package-complete');
});

test('a delivered purchase no longer entitles', () => {
  const delivered = {packageId: 'creator', paidAt: 'then', fulfilledAt: 'now'};
  assert.equal(allowanceFor(delivered), INCLUDED_PREVIEWS);
  assert.equal(gateVisualization(listOf(5), delivered, {designId: design, template: 'x'}).allowed, false);
});

test('asking for a job that already exists is free, and failed jobs are not charged', () => {
  const list = listOf(5);
  const again = gateVisualization(list, null, {designId: design, template: 't3'});
  assert.equal(again.allowed, true);
  assert.equal(again.reason, 'existing');
  const withFailures = [...listOf(3), ...listOf(2, 'failed')];
  assert.equal(gateVisualization(withFailures, null, {designId: design, template: 'new'}).allowed, true, 'two failed jobs leave room');
  assert.equal(gateVisualization(withFailures, null, {designId: design, template: 'new'}).used, 3);
});

test('the simulator list shape (designId at top level) is recognised as the same job', () => {
  const list = [{id: '1', status: 'succeeded', designId: design, output: {template: 'candle-jar'}}];
  assert.equal(gateVisualization(list, null, {designId: design, template: 'candle-jar'}).reason, 'existing');
});
