import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './identity-worker.mjs';

// dev and uat lanes never reach the gateway or, in dev, Stripe. production is
// the code path that existed before the lanes and must be unchanged by them.

const base={NAME_LOGO_ENABLED:'true',NAME_LOGO_RECEIPTS_READY:'true',NAME_LOGO_URL:'https://gateway.example',NAME_LOGO_TOKEN:'test',NAME_LOGO_SESSION_SECRET:'test-session-secret',TURNSTILE_SECRET:'test',TURNSTILE_SITEKEY:'test'};
const access={'X-L3V-Request-Id':'a'.repeat(32),'X-L3V-Request-Receipt':'b'.repeat(64),Origin:'https://tools.l3v.ai','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.9'};

function memoryBucket(){
  const map=new Map();
  return {async put(key,value){map.set(key,String(value))},async get(key){return map.has(key)?{text:async()=>map.get(key)}:null},
    async list({prefix}){return {objects:[...map.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))}}};
}
function laneEnv(mode,extra={}){
  const kv=new Map();
  return {...base,APP_MODE:mode,NAME_LOGO_LIMITER:{limit:async()=>({success:true})},IDENTITY_BUNDLES:memoryBucket(),
    INVITATIONS:{get:async key=>kv.get(key)??null,put:async(key,value)=>{kv.set(key,value)},delete:async key=>{kv.delete(key)}},
    INVITATION_ONLY:'false',STRIPE_MODE:'test',STRIPE_SECRET_KEY_TEST:'sk_test_x',STRIPE_WEBHOOK_SECRET_TEST:'whsec_x',
    STRIPE_PRICE_CREATOR_TEST:'prod_a',STRIPE_PRICE_STUDIO_TEST:'prod_b',_kv:kv,...extra};
}
const post=(action,body,lane)=>worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/'+action,{method:'POST',headers:access,body:JSON.stringify(body)}),lane);
const noNetwork=async url=>{throw new Error('network call in a simulated lane: '+url)};

test('the mode is public and defaults to production',async()=>{
  const read=async extra=>(await (await worker.fetch(new Request('https://tools.l3v.ai/api/mode'),{...base,...extra})).json()).mode;
  assert.equal(await read({INVITATION_ONLY:'true'}),'production','public even when invitations are required');
  assert.equal(await read({APP_MODE:'dev'}),'dev');
  assert.equal(await read({APP_MODE:'uat'}),'uat');
});

