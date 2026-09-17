import test from 'node:test';
import assert from 'node:assert/strict';
import {failureText, retryText} from './src/lib/failure-copy.mjs';

test('a recorded reason leads, then the code and a short reference', () => {
  assert.equal(failureText({code: 'image-auth-required', stage: 'generate-image:generating', traceId: 'a'.repeat(32), reason: 'Image worker ended in state failed-or-ambiguous during generating (RuntimeError)'}),
    'Image worker ended in state failed-or-ambiguous during generating (RuntimeError). Code image-auth-required. Ref aaaaaaaa.');
});

test('a code alone still names itself; nothing recorded falls back', () => {
  assert.equal(failureText({code: 'planner-exit-1', traceId: 'b'.repeat(32)}), 'Not completed (planner-exit-1). Ref bbbbbbbb.');
  assert.equal(failureText(null), 'Not completed.');
  assert.equal(failureText(undefined, 'This video could not be completed.'), 'This video could not be completed.');
  assert.equal(failureText({reason: 42, code: {}}), 'Not completed.');
});

test('a running job on another attempt says so, with the reason', () => {
  assert.equal(retryText({attempt: 2, of: 3, code: 'planner-exit-1', reason: 'Image worker ended in state failed-or-ambiguous during planning (RuntimeError)'}),
    'Retrying · attempt 2 of 3 (Image worker ended in state failed-or-ambiguous during planning (RuntimeError))');
  assert.equal(retryText({attempt: 3, of: 3, code: 'provider-no-final-image'}), 'Retrying · attempt 3 of 3 (provider-no-final-image)');
  assert.equal(retryText(null), '');
  assert.equal(retryText({code: 'x'}), '');
});
