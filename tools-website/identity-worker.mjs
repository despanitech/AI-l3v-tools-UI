import videoWorker from './video-worker.mjs';
import {invitationAccount} from './invitation-worker.mjs';
import {issueInvitation} from './invitation-issuer.mjs';
import {invitationShare} from './invitation-share.mjs';
import {buildBundle,listBundles,getBundle} from './bundle-store.mjs';
import {createCheckoutSession,verifyWebhookForModes,recordPurchase,purchaseFor,markDownloaded,clearPurchase,checkoutReady,stripeConfig,webhookSecrets,PAID_PACKAGES} from './stripe-checkout.mjs';
const json = (value, status=200, headers={}) => Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
async function signature(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
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
    if(!['catalog','health','generate','status','image','visualization-generate','visualization-status','visualization-list','visualization-image','checkout','entitlement','downloaded','purchase-reset','bundle-build','bundle-list','bundle'].includes(action)) return json({error:'Not found'},404);
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
        if(Object.keys(body).length&&Object.keys(body).join(',')!=='name')return json({error:'Invalid fields'},400);
        const built=await buildBundle(env,{accountId:account,requestId:access.requestId,receipt:access.receipt,name:body.name,
          gateway:gatewayCaller(env,traceId,access.requestId)});
        console.log(JSON.stringify({event:'name-logo.bundle-stored',stored:Boolean(built),count:built?.count||0,traceId}));
        if(!built)return json({error:'Nothing to bundle yet'},409);
        return json({stored:true,count:built.count,bytes:built.bytes});
      }
      if(action==='entitlement'){
        const mode=stripeConfig(env).mode;
        const purchase=env.INVITATIONS?await purchaseFor(env.INVITATIONS,access.requestId,mode):null;
        return json({enabled:checkoutReady(env)&&Boolean(env.INVITATIONS),mode,packageId:purchase?.packageId||null,paidAt:purchase?.paidAt||null,downloadedAt:purchase?.downloadedAt||null,downloadCount:purchase?.downloadCount||0});
      }
      if(action==='checkout'){
        if(!checkoutReady(env)||!env.INVITATIONS)return json({error:'Payment is not available yet'},503);
        if(Object.keys(body).join(',')!=='packageId'||!PAID_PACKAGES[body.packageId])return json({error:'Choose an available package'},400);
        if(await purchaseFor(env.INVITATIONS,access.requestId,stripeConfig(env).mode))return json({error:'This request is already paid'},409);
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
        const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:body.token,remoteip:ip}),signal:AbortSignal.timeout(10000)});
        const checked=await verification.json();
        if(!checked.success || checked.hostname!==url.hostname || checked.action!=='name_logo'){
          console.warn('name-logo security rejected',JSON.stringify({success:checked.success===true,hostnameMatches:checked.hostname===url.hostname,action:checked.action||'',errors:Array.isArray(checked['error-codes'])?checked['error-codes']:[]}));
          return json({error:'Security check expired'},403);
        }
        payload={...payload,...account&&{accountId:account},...(styles?{styles}:{styleId:body.styleId}),quotaSubject:await signature('name-logo-quota:'+ip,env.NAME_LOGO_SESSION_SECRET),...Object.fromEntries(['first','last','requestKey'].map(key=>[key,body[key]]))};
      }
      if(action==='visualization-generate') {
        if(Object.keys(body).sort().join(',')!=='designId,template' || !/^[a-f0-9]{32}$/.test(body.designId||'') || !/^[a-z-]{1,32}$/.test(body.template||''))return json({error:'Choose an available visualization'},400);
        payload={...payload,designId:body.designId,template:body.template};
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
      const upstream=new URL(env.NAME_LOGO_URL);if(upstream.protocol!=='https:')throw new Error('Invalid gateway');upstream.pathname='/name-logo/'+action;upstream.search='';
      const started=Date.now();
      const response=await fetch(upstream,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.NAME_LOGO_TOKEN,'X-L3V-Trace-Id':traceId,...(access.requestId?{'X-L3V-Request-Id':access.requestId}:{})},body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(30000)});
      console.log(JSON.stringify({event:'name-logo.edge-request',action,status:response.status,durationMs:Date.now()-started,traceId}));
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
        if(![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))throw new Error('Invalid image');
        return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`${url.searchParams.get('download')==='1'?'attachment':'inline'}; filename="${action==='visualization-image'?'visualization':'name-logo'}.png"`}});
      }
      const data=JSON.parse(new TextDecoder().decode(bytes));
      if(action==='catalog')data.sitekey=env.TURNSTILE_SITEKEY;
      const result=json(data,response.status);result.headers.set('X-L3V-Trace-Id',traceId);return result;
    } catch {return json({error:'The name service is temporarily unavailable. Keep your request reference.'},503)}
  }
};