test('dev generates without Turnstile or the gateway, and designs land over time',async()=>{
  const original=globalThis.fetch;globalThis.fetch=noNetwork;
  try{
    const lane=laneEnv('dev');
    const generate=await post('generate',{first:'John',last:'Smith',requestKey:'k',token:'ignored-in-dev',styles:[{mode:'logo',id:'soft-angular'},{mode:'initials',id:'woven-serif'},{mode:'signature',id:'compact-autograph'}]},lane);
    assert.equal(generate.status,200);
    const {id}=await generate.json();
    assert.match(id,/^[a-f0-9]{64}$/);
    const status=await post('status',{id},lane);
    assert.equal(status.status,200);
    const {designs}=await status.json();
    assert.deepEqual(designs.map(d=>d.mode),['logo','initials','signature']);
    assert.ok(designs.every(d=>d.status==='queued'),'nothing is instant');
    const catalog=await (await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/catalog'),lane)).json();
    assert.equal(catalog.enabled,true);
    assert.equal(catalog.sitekey,'test');
    const health=await (await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/health'),lane).catch(()=>null))?.json().catch(()=>null);
    assert.ok(health===null||health.error||health.appMode==='dev','health names the lane when it answers');
  }finally{globalThis.fetch=original}
});

test('dev pays without Stripe: checkout records a test purchase and returns as paid',async()=>{
  const original=globalThis.fetch;globalThis.fetch=noNetwork;
  try{
    const lane=laneEnv('dev');
    const response=await post('checkout',{packageId:'creator'},lane);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.url,'https://tools.l3v.ai/?purchase=complete#logo');
    assert.equal(body.simulated,true);
    const record=JSON.parse(lane._kv.get('purchase:test:'+'a'.repeat(32)));
    assert.equal(record.packageId,'creator');
    assert.equal(record.mode,'test');
    const entitlement=await (await post('entitlement',{},lane)).json();
    assert.equal(entitlement.packageId,'creator');
    assert.equal(entitlement.appMode,'dev');
  }finally{globalThis.fetch=original}
});

test('dev checkout works with no Stripe configuration at all',async()=>{
  const lane=laneEnv('dev',{STRIPE_SECRET_KEY_TEST:'',STRIPE_WEBHOOK_SECRET_TEST:''});
  assert.equal((await post('checkout',{packageId:'studio'},lane)).status,200);
  const entitlement=await (await post('entitlement',{},lane)).json();
  assert.equal(entitlement.enabled,true,'Pay is offered without Stripe in dev');
});

test('test and uat go to Stripe test mode; dev, test and uat all refuse live keys',async()=>{
  const original=globalThis.fetch;
  let stripeCalled=false;
  globalThis.fetch=async url=>{stripeCalled=true;assert.match(String(url),/api\.stripe\.com/);return new Response(JSON.stringify({id:'cs_test_1',url:'https://checkout.stripe.com/c/pay/cs_test_1',status:'open'}),{status:200})};
  try{
    for(const mode of ['test','uat']){
      stripeCalled=false;
      const paid=await post('checkout',{packageId:'creator'},laneEnv(mode,{STRIPE_PRICE_CREATOR_TEST:'price_1'}));
      assert.equal(paid.status,200);
      assert.equal((await paid.json()).url,'https://checkout.stripe.com/c/pay/cs_test_1');
      assert.equal(stripeCalled,true,mode+' really goes to Stripe');
    }
    for(const mode of ['dev','test','uat']){
      const live=await post('checkout',{packageId:'creator'},laneEnv(mode,{STRIPE_MODE:'live',STRIPE_SECRET_KEY_LIVE:'sk_live_x',STRIPE_WEBHOOK_SECRET_LIVE:'whsec_live',STRIPE_PRICE_CREATOR_LIVE:'price_l',STRIPE_PRICE_STUDIO_LIVE:'price_m'}));
      assert.equal(live.status,503,mode+' refuses live keys');
    }
  }finally{globalThis.fetch=original}
});

test('uat generates for real: Turnstile verified and the gateway called',async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));if(/turnstile/.test(String(url)))return new Response(JSON.stringify({success:true,hostname:'tools.l3v.ai',action:'name_logo'}));return new Response(JSON.stringify({id:'f'.repeat(64)}),{status:200})};
  try{
    const response=await post('generate',{first:'John',last:'Smith',requestKey:'k',token:'tok',styleId:'soft-angular'},laneEnv('uat'));
    assert.equal(response.status,200);
    assert.ok(calls.some(url=>/turnstile/.test(url)),'Turnstile verified in uat');
    assert.ok(calls.some(url=>/gateway\.example/.test(url)),'gateway called in uat');
  }finally{globalThis.fetch=original}
});

test('test mode generates on the simulator like dev',async()=>{
  const original=globalThis.fetch;globalThis.fetch=noNetwork;
  try{
    const response=await post('generate',{first:'John',last:'Smith',requestKey:'k',token:'x',styleId:'soft-angular'},laneEnv('test'));
    assert.equal(response.status,200);
    assert.match((await response.json()).id,/^[a-f0-9]{64}$/);
  }finally{globalThis.fetch=original}
});

