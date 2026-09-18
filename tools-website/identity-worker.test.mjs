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
test('opaque invitation links activate access and keep certificates private',async()=>{
  const slug='a'.repeat(43),account='d'.repeat(64),tokenHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(slug)),hash=Array.from(new Uint8Array(tokenHash),b=>b.toString(16).padStart(2,'0')).join(''),qr=new Uint8Array([137,80,78,71]).buffer,store={get:(key,options)=>key===`share-data:${slug}`?JSON.stringify({id:'002',phrase:'velvet penguin moonlight'}):key===`share-qr:${slug}`&&options?.type==='arrayBuffer'?qr:key===`token:${hash}`?account:null};
  const page=await worker.fetch(new Request(`https://tools.l3v.ai/invite/${slug}`),{INVITATIONS:store});
  assert.equal(page.status,200);assert.match(page.headers.get('Cache-Control'),/no-store/);assert.match(page.headers.get('X-Robots-Tag'),/noindex/);const html=await page.text();assert.match(html,/l3v-master-access-v1/);assert.match(html,/Enter private tools/);assert.match(html,/Copy invitation link/);assert.match(html,/Copy three-word secret/);assert.doesNotMatch(html,/location\.replace|certificate\.svg/);assert.equal((html.match(/<img\b/g)||[]).length,1);assert.match(html,new RegExp(account));
  const image=await worker.fetch(new Request(`https://tools.l3v.ai/invite/${slug}/qr.png`),{INVITATIONS:store});
  assert.equal(image.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),new Uint8Array(qr));
  assert.equal((await worker.fetch(new Request('https://tools.l3v.ai/invite/'+'b'.repeat(43)),{INVITATIONS:store})).status,404);
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

test('visualization requests preserve receipt ownership and source design id',async()=>{
 const original=globalThis.fetch;let sent;
 globalThis.fetch=async(url,init)=>{sent={url:String(url),body:JSON.parse(init.body)};return Response.json({id:'f'.repeat(32),status:'queued'})};
 try{
  const request=new Request('https://tools.l3v.ai/api/name-logo/visualization-generate',{method:'POST',headers:{Origin:'https://tools.l3v.ai','X-L3V-Request-Id':'a'.repeat(32),'X-L3V-Request-Receipt':'b'.repeat(64)},body:JSON.stringify({designId:'c'.repeat(32),template:'storefront'})});
  const response=await worker.fetch(request,env);assert.equal(response.status,200);assert.equal(sent.body.designId,'c'.repeat(32));assert.equal(sent.body.template,'storefront');assert.equal(sent.body.access.receipt,'b'.repeat(64));assert.match(sent.url,/visualization-generate$/);
 }finally{globalThis.fetch=original}
});

test('visualization image is private and returned as PNG',async()=>{
 const original=globalThis.fetch;const png=Uint8Array.from([137,80,78,71,13,10,26,10,1]);
 globalThis.fetch=async()=>new Response(png,{headers:{'Content-Type':'image/png'}});
 try{
  const request=new Request('https://tools.l3v.ai/api/name-logo/visualization-image?id='+'d'.repeat(32),{headers:{'X-L3V-Request-Id':'a'.repeat(32),'X-L3V-Request-Receipt':'b'.repeat(64)}});
  const response=await worker.fetch(request,env);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');assert.match(response.headers.get('Content-Disposition'),/visualization\.png/);
 }finally{globalThis.fetch=original}
});

const access={'X-L3V-Request-Id':'a'.repeat(32),'X-L3V-Request-Receipt':'b'.repeat(64),Origin:'https://tools.l3v.ai','Content-Type':'application/json'};
const stripeEnv=extra=>({...env,INVITATIONS:{get:async()=>null,put:async()=>{}},STRIPE_MODE:'test',STRIPE_SECRET_KEY_TEST:'sk_test_x',STRIPE_WEBHOOK_SECRET_TEST:'whsec_x',STRIPE_PRICE_CREATOR_TEST:'prod_VGlCLdY36qCuNk',STRIPE_PRICE_STUDIO_TEST:'prod_VGlEbR2n1CQJ5v',...extra});

