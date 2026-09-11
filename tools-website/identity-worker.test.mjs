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
test('invitation validation is rate limited before revealing validity',async()=>{
 const account='d'.repeat(64),records=new Map([[`token:${account}`,account]]);
 const request=new Request('https://tools.l3v.ai/api/invitation/validate',{headers:{'X-L3V-Invitation':'d'.repeat(43),'CF-Connecting-IP':'192.0.2.8'}});
 const response=await worker.fetch(request,{INVITATIONS:{get:key=>records.get(key)??null},INVITATION_LIMITER:{limit:async()=>({success:false})}});
 assert.equal(response.status,429);assert.deepEqual(await response.json(),{error:'Please wait before trying again'});
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

function admissionRequest() {
 return new Request('https://tools.l3v.ai/api/name-logo/generate',{method:'POST',headers:{Origin:'https://tools.l3v.ai','CF-Connecting-IP':'192.0.2.1','X-L3V-Request-Id':'a'.repeat(32),'X-L3V-Request-Receipt':'b'.repeat(64)},body:JSON.stringify({first:'Natia',last:'Odisharia',styleId:'hard-angular',requestKey:'a'.repeat(32),token:'test'})});
}
test('rate rejection makes no verification or provider request',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('Unexpected network request')};
 try {
  const response=await worker.fetch(admissionRequest(),{...env,NAME_LOGO_LIMITER:{limit:async()=>({success:false})}});
  assert.equal(response.status,429);assert.equal(calls,0);
 }finally{globalThis.fetch=original}
});
test('wrong verification action or hostname never admits a design',async()=>{
 const original=globalThis.fetch;
 try {
  for(const checked of [{success:true,hostname:'evil.example',action:'name_logo'},{success:true,hostname:'tools.l3v.ai',action:'video'}]) {
   let calls=0;
   globalThis.fetch=async(url)=>{calls++;assert.match(String(url),/siteverify/);return Response.json(checked)};
   const response=await worker.fetch(admissionRequest(),{...env,NAME_LOGO_LIMITER:{limit:async()=>({success:true})}});
   assert.equal(response.status,403);assert.equal(calls,1);
  }
 }finally{globalThis.fetch=original}
});
test('foreign receipt rejection from gateway stays private at the edge',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  assert.equal(JSON.parse(init.body).access.receipt,'c'.repeat(64));
  return Response.json({error:'private backend details'}, {status:404});
 };
 try {
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/image?id='+'a'.repeat(32),{headers:{'X-L3V-Request-Id':'b'.repeat(32),'X-L3V-Request-Receipt':'c'.repeat(64)}}),env);
  assert.equal(response.status,404);assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(await response.json(),{error:'Design not found or expired'});
 }finally{globalThis.fetch=original}
});

test('gateway redirects are rejected without following or exposing their destination',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://untrusted.example/'}})};
 try{const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/catalog'),env);assert.equal(response.status,503);assert.equal(calls,1);assert.ok(!(await response.text()).includes('untrusted'));}finally{globalThis.fetch=original}
});
