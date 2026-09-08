import {validateReference,validateReport} from '../analyzer/contract.mjs';
import guide from '../app/guide.json';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/api/analyzer/config') return reply({enabled:env.ANALYZER_ENABLED==='true'&&!!env.HERMES_URL&&!!env.HERMES_TOKEN&&!!env.TURNSTILE_SECRET,sitekey:env.TURNSTILE_SITEKEY||''});
  if(url.pathname!=='/api/analyze')return env.ASSETS.fetch(request);
  if(request.method!=='POST')return reply({error:'Use the reference form.'},405);
  if(request.headers.get('Origin')!=='https://video.l3v.ai')return reply({error:'Open the form on video.l3v.ai.'},403);
  if(env.ANALYZER_ENABLED!=='true'||!env.HERMES_URL||!env.HERMES_TOKEN||!env.TURNSTILE_SECRET)return reply({error:'The reference analyzer is not available yet.'},503);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'Unsupported request.'},415);
  let body;try{
   const reader=request.body.getReader();let size=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();return reply({error:'Reference is too large.'},413)}chunks.push(value)}
   const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length}body=JSON.parse(new TextDecoder().decode(data));
  }catch{return reply({error:'Invalid request.'},400)}
  let reference;try{reference=validateReference(body)}catch(e){return reply({error:e.message},400)}
  if(typeof body.token!=='string'||body.token.length>2048)return reply({error:'Complete the security check.'},403);
  try{
   const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:body.token,remoteip:request.headers.get('CF-Connecting-IP')||''}),signal:AbortSignal.timeout(10000)});
   const verification=await response.json();
   if(!response.ok||!verification.success||verification.hostname!=='video.l3v.ai'||verification.action!=='reference_analyze')return reply({error:'Security check expired. Please try again.'},403);
   // The protected Hermes gateway must enforce a per-visitor daily cap and a global budget atomically.
   const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply({error:'Unable to verify request origin.'},403);
   const identity=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.HERMES_TOKEN+new Date().toISOString().slice(0,10)+ip));
   const visitor=Array.from(new Uint8Array(identity),b=>b.toString(16).padStart(2,'0')).join('');
   const target=new URL(env.HERMES_URL);if(target.protocol!=='https:')throw new Error('configuration');
   const result=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.HERMES_TOKEN},body:JSON.stringify({...reference,visitor,requestId:crypto.randomUUID()}),redirect:'error',signal:AbortSignal.timeout(90000)});
   if(result.status===429)return reply({error:'The analysis allowance has been reached. Please try tomorrow.'},429);
   if(!result.ok)throw new Error('upstream');
   const raw=await result.text();if(raw.length>40000)throw new Error('result size');
   const report=validateReport(JSON.parse(raw),new Set(guide.map(m=>m.id)));
   return reply({report});
  }catch{return reply({error:'We could not complete the analysis. Please try again later.'},502)}
 }
};
