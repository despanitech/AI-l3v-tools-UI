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
const env={NAME_LOGO_ENABLED:'true',NAME_LOGO_RECEIPTS_READY:'true',NAME_LOGO_URL:'https://gateway.example',NAME_LOGO_TOKEN:'test',NAME_LOGO_SESSION_SECRET:'test-session-secret',TURNSTILE_SECRET:'test',TURNSTILE_SITEKEY:'test',NAME_LOGO_LIMITER:{}};
test('cross-origin generation is rejected before upstream access',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/generate',{method:'POST',headers:{Origin:'https://evil.example'}}),env);
  assert.equal(response.status,403);
});
test('image access requires a valid receipt',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/image?id='+'a'.repeat(32)),env);
  assert.equal(response.status,404);
});

test('receipt stays separate and quota identity is generated at the edge',async()=>{
 const original=globalThis.fetch;let sent;
 globalThis.fetch=async(url,init)=>{if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'tools.l3v.ai',action:'name_logo'});sent=JSON.parse(init.body);return Response.json({id:'e'.repeat(64)});};
 try{
 const r=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/generate',{method:'POST',headers:{Origin:'https://tools.l3v.ai','CF-Connecting-IP':'192.0.2.1','X-L3V-Request-Id':'a'.repeat(32),'X-L3V-Request-Receipt':'b'.repeat(64)},body:JSON.stringify({first:'Natia',last:'Odisharia',styleId:'hard-angular',requestKey:'a'.repeat(32),token:'test'})}),{...env,NAME_LOGO_LIMITER:{limit:async()=>({success:true})}});
 assert.equal(r.status,200);assert.equal(sent.access.receipt,'b'.repeat(64));assert.match(sent.quotaSubject,/^[a-f0-9]{64}$/);assert.equal(sent.visitor,undefined);
 }finally{globalThis.fetch=original;}
});
