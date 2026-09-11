import {validateReference,validateReport} from '../analyzer/contract.mjs';
import guide from '../app/guide.json' with {type:'json'};
import {validateVideoRequest,validateVideoResult} from './video-contract.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  const frame=url.pathname==='/api/first-frame';
  const polling=url.pathname==='/api/jobs';
  const video=url.pathname==='/api/image-to-video';
  const origin=env.ALLOWED_ORIGIN||'https://tools.l3v.ai';
  const ready=env.VIDEO_RECEIPTS_READY==='true'&&env.ANALYZER_ENABLED==='true'&&!!env.HERMES_URL&&!!env.HERMES_TOKEN&&!!env.TURNSTILE_SECRET&&!!env.TURNSTILE_SITEKEY;
  if(url.pathname==='/api/analyzer/config') return reply({enabled:ready,sitekey:ready?env.TURNSTILE_SITEKEY:'',newScenePlanner:ready&&env.FRAMES_ENABLED==='true',videoGeneration:ready&&env.VIDEO_ENABLED==='true',videoMaxCredits:Number(env.VIDEO_MAX_CREDITS_PER_JOB||100)});
  if(url.pathname!=='/api/analyze'&&!frame&&!polling&&!video)return env.ASSETS.fetch(request);
  if(request.method!=='POST')return reply({error:'Use the reference form.'},405);
  if(request.headers.get('Origin')!==origin)return reply({error:'Open the form on this website.'},403);
  if(!ready)return reply({error:'The reference analyzer is not available yet.'},503);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'Unsupported request.'},415);
  const access={requestId:request.headers.get('X-L3V-Request-Id'),receipt:request.headers.get('X-L3V-Request-Receipt')};
  if(!/^[a-f0-9]{32}$/.test(access.requestId||'')||!/^[a-f0-9]{64}$/.test(access.receipt||''))return reply({error:'Request not found or expired.'},404);
  if(frame&&env.FRAMES_ENABLED!=='true')return reply({error:'Image generation is not available yet.'},503);
  let body;try{
   const reader=request.body.getReader();let size=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();return reply({error:'Reference is too large.'},413)}chunks.push(value)}
   const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length}body=JSON.parse(new TextDecoder().decode(data));
  }catch{return reply({error:'Invalid request.'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request.'},400);
  if(video&&env.VIDEO_ENABLED!=='true')return reply({error:'Video generation is not available yet.'},503);
  let reference;try{reference=video?validateVideoRequest(body):polling?validateJob(body):frame?validateTicket(body):validateReference(body)}catch(e){return reply({error:e.message},400)}
  if(video&&reference.request.duration*({'480p':20,'720p':30,'1080p':68}[reference.request.resolution])>Number(env.VIDEO_MAX_CREDITS_PER_JOB||100))return reply({error:'Choose settings within the configured credit limit.'},400);
  if(!polling&&(typeof body.token!=='string'||body.token.length>2048))return reply({error:'Complete the security check.'},403);
  try{
   if(!polling){
   const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:body.token,remoteip:request.headers.get('CF-Connecting-IP')||''}),signal:AbortSignal.timeout(10000)});
   const verification=await boundedJSON(response,4096);
   if(!response.ok||!verification.success||verification.hostname!==new URL(origin).hostname||verification.action!==(video?'reference_video':frame?'reference_frame':'reference_analyze'))return reply({error:'Security check expired. Please try again.'},403);
   }
   // The protected Hermes gateway must enforce a per-visitor daily cap and a global budget atomically.
   const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply({error:'Unable to verify request origin.'},403);
   const identity=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.HERMES_TOKEN+new Date().toISOString().slice(0,10)+ip));
   const visitor=Array.from(new Uint8Array(identity),b=>b.toString(16).padStart(2,'0')).join('');
   const target=new URL(env.HERMES_URL);if(target.protocol!=='https:'||target.username||target.password)throw new Error('configuration');
   target.pathname=video?'/image-to-video':frame?'/first-frame':polling?'/jobs':'/analyze';target.search='';target.hash='';
   const result=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.HERMES_TOKEN},body:JSON.stringify({...reference,visitor,access}),redirect:'error',signal:AbortSignal.timeout(frame?165000:90000)});
   if(result.status===429)return reply({error:'The analysis allowance has been reached. Please try tomorrow.'},429);
   if(result.status===404)return reply({error:'Analysis not found or expired.'},404);
   if(result.status===409)return reply({error:'This request already used different settings. Check its saved status.'},409);
   if(!result.ok)throw new Error('upstream');
   const data=await boundedJSON(result,(frame||polling)?6000000:50000);
   if(polling&&data.job?.id!==reference.id)throw new Error('Mismatched job');
   if(data.job){if(!/^[a-f0-9]{32}$/.test(data.job.id)||!['queued','running','succeeded','failed','ambiguous','expired'].includes(data.job.status))throw new Error('invalid job');if(data.job.status!=='succeeded')return reply({job:{id:data.job.id,status:data.job.status}},result.status);if(data.video)return reply({job:{id:data.job.id,status:'succeeded'},...validateVideoResult(data,env.VIDEO_OUTPUT_BASE_URL)});if(data.image)return reply({job:{id:data.job.id,status:'succeeded'},...validateFrame(data)});return reply({job:{id:data.job.id,status:'succeeded'},report:validateReport(data.report,new Set(guide.map(m=>m.id))),frameTicket:typeof data.frameTicket==='string'&&/^[a-f0-9]{32}$/.test(data.frameTicket)?data.frameTicket:null})}
   throw new Error('Missing queued job');
  }catch{return reply({error:'The request status is uncertain. Keep this tab and check the saved request; do not start another generation.'},502)}
 }
};

function validateTicket(body){if(typeof body.ticket!=='string'||!/^[a-f0-9]{32}$/.test(body.ticket))throw new Error('Analyze a reference before generating a frame.');return {ticket:body.ticket}}
async function boundedJSON(response,limit){const reader=response.body.getReader();const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Result too large')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes))}

function validateJob(body){if(typeof body.id!=='string'||!/^[a-f0-9]{32}$/.test(body.id))throw new Error('Invalid analysis job.');return {id:body.id}}

function validateFrame(data){if(typeof data.image!=='string'||!/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.image)||typeof data.motionPrompt!=='string'||data.motionPrompt.length>4000)throw new Error('Invalid frame');return {image:data.image,motionPrompt:data.motionPrompt,model:'gpt-image-2'}}

