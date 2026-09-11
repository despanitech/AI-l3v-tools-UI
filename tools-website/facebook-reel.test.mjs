import test from 'node:test';
import assert from 'node:assert/strict';
import {facebookReelUrl} from './src/lib/facebook-reel.mjs';
test('canonical Facebook Reels accepted with tracking removed',()=>{
  assert.equal(facebookReelUrl('https://www.facebook.com/reel/12345/?x=1#t'),'https://www.facebook.com/reel/12345');
  assert.equal(facebookReelUrl('https://m.facebook.com/reels/12345'),'https://www.facebook.com/reel/12345');
});
test('other hosts, credentials, schemes and unsupported paths rejected',()=>{
  for(const input of ['https://facebook.com.evil.test/reel/123','https://instagram.com/reel/123','http://facebook.com/reel/123','https://user:secret@facebook.com/reel/123','https://facebook.com:444/reel/123','https://facebook.com/share/r/abc','https://example.com/video.mp4','javascript:alert(1)','']) assert.equal(facebookReelUrl(input),null,input);
});