test('production still verifies Turnstile and calls the gateway',async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));if(/turnstile/.test(String(url)))return new Response(JSON.stringify({success:true,hostname:'tools.l3v.ai',action:'name_logo'}));return new Response(JSON.stringify({id:'f'.repeat(64)}),{status:200})};
  try{
    const response=await post('generate',{first:'John',last:'Smith',requestKey:'k',token:'tok',styleId:'soft-angular'},laneEnv('production'));
    assert.equal(response.status,200);
    assert.ok(calls.some(url=>/turnstile/.test(url)),'Turnstile verified');
    assert.ok(calls.some(url=>/gateway\.example/.test(url)),'gateway called');
  }finally{globalThis.fetch=original}
});

test('the switch: GET reads the stored mode over the deploy default, POST needs the owner key',async()=>{
  const kv=new Map();
  const lane={...base,APP_MODE:'production',INVITATION_ISSUER_SECRET:'owner-secret',INVITATIONS:{get:async key=>kv.get(key)??null,put:async(key,value)=>{kv.set(key,value)}}};
  const read=async()=>(await worker.fetch(new Request('https://tools.l3v.ai/api/mode'),lane)).json();
  assert.deepEqual(await read(),{mode:'production',switchable:true});
  const noKey=await worker.fetch(new Request('https://tools.l3v.ai/api/mode',{method:'POST',body:JSON.stringify({mode:'dev'})}),lane);
  assert.equal(noKey.status,404,'no key looks like no route');
  const wrongKey=await worker.fetch(new Request('https://tools.l3v.ai/api/mode',{method:'POST',headers:{Authorization:'Bearer nope'},body:JSON.stringify({mode:'dev'})}),lane);
  assert.equal(wrongKey.status,404);
  assert.equal((await read()).mode,'production','nothing changed');
  const bad=await worker.fetch(new Request('https://tools.l3v.ai/api/mode',{method:'POST',headers:{Authorization:'Bearer owner-secret'},body:JSON.stringify({mode:'staging'})}),lane);
  assert.equal(bad.status,400);
  const ok=await worker.fetch(new Request('https://tools.l3v.ai/api/mode',{method:'POST',headers:{Authorization:'Bearer owner-secret'},body:JSON.stringify({mode:'dev'})}),lane);
  assert.equal(ok.status,200);
  assert.deepEqual(await ok.json(),{mode:'dev'});
  assert.equal((await read()).mode,'dev','the stored mode wins over the deploy default');
  assert.equal(kv.get('app-mode'),'dev');
  const back=await worker.fetch(new Request('https://tools.l3v.ai/api/mode',{method:'POST',headers:{Authorization:'Bearer owner-secret'},body:JSON.stringify({mode:'production'})}),lane);
  assert.equal((await back.json()).mode,'production');
});

test('without an owner key configured the switch is not offered and the mode cannot be changed',async()=>{
  const kv=new Map();
  const lane={...base,APP_MODE:'uat',INVITATIONS:{get:async key=>kv.get(key)??null,put:async(key,value)=>{kv.set(key,value)}}};
  assert.deepEqual(await (await worker.fetch(new Request('https://tools.l3v.ai/api/mode'),lane)).json(),{mode:'uat',switchable:false});
  assert.equal((await (await worker.fetch(new Request('https://tools.l3v.ai/api/mode'),{...base,APP_MODE:'test'})).json()).mode,'test');
  const attempt=await worker.fetch(new Request('https://tools.l3v.ai/api/mode',{method:'POST',headers:{Authorization:'Bearer anything'},body:JSON.stringify({mode:'dev'})}),lane);
  assert.equal(attempt.status,404);
});

test('the stored mode drives the lane, not the deploy default',async()=>{
  const kv=new Map([['app-mode','dev']]);
  const original=globalThis.fetch;globalThis.fetch=noNetwork;
  try{
    const lane=laneEnv('production',{INVITATIONS:{get:async key=>kv.get(key)??null,put:async(key,value)=>{kv.set(key,value)},delete:async key=>{kv.delete(key)}}});
    const response=await post('generate',{first:'John',last:'Smith',requestKey:'k',token:'x',styleId:'soft-angular'},lane);
    assert.equal(response.status,200,'simulated although the deploy default is production');
  }finally{globalThis.fetch=original}
});