test('entitlement answers the POST the client actually sends',async()=>{
  // The shared call() helper always POSTs. Declaring this action GET made it
  // answer 405, the UI swallowed the error, and paid packages rendered as
  // "Payment setup in progress" despite Stripe being fully configured.
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/entitlement',{method:'POST',headers:access,body:'{}'}),stripeEnv());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.enabled,true);
  assert.equal(body.mode,'test');
  assert.equal(body.packageId,null);
});

test('entitlement reports checkout disabled while a Stripe value is missing',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/entitlement',{method:'POST',headers:access,body:'{}'}),stripeEnv({STRIPE_WEBHOOK_SECRET_TEST:''}));
  assert.equal((await response.json()).enabled,false);
});

test('entitlement reports the live mode when the toggle is flipped',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/entitlement',{method:'POST',headers:access,body:'{}'}),stripeEnv({STRIPE_MODE:'live',STRIPE_SECRET_KEY_LIVE:'sk_live_x',STRIPE_WEBHOOK_SECRET_LIVE:'whsec_y',STRIPE_PRICE_CREATOR_LIVE:'prod_VGkCE5W13sNS4G',STRIPE_PRICE_STUDIO_LIVE:'prod_VGkF4LVYuX77ch'}));
  const body=await response.json();
  assert.equal(body.mode,'live');
  assert.equal(body.enabled,true);
});

test('checkout refuses a package that is not paid for',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/checkout',{method:'POST',headers:access,body:JSON.stringify({packageId:'free'})}),stripeEnv());
  assert.equal(response.status,400);
});

test('checkout requires a request receipt',async()=>{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/checkout',{method:'POST',headers:{Origin:'https://tools.l3v.ai','Content-Type':'application/json'},body:JSON.stringify({packageId:'creator'})}),stripeEnv());
  assert.equal(response.status,404);
});

test('listing stored bundles needs the invitation, not a request receipt',async()=>{
  // It is scoped by account. Requiring a per-request receipt made the library
  // answer 404 for a client that correctly sent none.
  const env={...stripeEnv(),INVITATION_ONLY:'true',IDENTITY_BUNDLES:{list:async()=>({objects:[]})}};
  const invited=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/bundle-list',{method:'POST',headers:{Origin:'https://tools.l3v.ai','Content-Type':'application/json'},body:'{}'}),
    {...env,INVITATIONS:{get:async()=>'d'.repeat(64),put:async()=>{}}});
  assert.notEqual(invited.status,404,'a receipt must not be demanded');
});

test('the bundle listing asks R2 for custom metadata',async()=>{
  // Without include:['customMetadata'] R2 returns the objects but no metadata,
  // so every stored bundle reported a count of 0 and an empty name.
  const token='d'.repeat(43),account='e'.repeat(64);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  let options;
  const env={...stripeEnv(),
    INVITATIONS:{get:async key=>key===`token:${hash}`?account:null,put:async()=>{}},
    IDENTITY_BUNDLES:{list:async o=>{options=o;return {objects:[{key:`bundles/${account}/b.zip`,size:12,uploaded:'2026-01-01T00:00:00Z',
      customMetadata:{requestId:'b'.repeat(32),name:'Someone',count:'10',createdAt:'2026-01-01T00:00:00Z'}}]}}}};
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/bundle-list',
    {method:'POST',headers:{Origin:'https://tools.l3v.ai','Content-Type':'application/json','X-L3V-Invitation':token},body:'{}'}),env);
  assert.equal(response.status,200);
  assert.ok(options?.include?.includes('customMetadata'),'must request customMetadata');
  const {bundles}=await response.json();
  assert.equal(bundles[0].count,10);
  assert.equal(bundles[0].name,'Someone');
});

test('visualization status accepts only the id field',async()=>{
  // The automatic previews sent {id, jobId}. The edge compares the key list
  // against exactly "id", so every poll answered 400 and nine perfectly good
  // previews were reported as failed.
  const body=JSON.stringify({id:'a'.repeat(32),jobId:'a'.repeat(32)});
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/visualization-status',
    {method:'POST',headers:access,body}),stripeEnv());
  assert.equal(response.status,400);
  assert.deepEqual(await response.json(),{error:'Invalid visualization'});
});

