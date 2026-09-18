import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationSubjects,demoPreviewImage,applicationPreviewImage,demoIdentityName} from './src/lib/application-templates.mjs';

test('the demo identity is named by the manifest and every product has a demo in every artwork', () => {
  assert.equal(typeof demoIdentityName, 'string');
  assert.ok(demoIdentityName.length > 1);
  for (const mode of ['logo', 'initials', 'signature'])
    for (const subject of applicationSubjects)
      assert.equal(demoPreviewImage(subject, mode), `/assets/identity-subjects/demo/${mode}/${subject.id}.jpg`, `${mode}/${subject.id}`);
});

test('an unknown style falls back to the default demo, and a product without a demo borrows one from its group', () => {
  const apron = applicationSubjects.find(item => item.id === 'apron');
  assert.equal(demoPreviewImage(apron, 'logo', 'no-such-style'), '/assets/identity-subjects/demo/logo/apron.jpg');
  const stranger = {id: 'not-a-product', group: apron.group};
  assert.equal(demoPreviewImage(stranger, 'logo'), null);
  assert.match(applicationPreviewImage(stranger, 'logo'), /^\/assets\/identity-subjects\/demo\/logo\/[a-z0-9-]+\.jpg$/);
  assert.equal(applicationPreviewImage({id: 'x', group: 'No such group'}, 'logo'), null);
});