test('generation is gated at the edge: nine included, more only with an undelivered purchase',async()=>{
  const original=globalThis.fetch;globalThis.fetch=noNetwork;
  try{
    const lane=laneEnv('dev');
    const {id}=await (await post('generate',{first:'John',last:'Smith',requestKey:'k',token:'x',styleId:'soft-angular'},lane)).json();
    const {designs}=await (await post('status',{id},lane)).json();
    const design=designs[0].id;
    const templates=['upper-arm-tattoo','canvas-tote','backpack','baseball-cap','beanie','leather-wallet','phone-case','keychain','luggage-tag','t-shirt','hoodie'];
    for(const template of templates.slice(0,5)){
      assert.equal((await post('visualization-generate',{designId:design,template},lane)).status,200,template);
    }
    const again=await post('visualization-generate',{designId:design,template:'beanie'},lane);
    assert.equal(again.status,200,'an existing pair is free');
    const tenth=await post('visualization-generate',{designId:design,template:templates[5]},lane);
    assert.equal(tenth.status,403,'the sixth needs a purchase');
    const body=await tenth.json();
    assert.equal(body.gated,true);assert.equal(body.reason,'included-used');assert.equal(body.used,5);assert.equal(body.allowance,5);
    assert.equal((await post('checkout',{packageId:'creator'},lane)).status,200,'dev purchase');
    assert.equal((await post('visualization-generate',{designId:design,template:templates[5]},lane)).status,200,'paid: allowed');
    const entitlement=await (await post('entitlement',{},lane)).json();
    assert.equal(entitlement.packageId,'creator');
    await post('fulfil',{},lane);
    const after=await post('visualization-generate',{designId:design,template:templates[10]},lane);
    assert.equal(after.status,403,'delivered: no longer entitles');
    assert.equal((await after.json()).reason,'included-used');
  }finally{globalThis.fetch=original}
});

test('production gates from the gateway list, not from anything the client sends',async()=>{
  const original=globalThis.fetch;
  const names=['apron','backpack','beanie','envelope','hoodie-a','keychain','notebook','scarf','socks'];
  const nine=names.map((template,i)=>({id:String(i),status:'succeeded',output:{template,sourceDesignId:'e'.repeat(32)}}));
  let generateCalls=0;
  globalThis.fetch=async(url,init)=>{
    const path=String(url);
    if(/visualization-list/.test(path))return new Response(JSON.stringify({visualizations:nine}),{status:200});
    if(/visualization-generate/.test(path)){generateCalls++;return new Response(JSON.stringify({id:'f'.repeat(32),status:'queued'}),{status:200})}
    return new Response('{}',{status:200});
  };
  try{
    const lane=laneEnv('production');
    const blocked=await post('visualization-generate',{designId:'e'.repeat(32),template:'t-shirt'},lane);
    assert.equal(blocked.status,403);
    assert.equal(generateCalls,0,'the gateway was never asked');
    const existing=await post('visualization-generate',{designId:'e'.repeat(32),template:'beanie'},lane);
    assert.equal(existing.status,200,'re-asking for an existing job passes through');
  }finally{globalThis.fetch=original}
});

