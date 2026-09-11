import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './identity-worker.mjs';
const access={requestId:'a'.repeat(32),receipt:'b'.repeat(64)};
const env={VIDEO_RECEIPTS_READY:'true',ANALYZER_ENABLED:'true',FRAMES_ENABLED:'true',VIDEO_ENABLED:'true',
  VIDEO_ACCESS_MODE:'public',VIDEO_ADMISSION_LIMITER:{limit:async()=>({success:true})},VIDEO_POLL_LIMITER:{limit:async()=>({success:true})},
  HERMES_URL:'https://tools-api.example/analyze',HERMES_TOKEN:'server-secret',TURNSTILE_SECRET:'challenge-secret',
  TURNSTILE_SITEKEY:'public-site-key',VIDEO_OUTPUT_BASE_URL:'https://tools-api.example/media'};
function request(path='/api/jobs',body={id:'c'.repeat(32)},headers={}) {
  return new Request('https://tools.l3v.ai'+path,{method:'POST',headers:{Origin:'https://tools.l3v.ai',
    'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1','X-L3V-Request-Id':access.requestId,
    'X-L3V-Request-Receipt':access.receipt,...headers},body:JSON.stringify(body)});
}

test('private rollout only admits configured network and defaults off',async()=>{
  const config=()=>new Request('https://tools.l3v.ai/api/analyzer/config',{headers:{'CF-Connecting-IP':'192.0.2.1'}});
  for(const changes of [{VIDEO_ACCESS_MODE:undefined},{VIDEO_ACCESS_MODE:'private',VIDEO_TEST_IPS:'192.0.2.2'}, {VIDEO_ADMISSION_LIMITER:undefined}]){
    assert.equal((await (await worker.fetch(config(),{...env,...changes})).json()).enabled,false);
  }
  assert.equal((await (await worker.fetch(config(),{...env,VIDEO_ACCESS_MODE:'private',VIDEO_TEST_IPS:'192.0.2.1'})).json()).enabled,true);
});

test('rate limit and limiter failure never reach challenge or gateway',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw Error('must not fetch')});
  assert.equal((await worker.fetch(request(),{...env,VIDEO_POLL_LIMITER:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await worker.fetch(request(),{...env,VIDEO_POLL_LIMITER:{limit:async()=>{throw Error('offline')}}})).status,503);
  assert.equal(globalThis.fetch.mock.callCount(),0);
});

test('Reel submission sends canonical URL without image or challenge token to gateway',async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async(target,options)=>{
    calls.push(String(target));
    if(String(target).includes('siteverify'))return Response.json({success:true,hostname:'tools.l3v.ai',action:'reference_analyze'});
    const body=JSON.parse(options.body);
    assert.equal(body.kind,'facebook-reel');assert.equal(body.sourceUrl,'https://www.facebook.com/reel/123');
    assert.equal(body.token,undefined);assert.equal(body.image,undefined);
    return Response.json({job:{id:'c'.repeat(32),status:'queued'}},{status:202});
  });
  assert.equal((await worker.fetch(request('/api/analyze',{kind:'facebook-reel',sourceUrl:'https://m.facebook.com/reels/123/?track=x',token:'test'}),{...env,REELS_ENABLED:'true'})).status,202);
  assert.equal(calls.length,2);
});
test('new readiness gate disables configuration and admissions',async()=>{
  const disabled={...env,VIDEO_RECEIPTS_READY:'false'};
  const config=await (await worker.fetch(new Request('https://tools.l3v.ai/api/analyzer/config'),disabled)).json();
  assert.equal(config.enabled,false);assert.equal(config.videoGeneration,false);
  assert.equal((await worker.fetch(request(),disabled)).status,503);
});
test('missing receipt or foreign origin never reaches upstream',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected fetch');});
  assert.equal((await worker.fetch(request('/api/jobs',{}, {'X-L3V-Request-Receipt':''}),env)).status,404);
  assert.equal((await worker.fetch(request('/api/jobs',{}, {Origin:'https://other.test'}),env)).status,403);
  assert.equal(globalThis.fetch.mock.callCount(),0);
});
test('status forwards separate access and server-derived quota identity without Turnstile',async t=>{
  t.mock.method(globalThis,'fetch',async(target,options)=>{
    assert.equal(String(target),'https://tools-api.example/jobs');
    assert.equal(options.headers.Authorization,'Bearer server-secret');
    const body=JSON.parse(options.body);assert.deepEqual(body.access,access);
    assert.match(body.visitor,/^[a-f0-9]{64}$/);assert.notEqual(body.visitor,'e'.repeat(64));
    assert.deepEqual(Object.keys(body).sort(),['access','id','visitor']);
    return Response.json({job:{id:'c'.repeat(32),status:'running'},access});
  });
  const response=await worker.fetch(request('/api/jobs',{id:'c'.repeat(32),visitor:'e'.repeat(64),receipt:'ignored'}),env);
  assert.equal(response.status,200);assert.ok(!(await response.text()).includes(access.receipt));
  assert.equal(globalThis.fetch.mock.callCount(),1);
});
test('admission verifies challenge action and excludes token and arbitrary prompt upstream',async t=>{
  t.mock.method(globalThis,'fetch',async(target,options)=>{
    if(String(target).includes('siteverify'))return Response.json({success:true,hostname:'tools.l3v.ai',action:'reference_frame'});
    assert.deepEqual(JSON.parse(options.body).ticket,'c'.repeat(32));
    assert.ok(!options.body.includes('challenge-token'));assert.ok(!options.body.includes('malicious-prompt'));
    return Response.json({job:{id:'d'.repeat(32),status:'queued'}},{status:202});
  });
  const response=await worker.fetch(request('/api/first-frame',{ticket:'c'.repeat(32),token:'challenge-token',prompt:'malicious-prompt'}),env);
  assert.equal(response.status,202);assert.equal(globalThis.fetch.mock.callCount(),2);
});
test('wrong challenge action blocks admission',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({success:true,hostname:'tools.l3v.ai',action:'reference_analyze'}));
  assert.equal((await worker.fetch(request('/api/first-frame',{ticket:'c'.repeat(32),token:'challenge'}),env)).status,403);
  assert.equal(globalThis.fetch.mock.callCount(),1);
});
test('upstream errors are sanitized and conflict status survives',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(access.receipt,{status:409}));
  const response=await worker.fetch(request(),env);
  assert.equal(response.status,409);assert.ok(!(await response.text()).includes(access.receipt));
});
test('video credit cap rejects before paid admission',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected fetch');});
  const response=await worker.fetch(request('/api/image-to-video',{request:{frameId:'c'.repeat(32),duration:6,resolution:'480p',audio:false},token:'challenge'}),env);
  assert.equal(response.status,400);assert.equal(globalThis.fetch.mock.callCount(),0);
});

test('Video gateway rejects redirects without forwarding credentials',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://untrusted.example'}})});
 const response=await worker.fetch(request(),env);assert.equal(response.status,503);assert.equal(calls,1);assert.ok(!(await response.text()).includes('untrusted'));
});
