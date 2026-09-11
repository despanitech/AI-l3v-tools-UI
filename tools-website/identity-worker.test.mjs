import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './identity-worker.mjs';

test('unconfigured public generation stays disabled',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/catalog'),{});
  assert.deepEqual(await response.json(),{enabled:false,styles:[]});
  assert.equal((await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/generate',{method:'POST'}),{})).status,503);
});
test('static pages still use assets',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/'),{ASSETS:{fetch:()=>new Response('page')}});
  assert.equal(await response.text(),'page');
});
const env={NAME_LOGO_ENABLED:'true',NAME_LOGO_URL:'https://gateway.example',NAME_LOGO_TOKEN:'test',NAME_LOGO_SESSION_SECRET:'test-session-secret',TURNSTILE_SECRET:'test',TURNSTILE_SITEKEY:'test',NAME_LOGO_LIMITER:{}};
test('cross-origin generation is rejected before upstream access',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/generate',{method:'POST',headers:{Origin:'https://evil.example'}}),env);
  assert.equal(response.status,403);
});
test('image access requires an existing signed session',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/image?id='+'a'.repeat(32)),env);
  assert.equal(response.status,403);
});