test('studio clips: gated on the purchase, two per identity, delivered into the bundle',async()=>{
  const original=globalThis.fetch;globalThis.fetch=noNetwork;
  const realNow=Date.now;let offset=0;Date.now=()=>realNow.call(Date)+offset;
  const ftyp=new Uint8Array([0,0,0,0x18,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0]);
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
  try{
    const lane=laneEnv('dev',{ASSETS:{fetch:async req=>new Response(String(req.url).endsWith('.mp4')?ftyp:png,{status:200})}});
    const {id}=await (await post('generate',{first:'John',last:'Smith',requestKey:'k',token:'x',styleId:'soft-angular'},lane)).json();
    const {designs}=await (await post('status',{id},lane)).json();
    const design=designs[0].id;
    // Before any purchase, and with Creator, clips are refused.
    const none=await post('visualization-video',{id:'e'.repeat(32)},lane);
    assert.equal(none.status,403);assert.equal((await none.json()).reason,'no-video-package');
    assert.equal((await post('checkout',{packageId:'studio'},lane)).status,200,'dev purchase of studio');
    const previews=[];
    for(const template of ['hot-air-balloon','city-bus','boat-sail','candle-jar']){
      const made=await post('visualization-generate',{designId:design,template},lane);
      assert.equal(made.status,200,template);previews.push((await made.json()).id);
    }
    offset+=20000;  // previews land
    const first=await post('visualization-video',{id:previews[0]},lane);
    assert.equal(first.status,200);const firstBody=await first.json();assert.equal(firstBody.status,'queued');
    const again=await post('visualization-video',{id:previews[0]},lane);
    assert.equal((await again.json()).id,firstBody.id,'same preview is the same clip, not a second one');
    assert.equal((await post('visualization-video',{id:previews[1]},lane)).status,200);
    const third=await post('visualization-video',{id:previews[2]},lane);
    assert.equal(third.status,403);assert.equal((await third.json()).reason,'videos-complete');
    const record=JSON.parse(lane._kv.get('purchase:test:'+'a'.repeat(32)));
    assert.equal(record.videos.length,2,'the purchase remembers its two clips');
    const soon=await (await post('visualization-video-status',{id:firstBody.id},lane)).json();
    assert.notEqual(soon.status,'succeeded');
    offset+=10000;  // clips land
    const done=await (await post('visualization-video-status',{id:firstBody.id},lane)).json();
    assert.equal(done.status,'succeeded');assert.match(done.video,/\/assets\/identity-subjects\/demo\/clips\/logo\.mp4$/);
    // The bundle is stored per invitation account, so the call carries one.
    const credential='x'.repeat(43),accountId=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(credential))),b=>b.toString(16).padStart(2,'0')).join('');
    lane._kv.set('token:'+accountId,accountId);
    const built=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/bundle-build',{method:'POST',headers:{...access,'X-L3V-Invitation':credential},body:JSON.stringify({name:'John Smith'})}),lane);
    assert.equal(built.status,200,'bundle: '+JSON.stringify(await built.clone().json()));
    assert.equal((await built.json()).count,4+2,'four images and two clips in the bundle');
    await post('fulfil',{},lane);
    const after=await post('visualization-video',{id:previews[3]},lane);
    assert.equal((await after.json()).reason,'no-video-package','delivered entitles no more clips');
  }finally{globalThis.fetch=original;Date.now=realNow}
});

test('in a simulated lane, a read the simulator does not know falls through to the gateway',async()=>{
  const original=globalThis.fetch;
  const calls=[];
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
  globalThis.fetch=async(url)=>{calls.push(String(url));if(/visualization-image/.test(String(url)))return new Response(png,{status:200});if(/visualization-list/.test(String(url)))return new Response(JSON.stringify({visualizations:[{id:'a'.repeat(32),status:'succeeded',output:{template:'socks'}}]}),{status:200});return new Response('{}',{status:404})};
  try{
    const lane=laneEnv('dev');
    const image=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/visualization-image?id='+'a'.repeat(32),{headers:access}),lane);
    assert.equal(image.status,200,'a real identity\'s preview is served in dev');
    assert.ok(calls.some(url=>/gateway\.example\/name-logo\/visualization-image/.test(url)),'the gateway answered the read');
    const list=await (await post('visualization-list',{},lane)).json();
    assert.equal(list.visualizations.length,1,'the real list is shown when the simulator has nothing');
    calls.length=0;
    await post('visualization-generate',{designId:'b'.repeat(32),template:'socks'},lane);
    assert.ok(!calls.some(url=>/visualization-generate/.test(url)),'generation never falls through to the gateway');
  }finally{globalThis.fetch=original}
});
