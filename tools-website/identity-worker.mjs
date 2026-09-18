import videoWorker from './video-worker.mjs';
import {invitationAccount} from './invitation-worker.mjs';
import {issueInvitation} from './invitation-issuer.mjs';
import {invitationShare} from './invitation-share.mjs';
import {buildBundle,listBundles,getBundle} from './bundle-store.mjs';
import {resolveAppMode,storeAppMode,MODES,simulated as isSimulated,paymentSimulated} from './app-mode.mjs';
import {simulatedCaller,simulatedResponse} from './simulated-gateway.mjs';
import {gateVisualization} from './generation-allowance.mjs';
import {VIDEO_SETTINGS,gateVideo,attachVideo} from './identity-videos.mjs';
import {simulate,siteAssets} from './simulated-gateway.mjs';
import {createCheckoutSession,verifyWebhookForModes,recordPurchase,purchaseFor,markDownloaded,markFulfilled,clearPurchase,checkoutReady,stripeConfig,webhookSecrets,PAID_PACKAGES} from './stripe-checkout.mjs';
const json = (value, status=200, headers={}) => Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
async function signature(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
async function ownerAuthorized(request, secret) {
  const supplied = request.headers.get('Authorization') || '';
  if (!secret || !supplied.startsWith('Bearer ')) return false;
  const digest = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return await digest(supplied.slice(7)) === await digest(secret);
}
// Studio clips. The backend route rides the identity request's own receipt;
// dev and test answer from the simulator on its own clock.
async function identityVideo(env,{mode,action,access,account,origin,id,traceId}){
  const create=action==='visualization-video';
  if(isSimulated(mode)){
    const result=await simulate(env.IDENTITY_BUNDLES,siteAssets(env,origin),{action,payload:{access,id}});
    if(result.status>=300)return {error:result.json?.error||'Video unavailable',status:result.status};
    return {id:result.json.job.id,status:result.json.job.status,video:result.json.video||null,error:result.json.error||null};
  }
  if(!env.HERMES_URL||!env.HERMES_TOKEN)return {error:'Video generation is not available yet',status:503};
  const target=new URL(env.HERMES_URL);if(target.protocol!=='https:')return {error:'Video generation is not available yet',status:503};
  target.pathname=create?'/identity-video':'/identity-video-status';target.search='';target.hash='';
  const body=create?{access,visualizationId:id,...VIDEO_SETTINGS,...(account&&{accountId:account})}:{access,id};
  const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.HERMES_TOKEN,'X-L3V-Trace-Id':traceId},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>({}));
  console.log(JSON.stringify({event:'name-logo.video-request',action,status:response.status,traceId}));
  if(response.status===429)return {error:'Video limit reached',status:429};
  if(response.status===404)return {error:'Video not found or expired',status:404};
  if(response.status===503)return {error:'Video generation is not available yet',status:503};
  if(response.status>=400)return {error:'This preview cannot become a video',status:400};
  if(!data.job?.id)return {error:'Video unavailable',status:502};
  const diagnostic=safeDiagnostic(data.diagnostic);
  if(diagnostic&&!['queued','running','succeeded'].includes(data.job.status))console.log(JSON.stringify({event:'name-logo.job-failed',kind:'video',jobId:data.job.id,status:data.job.status,...diagnostic,traceId}));
  return {id:data.job.id,status:data.job.status,video:typeof data.video==='string'?data.video:null,error:data.error||null,diagnostic};
}
// What a failed job says about itself, limited to the allowlisted fields.
function safeDiagnostic(value){
  if(!value||typeof value!=='object')return null;
  const out={};
  for(const key of ['code','stage','traceId','reason','detail']){const v=value[key];if(typeof v==='string'&&v.length<=200)out[key]=v}
  return Object.keys(out).length?out:null;
}
// Failed designs and previews in a status body are logged once per response.
async function logReportedFailures(response,action,traceId){
  if(!response.ok||!['status','visualization-status'].includes(action))return;
  try{
    const data=await response.clone().json();
    const items=action==='status'?(data.designs||[]).map(d=>({kind:'design',jobId:d.id,status:d.status,diagnostic:d.diagnostic})):[{kind:'preview',jobId:data.id,status:data.status,diagnostic:data.diagnostic}];
    for(const item of items){
      if(['queued','running','succeeded','waiting'].includes(item.status)||!item.status)continue;
      console.log(JSON.stringify({event:'name-logo.job-failed',kind:item.kind,jobId:item.jobId,status:item.status,...(safeDiagnostic(item.diagnostic)||{code:'no-diagnostic'}),traceId}));
    }
  }catch{}
}
// A delivered clip, as bytes, for the bundle. Simulated clips are site assets;
// real ones come from the media host and nowhere else.
async function fetchClip(env,origin,video){
  try{
    let response;
    if(video.startsWith('/'))response=await env.ASSETS.fetch(new Request(new URL(video,origin)));
    else{if(!env.VIDEO_OUTPUT_BASE_URL||!video.startsWith(String(env.VIDEO_OUTPUT_BASE_URL).replace(/\/$/,'')+'/'))return {reason:'untrusted-host'};response=await fetch(video,{redirect:'manual',signal:AbortSignal.timeout(60000)});}
    if(!response.ok)return {reason:'http-'+response.status};
    const bytes=await bounded(response,25*1024*1024);
    if(bytes.length<12||String.fromCharCode(...bytes.slice(4,8))!=='ftyp')return {reason:'not-mp4'};
    return {bytes};
  }catch(error){return {reason:'fetch-failed:'+String(error?.message||error).slice(0,80)}}
}
async function bounded(response, limit) {
  if (!response.body) throw new Error('Missing body');
  const reader=response.body.getReader(), chunks=[]; let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Too large')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
}
// One call into the private gateway, so the bundle builder does not need to
// know about tokens, tracing or transport.
function gatewayCaller(env, traceId, requestId) {
  return async (action, payload, binary = false) => {
    const upstream = new URL(env.NAME_LOGO_URL);
    if (upstream.protocol !== 'https:') throw new Error('Invalid gateway');
    upstream.pathname = '/name-logo/' + action; upstream.search = '';
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + env.NAME_LOGO_TOKEN,
        'X-L3V-Trace-Id': traceId, ...(requestId ? {'X-L3V-Request-Id': requestId} : {})},
      body: JSON.stringify(payload), redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    const bytes = await bounded(response, binary ? 25 * 1024 * 1024 : 150000);
    return binary ? bytes : JSON.parse(new TextDecoder().decode(bytes));
  };
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url), prefix='/api/name-logo/';
    if(url.pathname.startsWith('/invite/'))return invitationShare(request,env);
    if(url.pathname==='/api/admin/invitations')return issueInvitation(request,env);
    if(url.pathname==='/api/name-logo/stripe-webhook'){
      if(request.method!=='POST')return json({error:'Invalid method'},405);
      const secrets=webhookSecrets(env);
      if((!secrets.test&&!secrets.live)||!env.INVITATIONS)return json({error:'Not found'},404);
      const raw=new TextDecoder().decode(await bounded(request,65536));
      // Both Stripe endpoints post here; the signature says which mode sent it.
      const verified=await verifyWebhookForModes(raw,request.headers.get('Stripe-Signature'),secrets);
      if(!verified){console.warn(JSON.stringify({event:'name-logo.stripe-webhook-rejected'}));return json({error:'Invalid signature'},400)}
      if(verified.event.type==='checkout.session.completed'){
        const stored=await recordPurchase(env.INVITATIONS,verified.event.data?.object||{},verified.mode);
        console.log(JSON.stringify({event:'name-logo.purchase-recorded',packageId:stored?.packageId||'',mode:verified.mode,recorded:Boolean(stored)}));
      }
      // Anything else is acknowledged so Stripe stops retrying an event we do not act on.
      return json({received:true});
    }
    // The lane the whole site is on. Public: the watermark needs it before
    // an invitation is entered, and the value itself reveals nothing.
    const mode=await resolveAppMode(env);const lane=mode;
    if(url.pathname==='/api/mode'){
      if(request.method==='GET')return json({mode,switchable:Boolean(env.INVITATIONS&&env.INVITATION_ISSUER_SECRET)});
      if(request.method!=='POST')return json({error:'Invalid method'},405);
      // Switching lanes is the owner's call: the same key that issues
      // invitations. A wrong key gets the same answer as a missing route.
      if(!env.INVITATIONS||!env.INVITATION_ISSUER_SECRET||!await ownerAuthorized(request,env.INVITATION_ISSUER_SECRET))return json({error:'Not found'},404);
      let wanted;try{wanted=JSON.parse(new TextDecoder().decode(await bounded(request,1024)))?.mode}catch{}
      if(!MODES.includes(wanted))return json({error:'Choose dev, uat or production'},400);
      const stored=await storeAppMode(env,wanted);
      console.log(JSON.stringify({event:'app-mode.switched',from:mode,to:stored}));
      return json({mode:stored});
    }
    const api=url.pathname.startsWith('/api/');
    const account=api?await invitationAccount(request,env):null;
    if(url.pathname==='/api/invitation/validate'){
      const ip=request.headers.get('CF-Connecting-IP');
      if(env.INVITATION_LIMITER&&(!ip||!(await env.INVITATION_LIMITER.limit({key:ip})).success))return json({error:'Please wait before trying again'},429);
      return account?json({valid:true,accountId:account}):json({error:'Invitation required'},403);
    }
    if(url.pathname==='/api/account/work'){
      if(!account)return json({error:'Invitation required'},403);
      const target=new URL(env.HERMES_URL);target.pathname='/account/work';target.search='';target.hash='';
      const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.HERMES_TOKEN},body:JSON.stringify({accountId:account}),redirect:'manual',signal:AbortSignal.timeout(15000)});
      if(!response.ok)return json({error:'Work index unavailable'},503);
      return json(JSON.parse(new TextDecoder().decode(await bounded(response,250000))));
    }
    if(url.pathname==='/api/account/claim'){
      if(!account)return json({error:'Invitation required'},403);
      if(request.method!=='POST')return json({error:'Invalid method'},405);
      const requestId=request.headers.get('X-L3V-Request-Id'),receipt=request.headers.get('X-L3V-Request-Receipt');
      if(!/^[a-f0-9]{32}$/.test(requestId||'')||!/^[a-f0-9]{64}$/.test(receipt||''))return json({error:'Request not found or expired'},404);
      const target=new URL(env.HERMES_URL);target.pathname='/account/claim';target.search='';target.hash='';
      const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.HERMES_TOKEN},body:JSON.stringify({accountId:account,access:{requestId,receipt}}),redirect:'manual',signal:AbortSignal.timeout(15000)});
      if(!response.ok)return json({error:'Request not found or expired'},response.status===404?404:503);
      return json({claimed:true});
    }
    if(api&&env.INVITATION_ONLY==='true'&&!account)return json({error:'Invitation required'},403);
    if(['/api/analyzer/config','/api/analyze','/api/first-frame','/api/image-to-video','/api/jobs','/api/capacity-status'].includes(url.pathname)) return videoWorker.fetch(request,env);
    if(!url.pathname.startsWith(prefix)) return env.ASSETS.fetch(request);
    const action=url.pathname.slice(prefix.length);
    if(!['catalog','health','generate','status','image','visualization-generate','visualization-status','visualization-list','visualization-image','checkout','entitlement','downloaded','fulfil','purchase-reset','bundle-build','bundle-list','bundle','visualization-video','visualization-video-status'].includes(action)) return json({error:'Not found'},404);
    if(isSimulated(mode)&&!env.IDENTITY_BUNDLES)return json({error:'Simulation storage is not configured'},503);
    const ready=env.NAME_LOGO_ENABLED==='true' && env.NAME_LOGO_RECEIPTS_READY==='true' && env.NAME_LOGO_URL && env.NAME_LOGO_TOKEN && env.NAME_LOGO_SESSION_SECRET && env.TURNSTILE_SECRET && env.TURNSTILE_SITEKEY && env.NAME_LOGO_LIMITER;
    if(!ready) return action==='catalog' ? json({enabled:false,styles:[]}) : json({error:'Name generation is not available yet'},503);
    if(request.method !== (['catalog','health','image','visualization-image','bundle'].includes(action)?'GET':'POST'))return json({error:'Invalid method'},405);
    if(request.method==='POST' && request.headers.get('Origin')!==url.origin)return json({error:'Open the form on this website'},403);
    try {
      const access={requestId:request.headers.get('X-L3V-Request-Id'),receipt:request.headers.get('X-L3V-Request-Receipt')};
      // bundle-list is scoped by the invitation account, not by one request, so it
      // carries no request receipt and must not be held to that check.
      if(!['catalog','health','bundle-list'].includes(action) && (!/^[a-f0-9]{32}$/.test(access.requestId||'') || !/^[a-f0-9]{64}$/.test(access.receipt||''))) return json({error:'Request not found or expired'},404);
      let body={};
      if(request.method==='POST')body=JSON.parse(new TextDecoder().decode(await bounded(request,16384)));
      if(!body || typeof body!=='object' || Array.isArray(body))return json({error:'Invalid request'},400);
      const traceId=crypto.randomUUID().replaceAll('-','');
      if(action==='purchase-reset'){
        const mode=stripeConfig(env).mode;
        if(mode!=='test')return json({error:'A completed purchase cannot be cleared'},403);
        const cleared=env.INVITATIONS?await clearPurchase(env.INVITATIONS,access.requestId,mode):false;
        console.log(JSON.stringify({event:'name-logo.purchase-reset',mode,cleared}));
        return json({cleared});
      }
      if(action==='fulfil'){
        const mode=stripeConfig(env).mode;
        const record=env.INVITATIONS?await markFulfilled(env.INVITATIONS,access.requestId,mode):null;
        console.log(JSON.stringify({event:'name-logo.purchase-fulfilled',packageId:record?.packageId||'',mode,fulfilled:Boolean(record)}));
        return json({fulfilled:Boolean(record),fulfilledAt:record?.fulfilledAt||null});
      }
      if(action==='downloaded'){
        const mode=stripeConfig(env).mode;
        const record=env.INVITATIONS?await markDownloaded(env.INVITATIONS,access.requestId,mode):null;
        console.log(JSON.stringify({event:'name-logo.bundle-downloaded',packageId:record?.packageId||'',mode,recorded:Boolean(record)}));
        return json({recorded:Boolean(record)});
      }
      if(['bundle-build','bundle-list','bundle'].includes(action)){
        if(!env.IDENTITY_BUNDLES)return json({error:'Bundle storage is not configured'},503);
        if(!account)return json({error:'Invitation required'},403);
        if(action==='bundle-list')return json({bundles:await listBundles(env,account)});
        if(action==='bundle'){
          const wanted=url.searchParams.get('request')||access.requestId;
          const object=await getBundle(env,account,wanted);
          if(!object)return json({error:'Bundle not found'},404);
          return new Response(object.body,{headers:{'Content-Type':'application/zip','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
            'Content-Disposition':`attachment; filename="${(object.customMetadata?.name||'identity').replace(/[^a-zA-Z0-9-]/g,'-').slice(0,40)||'identity'}-bundle.zip"`}});
        }
        if(Object.keys(body).some(key=>!['name','designs'].includes(key)))return json({error:'Invalid fields'},400);
        const designs=Array.isArray(body.designs)?body.designs.filter(item=>item&&/^[a-f0-9]{32}$/.test(item.id||'')&&['logo','initials','signature'].includes(item.mode)).slice(0,3):[];
        const purchaseRecord=env.INVITATIONS?await purchaseFor(env.INVITATIONS,access.requestId,stripeConfig(env).mode,{includeFulfilled:true}):null;
        const clips=async()=>{const out=[];for(const [index,item] of (purchaseRecord?.videos||[]).entries()){
          const state=await identityVideo(env,{mode,action:'visualization-video-status',access,account,origin:url.origin,id:item.jobId,traceId});
          const fetched=state.status==='succeeded'&&state.video?await fetchClip(env,url.origin,state.video):null;
          console.log(JSON.stringify({event:'name-logo.bundle-clip',index:index+1,status:state.status||null,hasVideo:Boolean(state.video),bytes:fetched?.bytes?.length||0,reason:fetched?.reason||null,traceId}));
          if(fetched?.bytes)out.push({name:`video-${index+1}.mp4`,bytes:fetched.bytes});
        }return out};
        const built=await buildBundle(env,{accountId:account,requestId:access.requestId,receipt:access.receipt,name:body.name,clips,designs,
          gateway:isSimulated(mode)?simulatedCaller(env,url.origin):gatewayCaller(env,traceId,access.requestId)});
        console.log(JSON.stringify({event:'name-logo.bundle-stored',stored:Boolean(built),count:built?.count||0,traceId}));
        if(!built)return json({error:'Nothing to bundle yet'},409);
        return json({stored:true,count:built.count,bytes:built.bytes});
      }
      if(action==='entitlement'){
        const mode=stripeConfig(env).mode;
        // The record is read whole so a delivered purchase is still visible as
        // delivered after a reload; only an undelivered one entitles.
        const record=env.INVITATIONS?await purchaseFor(env.INVITATIONS,access.requestId,mode,{includeFulfilled:true}):null;
        const purchase=record&&!record.fulfilledAt?record:null;
        // `mode` here is the Stripe mode; the lane is read again by name.
        return json({enabled:Boolean(env.INVITATIONS)&&(paymentSimulated(lane)||checkoutReady(env)),mode,appMode:lane,packageId:purchase?.packageId||null,paidAt:purchase?.paidAt||null,downloadedAt:record?.downloadedAt||null,downloadCount:record?.downloadCount||0,fulfilledAt:record?.fulfilledAt||null,fulfilledPackageId:record?.fulfilledAt?record.packageId:null});
      }
      if(action==='visualization-video'||action==='visualization-video-status'){
        if(Object.keys(body).join(',')!=='id'||!/^[a-f0-9]{32}$/.test(body.id||''))return json({error:'Invalid video'},400);
        const stripeMode=stripeConfig(env).mode;
        let id=body.id,todo=action;
        if(action==='visualization-video'){
          // Studio only, undelivered, three per identity, one per preview - from the purchase record, never from the client.
          const purchase=env.INVITATIONS?await purchaseFor(env.INVITATIONS,access.requestId,stripeMode):null;
          const gate=gateVideo(purchase,body.id);
          if(!gate.allowed){
            console.log(JSON.stringify({event:'name-logo.video-gated',reason:gate.reason,used:gate.used,allowance:gate.allowance,traceId}));
            return json({error:gate.reason==='videos-complete'?'Your videos are complete.':'Videos are included with Signature studio.',gated:true,reason:gate.reason},403);
          }
          if(gate.reason==='existing'){
            // The same preview already has a clip. While it is queued, running or
            // delivered that clip is the answer; a clip that ended without a video
            // is replaced by a fresh submission (the backend refuses a rerun of one
            // the provider actually produced).
            const state=await identityVideo(env,{mode,action:'visualization-video-status',access,account,origin:url.origin,id:gate.job.jobId,traceId});
            if(!state.error&&['queued','running','succeeded'].includes(state.status))return json({id:state.id,status:state.status,video:state.video||null,error:null,diagnostic:null,source:body.id},200,{'X-L3V-Trace-Id':traceId});
            console.log(JSON.stringify({event:'name-logo.video-retry',previous:state.status||'missing',traceId}));
          }
        }
        const result=await identityVideo(env,{mode,action:todo,access,account,origin:url.origin,id,traceId});
        if(result.error&&!result.id)return json({error:result.error},result.status||502);
        if(todo==='visualization-video'&&env.INVITATIONS)await attachVideo(env.INVITATIONS,access.requestId,stripeMode,{jobId:result.id,source:body.id});
        return json({id:result.id,status:result.status,video:result.video||null,error:result.error||null,diagnostic:result.diagnostic||null,source:body.id},200,{'X-L3V-Trace-Id':traceId});
      }
      if(action==='checkout'){
        if(!env.INVITATIONS||(!paymentSimulated(mode)&&!checkoutReady(env)))return json({error:'Payment is not available yet'},503);
        if(Object.keys(body).join(',')!=='packageId'||!PAID_PACKAGES[body.packageId])return json({error:'Choose an available package'},400);
        const checkoutMode=stripeConfig(env).mode;
        const existing=await purchaseFor(env.INVITATIONS,access.requestId,checkoutMode,{includeFulfilled:true});
        if(existing&&!existing.fulfilledAt)return json({error:'This request is already paid'},409);
        // One purchase buys one identity. Once it is delivered the set belongs
        // to My assets and a second order has to start from a new name, so
        // checkout is refused here rather than handing back a spent session.
        if(existing)return json({error:'This identity has already been purchased.',spent:true},409);
        // dev has no Stripe: Pay records the purchase and returns as paid. The
        // record is a test-mode record; a live record without a charge must
        // never exist, so neither dev nor uat will run against live keys.
        if(checkoutMode!=='test'&&mode!=='production')return json({error:`${mode} mode cannot run with live Stripe keys`},503);
        if(paymentSimulated(mode)){
          const cents={creator:599,studio:999}[body.packageId]||0;
          const stored=await recordPurchase(env.INVITATIONS,{id:'sim_'+traceId,payment_status:'paid',amount_total:cents,currency:'usd',metadata:{requestId:access.requestId,packageId:body.packageId,mode:'test'}},'test');
          console.log(JSON.stringify({event:'name-logo.purchase-simulated',packageId:body.packageId,recorded:Boolean(stored),traceId}));
          if(!stored)return json({error:'Could not record the purchase'},503);
          return json({url:`${url.origin}/?purchase=complete#logo`,simulated:true},200,{'X-L3V-Trace-Id':traceId});
        }
        try{
          const session=await createCheckoutSession(env,{requestId:access.requestId,packageId:body.packageId,origin:url.origin});
          console.log(JSON.stringify({event:'name-logo.checkout-created',traceId}));
          return json({url:session.url},200,{'X-L3V-Trace-Id':traceId});
        }catch{
          console.warn(JSON.stringify({event:'name-logo.checkout-failed',traceId}));
          return json({error:'Could not start checkout. Please try again.'},502);
        }
      }
      let payload=['catalog','health'].includes(action)?{}:{access};
      if(action==='generate') {
        if(Object.keys(body).some(key=>!['first','last','styleId','styles','requestKey','token'].includes(key)))return json({error:'Invalid fields'},400);
        for(const key of ['first','last','requestKey'])if(typeof body[key]!=='string' || body[key].length>100)return json({error:'Invalid name or style'},400);
        if(typeof body.token!=='string' || body.token.length>2048)return json({error:'Complete the security check'},403);
        const styles=body.styles;
        if(styles!==undefined && (!Array.isArray(styles)||styles.length<1||styles.length>20||styles.some(s=>!s||Object.keys(s).sort().join(',')!=='id,mode'||!['logo','initials','signature'].includes(s.mode)||typeof s.id!=='string'||s.id.length>100)))return json({error:'Choose available styles'},400);
        if(styles===undefined && typeof body.styleId!=='string')return json({error:'Choose a style'},400);
        if(styles!==undefined && body.styleId!==undefined)return json({error:'Invalid selection'},400);
        const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'Cannot verify request'},403);
        const limit=await env.NAME_LOGO_LIMITER.limit({key:ip});if(!limit.success)return json({error:'Please wait before creating another design'},429);
        if(!isSimulated(mode)){
          const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:body.token,remoteip:ip}),signal:AbortSignal.timeout(10000)});
          const checked=await verification.json();
          if(!checked.success || checked.hostname!==url.hostname || checked.action!=='name_logo'){
            console.warn('name-logo security rejected',JSON.stringify({success:checked.success===true,hostnameMatches:checked.hostname===url.hostname,action:checked.action||'',errors:Array.isArray(checked['error-codes'])?checked['error-codes']:[]}));
            return json({error:'Security check expired'},403);
          }
        }
        payload={...payload,...account&&{accountId:account},...(styles?{styles}:{styleId:body.styleId}),quotaSubject:await signature('name-logo-quota:'+ip,env.NAME_LOGO_SESSION_SECRET),...Object.fromEntries(['first','last','requestKey'].map(key=>[key,body[key]]))};
      }
      if(action==='visualization-generate') {
        if(Object.keys(body).sort().join(',')!=='designId,template' || !/^[a-f0-9]{32}$/.test(body.designId||'') || !/^[a-z-]{1,32}$/.test(body.template||''))return json({error:'Choose an available visualization'},400);
        payload={...payload,designId:body.designId,template:body.template};
        // Decided from server-side facts only: the request's current list at
        // the gateway and its purchase record. Nothing the client says counts.
        const lister=isSimulated(mode)?simulatedCaller(env,url.origin):gatewayCaller(env,traceId,access.requestId);
        const listed=await lister('visualization-list',{access});
        if(!listed)return json({error:'The design service could not complete this request'},503);
        const purchase=env.INVITATIONS?await purchaseFor(env.INVITATIONS,access.requestId,stripeConfig(env).mode):null;
        const gate=gateVisualization(listed.visualizations,purchase,{designId:body.designId,template:body.template});
        if(!gate.allowed){
          console.log(JSON.stringify({event:'name-logo.generation-gated',reason:gate.reason,used:gate.used,allowance:gate.allowance,traceId}));
          return json({error:gate.reason==='package-complete'?'Your package is complete.':'This identity has used its included previews. Choose a package to create more.',gated:true,reason:gate.reason,used:gate.used,allowance:gate.allowance},403,{'X-L3V-Trace-Id':traceId});
        }
      }
      if(action==='visualization-status') {
        if(Object.keys(body).join(',')!=='id' || !/^[a-f0-9]{32}$/.test(body.id||''))return json({error:'Invalid visualization'},400);
        payload.id=body.id;
      }
      if(action==='visualization-list') {
        if(Object.keys(body).length)return json({error:'Invalid fields'},400);
      }
      if(action==='visualization-image') {
        const id=url.searchParams.get('id');if(!/^[a-f0-9]{32}$/.test(id||''))return json({error:'Invalid visualization'},400);payload.id=id;
      }
      if(action==='status' || action==='image') {
        const id=action==='image'?url.searchParams.get('id'):body.id;
        if(typeof id!=='string' || !(action==='image'?/^[a-f0-9]{32}$/:/^[a-f0-9]{64}$/).test(id))return json({error:'Invalid design'},400);
        payload.id=id;
        if(action==='image' && url.searchParams.get('format')==='svg')payload.format='svg';
      }
      const started=Date.now();
      let response;
      const upstreamFetch=()=>{
        const upstream=new URL(env.NAME_LOGO_URL);if(upstream.protocol!=='https:')throw new Error('Invalid gateway');upstream.pathname='/name-logo/'+action;upstream.search='';
        return fetch(upstream,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.NAME_LOGO_TOKEN,'X-L3V-Trace-Id':traceId,...(access.requestId?{'X-L3V-Request-Id':access.requestId}:{})},body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(30000)});
      };
      if(isSimulated(mode)&&action!=='health'){
        // dev and test never generate at the gateway. The simulator answers with
        // the same shapes on its own clock, from the site's sample images. A
        // read it does not know - an identity made on the real lane, opened
        // from the library - falls through to the gateway; reads cost nothing.
        response=await simulatedResponse(env,url.origin,action,payload);
        const readAction=['image','visualization-image','visualization-list','visualization-status','status'].includes(action);
        let unknownToSimulator=response.status===404;
        // The simulator answers an unknown request's list with an empty one; a
        // real identity's previews live at the gateway.
        if(!unknownToSimulator&&action==='visualization-list'&&response.ok){const listed=await response.clone().json().catch(()=>null);unknownToSimulator=!(listed?.visualizations?.length)}
        if(readAction&&unknownToSimulator&&env.NAME_LOGO_URL&&env.NAME_LOGO_TOKEN){
          try{const real=await upstreamFetch();if(real.ok)response=real}catch{}
        }
      }else{
        response=await upstreamFetch();
      }
      console.log(JSON.stringify({event:'name-logo.edge-request',action,status:response.status,durationMs:Date.now()-started,traceId}));
      await logReportedFailures(response,action,traceId);
      if(!response.ok)console.warn('name-logo upstream rejected',JSON.stringify({action,status:response.status,traceId}));
      if(response.status>=300 && response.status<400)return json({error:'The design service could not complete this request'},503);
      if(!response.ok)return json({error:response.status===404?'Design not found or expired':'The design service could not complete this request'},[400,403,404,409,429].includes(response.status)?response.status:503);
      const isImage=action==='image'||action==='visualization-image';
      const bytes=await bounded(response,isImage?25*1024*1024:150000);
      if(action==='image' && payload.format==='svg') {
        const svg=new TextDecoder().decode(bytes);
        if(!svg.startsWith('<svg ')||/<(?:script|image|foreignObject)\b|\bon\w+\s*=|(?:href|url)\s*[:=(]/i.test(svg))throw new Error('Invalid vector');
        return new Response(svg,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="design.svg"','Content-Security-Policy':"default-src 'none'; sandbox"}});
      }
      if(isImage) {
        // The gateway always returns PNG; the simulated lanes serve the JPEG demo set.
        const png=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b),jpeg=bytes[0]===0xFF&&bytes[1]===0xD8&&bytes[2]===0xFF;
        if(!png&&!jpeg)throw new Error('Invalid image');
        const ext=png?'png':'jpg';
        return new Response(bytes,{headers:{'Content-Type':png?'image/png':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`${url.searchParams.get('download')==='1'?'attachment':'inline'}; filename="${action==='visualization-image'?'visualization':'name-logo'}.${ext}"`}});
      }
      const data=JSON.parse(new TextDecoder().decode(bytes));
      if(action==='catalog')data.sitekey=env.TURNSTILE_SITEKEY;
      if(action==='health')data.appMode=mode;
      const result=json(data,response.status);result.headers.set('X-L3V-Trace-Id',traceId);return result;
    } catch {return json({error:'The name service is temporarily unavailable. Keep your request reference.'},503)}
  }
};

