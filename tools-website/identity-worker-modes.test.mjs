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
  assert.deepEqual(await (await worker.fetch(new Request('https://tools.l3v.ai/api/mode'),{...base,INVITATION_ONLY:'true'})).json(),{mode:'production'});
  assert.deepEqual(await (await worker.fetch(new Request('https://tools.l3v.ai/api/mode'),{...base,APP_MODE:'dev'})).json(),{mode:'dev'});
  assert.deepEqual(await (await worker.fetch(new Request('https://tools.l3v.ai/api/mode'),{...base,APP_MODE:'uat'})).json(),{mode:'uat'});
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

test('uat goes to Stripe test mode; neither dev nor uat will run on live keys',async()=>{
  const original=globalThis.fetch;
  let stripeCalled=false;
  globalThis.fetch=async url=>{stripeCalled=true;assert.match(String(url),/api\.stripe\.com/);return new Response(JSON.stringify({id:'cs_test_1',url:'https://checkout.stripe.com/c/pay/cs_test_1',status:'open'}),{status:200})};
  try{
    const uat=await post('checkout',{packageId:'creator'},laneEnv('uat',{STRIPE_PRICE_CREATOR_TEST:'price_1'}));
    assert.equal(uat.status,200);
    assert.equal((await uat.json()).url,'https://checkout.stripe.com/c/pay/cs_test_1');
    assert.equal(stripeCalled,true,'uat really goes to Stripe');
    for(const mode of ['dev','uat']){
      const live=await post('checkout',{packageId:'creator'},laneEnv(mode,{STRIPE_MODE:'live',STRIPE_SECRET_KEY_LIVE:'sk_live_x',STRIPE_WEBHOOK_SECRET_LIVE:'whsec_live',STRIPE_PRICE_CREATOR_LIVE:'price_l',STRIPE_PRICE_STUDIO_LIVE:'price_m'}));
      assert.equal(live.status,503,mode+' refuses live keys');
    }
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
