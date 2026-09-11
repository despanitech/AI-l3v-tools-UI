import videoWorker from './video-worker.mjs';
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
export default {
  async fetch(request, env) {
    const url=new URL(request.url), prefix='/api/name-logo/';
    if(['/api/analyzer/config','/api/analyze','/api/first-frame','/api/image-to-video','/api/jobs'].includes(url.pathname)) return videoWorker.fetch(request,env);
    if(!url.pathname.startsWith(prefix)) return env.ASSETS.fetch(request);
    const action=url.pathname.slice(prefix.length);
    if(!['catalog','generate','status','image'].includes(action)) return json({error:'Not found'},404);
    const ready=env.NAME_LOGO_ENABLED==='true' && env.NAME_LOGO_RECEIPTS_READY==='true' && env.NAME_LOGO_URL && env.NAME_LOGO_TOKEN && env.NAME_LOGO_SESSION_SECRET && env.TURNSTILE_SECRET && env.TURNSTILE_SITEKEY && env.NAME_LOGO_LIMITER;
    if(!ready) return action==='catalog' ? json({enabled:false,styles:[]}) : json({error:'Name generation is not available yet'},503);
    if(request.method !== (['catalog','image'].includes(action)?'GET':'POST'))return json({error:'Invalid method'},405);
    if(request.method==='POST' && request.headers.get('Origin')!==url.origin)return json({error:'Open the form on this website'},403);
    try {
      const access={requestId:request.headers.get('X-L3V-Request-Id'),receipt:request.headers.get('X-L3V-Request-Receipt')};
      if(action!=='catalog' && (!/^[a-f0-9]{32}$/.test(access.requestId||'') || !/^[a-f0-9]{64}$/.test(access.receipt||''))) return json({error:'Request not found or expired'},404);
      let body={};
      if(request.method==='POST')body=JSON.parse(new TextDecoder().decode(await bounded(request,16384)));
      if(!body || typeof body!=='object' || Array.isArray(body))return json({error:'Invalid request'},400);
      let payload=action==='catalog'?{}:{access};
      if(action==='generate') {
        if(Object.keys(body).some(key=>!['first','last','styleId','requestKey','token'].includes(key)))return json({error:'Invalid fields'},400);
        for(const key of ['first','last','styleId','requestKey'])if(typeof body[key]!=='string' || body[key].length>100)return json({error:'Invalid name or style'},400);
        if(typeof body.token!=='string' || body.token.length>2048)return json({error:'Complete the security check'},403);
        const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'Cannot verify request'},403);
        const limit=await env.NAME_LOGO_LIMITER.limit({key:ip});if(!limit.success)return json({error:'Please wait before creating another design'},429);
        const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:body.token,remoteip:ip}),signal:AbortSignal.timeout(10000)});
        const checked=await verification.json();
        if(!checked.success || checked.hostname!==url.hostname || checked.action!=='name_logo')return json({error:'Security check expired'},403);
        payload={...payload,quotaSubject:await signature('name-logo-quota:'+ip,env.NAME_LOGO_SESSION_SECRET),...Object.fromEntries(['first','last','styleId','requestKey'].map(key=>[key,body[key]]))};
      }
      if(action==='status' || action==='image') {
        const id=action==='image'?url.searchParams.get('id'):body.id;
        if(typeof id!=='string' || !(action==='image'?/^[a-f0-9]{32}$/:/^[a-f0-9]{64}$/).test(id))return json({error:'Invalid design'},400);
        payload.id=id;
      }
      const upstream=new URL(env.NAME_LOGO_URL);if(upstream.protocol!=='https:')throw new Error('Invalid gateway');upstream.pathname='/name-logo/'+action;upstream.search='';
      const response=await fetch(upstream,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.NAME_LOGO_TOKEN},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(30000)});
      if(!response.ok)return json({error:response.status===404?'Design not found or expired':'The design service could not complete this request'},[400,403,404,409,429].includes(response.status)?response.status:503);
      const bytes=await bounded(response,action==='image'?25*1024*1024:150000);
      if(action==='image') {
        if(![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))throw new Error('Invalid image');
        return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`${url.searchParams.get('download')==='1'?'attachment':'inline'}; filename="name-logo.png"`}});
      }
      const data=JSON.parse(new TextDecoder().decode(bytes));
      if(action==='catalog')data.sitekey=env.TURNSTILE_SITEKEY;
      return json(data);
    } catch {return json({error:'The name service is temporarily unavailable. Keep your request reference.'},503)}
  }
};