test('entitlement shows a delivered purchase as delivered, not as unpaid',async()=>{
  // After delivery the purchase must not entitle, but a reload has to know the
  // identity is finished. Hiding the record entirely made the page offer the
  // bought package for sale again and lose the Download button.
  const record={packageId:'creator',mode:'test',paidAt:'2026-09-16T19:59:27.402Z',fulfilledAt:'2026-09-16T20:30:00.000Z',downloadedAt:null,downloadCount:0};
  const kv={get:async key=>key==='purchase:test:'+'a'.repeat(32)?JSON.stringify(record):null,put:async()=>{}};
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/entitlement',{method:'POST',headers:access,body:'{}'}),stripeEnv({INVITATIONS:kv}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.packageId,null,'a delivered purchase does not entitle');
  assert.equal(body.fulfilledAt,record.fulfilledAt);
  assert.equal(body.fulfilledPackageId,'creator');
});

test('entitlement still entitles an undelivered purchase',async()=>{
  const record={packageId:'studio',mode:'test',paidAt:'2026-09-16T19:59:27.402Z'};
  const kv={get:async key=>key==='purchase:test:'+'a'.repeat(32)?JSON.stringify(record):null,put:async()=>{}};
  const body=await (await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/entitlement',{method:'POST',headers:access,body:'{}'}),stripeEnv({INVITATIONS:kv}))).json();
  assert.equal(body.packageId,'studio');
  assert.equal(body.fulfilledAt,null);
  assert.equal(body.fulfilledPackageId,null);
});

test('a loaded real-lane preview joins the shared latest-generations feed and is served back',async()=>{
 const original=globalThis.fetch;const png=Uint8Array.from([137,80,78,71,13,10,26,10,1]);
 const kv=new Map(),r2=new Map();
 const feedEnv={...env,APP_MODE:'live',INVITATIONS:{get:async k=>kv.get(k)??null,put:async(k,v)=>{kv.set(k,v)}},IDENTITY_BUNDLES:{put:async(k,v,o)=>{r2.set(k,{body:v,httpMetadata:o?.httpMetadata})},get:async k=>r2.get(k)??null}};
 globalThis.fetch=async(url)=>String(url).includes('visualization-status')?Response.json({status:'succeeded',output:{template:'baseball-cap'}}):new Response(png,{headers:{'Content-Type':'image/png'}});
 try{
  const headers={'X-L3V-Request-Id':'a'.repeat(32),'X-L3V-Request-Receipt':'b'.repeat(64)};
  assert.equal((await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/visualization-image?id='+'d'.repeat(32),{headers}),feedEnv)).status,200);
  const list=await (await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/recent'),feedEnv)).json();
  assert.equal(list.items.length,1);assert.equal(list.items[0].template,'baseball-cap');assert.equal(list.items[0].url,'/api/name-logo/recent-image?id='+'d'.repeat(32));
  const image=await worker.fetch(new Request('https://tools.l3v.ai'+list.items[0].url),feedEnv);
  assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');
  assert.equal((await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/recent-image?id=nope'),feedEnv)).status,400);
  assert.equal((await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/recent-image?id='+'e'.repeat(32)),feedEnv)).status,404);
  assert.equal((await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/recent',{method:'POST'}),feedEnv)).status,405);
 }finally{globalThis.fetch=original}
});

test('a rejected request carries the gateway reason back to the page, not a generic sentence',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({error:'Invalid fields'},{status:400});
 try{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/status',{method:'POST',headers:access,body:JSON.stringify({id:'d'.repeat(64)})}),env);
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'Invalid fields');
 }finally{globalThis.fetch=original}
});

test('an unsafe upstream body never reaches the page',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({error:'Traceback /opt/l3v-name-logo/x.py line 3 <script>'},{status:400});
 try{
  const response=await worker.fetch(new Request('https://tools.l3v.ai/api/name-logo/status',{method:'POST',headers:access,body:JSON.stringify({id:'d'.repeat(64)})}),env);
  assert.equal((await response.json()).error,'The design service could not complete this request');
 }finally{globalThis.fetch=original}
});
