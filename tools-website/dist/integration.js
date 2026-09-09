import {post,waitForJob,estimateRate} from './api-client.mjs';
const get = id => document.getElementById(id);
const button = document.querySelector('.primary');
const note = get('service-note');
const privacy = document.querySelector('.privacy');
const result = document.createElement('section'); result.id='analysis-result'; result.hidden=true; result.setAttribute('aria-label','Video suggestions');
get('video-panel').append(result);
const security = document.createElement('div'); security.id='analysis-security'; button.closest('.submit-row').before(security);
let config,token='',widget, busy=false, ticket='', frameUsed=false, run, referenceVersion=0, requestId=crypto.randomUUID();
const say = text => { get('status').textContent=text; };
const media = () => get('media').querySelector('img,video');
function refresh() {
  const reference=media();
  const localVideo=reference?.tagName==='VIDEO' && reference.src.startsWith('blob:');
  button.disabled=!config?.enabled || !token || !reference || busy || localVideo;
  if (config?.enabled && localVideo) note.textContent='Video upload analysis is not connected yet. Upload a still image or use a public video link.';
  else if(config?.enabled) note.textContent='Get model recommendations and a suggested creation plan.';
}
new MutationObserver(() => {
  referenceVersion++; requestId=crypto.randomUUID(); run?.abort(); busy=false; ticket=''; frameUsed=false; result.hidden=true;
  if(widget!==undefined){token='';window.turnstile.reset(widget);}refresh();
}).observe(get('media'),{childList:true});
function text(parent,tag,value) { const el=document.createElement(tag);el.textContent=value;parent.append(el);return el; }
function waitMedia(el,event) {
  return new Promise((resolve,reject) => {
    const timer=setTimeout(()=>finish(new Error('The reference could not be read. Try an uploaded image.')),15000);
    const ok=()=>finish(),error=()=>finish(new Error('The reference could not be read.'));
    function finish(err){clearTimeout(timer);el.removeEventListener(event,ok);el.removeEventListener('error',error);err?reject(err):resolve();}
    el.addEventListener(event,ok,{once:true});el.addEventListener('error',error,{once:true});
  });
}
async function prepare(reference) {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(reference.tagName==='IMG') {
    await reference.decode();
    const scale=Math.min(1,1200/Math.max(reference.naturalWidth,reference.naturalHeight));
    canvas.width=Math.max(1,Math.round(reference.naturalWidth*scale));canvas.height=Math.max(1,Math.round(reference.naturalHeight*scale));
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(reference,0,0,canvas.width,canvas.height);
  } else {
    if (!reference.src.startsWith('https:')) throw new Error('Upload a still image or use a public video link for analysis.');
    const video=document.createElement('video'); video.crossOrigin='anonymous';video.muted=true;video.preload='auto';
    try {
      const ready=waitMedia(video,'loadeddata');video.src=reference.src;await ready;
      if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>60)throw new Error('Choose a video up to 60 seconds.');
      canvas.width=1200;canvas.height=400;ctx.fillStyle='#111';ctx.fillRect(0,0,1200,400);
      for(let i=0;i<3;i++) {
        const sought=waitMedia(video,'seeked');video.currentTime=video.duration*[.15,.5,.85][i];await sought;
        const scale=Math.min(400/video.videoWidth,400/video.videoHeight);
        ctx.drawImage(video,i*400+(400-video.videoWidth*scale)/2,(400-video.videoHeight*scale)/2,video.videoWidth*scale,video.videoHeight*scale);
      }
    } finally {video.removeAttribute('src');video.load();}
  }
  let image;
  try { image=canvas.toDataURL('image/jpeg',.8); } catch {throw new Error('This video host blocks frame access. Upload a reference image instead.');}
  if(image.length>1400000)throw new Error('The reference is too detailed to send. Try a smaller image.');
  return {kind:reference.tagName==='IMG'?'image':'video',image,...(reference.tagName==='VIDEO'?{sourceUrl:reference.src}:{})};
}
function mountSecurity(element,action,callback) {
  return window.turnstile.render(element,{sitekey:config.sitekey,action,theme:document.documentElement.dataset.mode==='dark'?'dark':'light',callback,'expired-callback':()=>callback(''),'error-callback':()=>callback('')});
}
async function renderReport(data,version) {
  const report=data.report;
  if(!report || typeof report.summary!=='string' || !Array.isArray(report.models) || typeof report.prompt!=='string')throw new Error('The service returned an incomplete result.');
  result.replaceChildren(); result.hidden=false;
  text(result,'h2','Your video direction');text(result,'p',report.summary);
  text(result,'p','Creative goal: a different scene with the reference’s style, colors, light and mood. Social overlays are not part of the scene; sideways artwork should be read in its intended orientation.');
  let names=[]; try{names=await fetch('model-catalog.json').then(r=>r.json());}catch{}
  if(version!==referenceVersion)return;
  text(result,'h3','Recommended models');
  for(const model of report.models){text(result,'h4',names.find(m=>m.id===model.id)?.name||model.id);text(result,'p',model.reason);}
  for(const [key,title] of [['observations','Reference details'],['workflow','Suggested workflow'],['limitations','What to check']]) {
    if(Array.isArray(report[key])){text(result,'h3',title);const list=document.createElement('ul');report[key].forEach(value=>text(list,'li',value));result.append(list);}
  }
  text(result,'h3','Suggested prompt');text(result,'p',report.prompt);
  const prices=document.createElement('div');result.append(prices);await renderPrices(prices,report.models.map(m=>m.id));
  if(version!==referenceVersion)return;
  text(result,'h3','Optional first frame');
  if(!config.newScenePlanner || !/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/.test(data.frameTicket||'')) {
    text(result,'p','Automatic planning for a different scene is not connected. First-frame generation is unavailable.');return;
  }
  ticket=data.frameTicket;frameUsed=false;
  text(result,'p','Create a still image of a different scene with the same visual mood. This does not generate a video.');
  const frameSecurity=document.createElement('div'),frameButton=text(result,'button','Create a first frame');frameButton.className='secondary';frameButton.disabled=true;result.append(frameSecurity);
  let frameToken='';mountSecurity(frameSecurity,'reference_frame',value=>{frameToken=value;frameButton.disabled=!value||frameUsed;});
  frameButton.onclick=async()=>{
    if(frameUsed||!frameToken)return;frameUsed=true;frameButton.disabled=true;busy=true;refresh();run=new AbortController();const version=referenceVersion;
    try {
      say('Requesting the first frame…');
      let frame=await post('/api/first-frame',{ticket,token:frameToken,requestId:crypto.randomUUID()},run.signal);
      frame=await waitForJob(frame,say,run.signal);
      if(version!==referenceVersion)return;
      if(!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(frame.image)||typeof frame.motionPrompt!=='string')throw new Error('The frame result is incomplete.');
      const img=document.createElement('img');img.src=frame.image;img.alt='Generated first frame for a new scene';img.className='generated-frame';result.append(img);
      const save=text(result,'a','Download first frame');save.href=frame.image;save.download='l3v-first-frame.'+(frame.image.startsWith('data:image/png')?'png':'jpg');
      text(result,'h3','Motion prompt');text(result,'p',frame.motionPrompt);say('First frame ready. No video has been generated.');
    }catch(error){if(error.name!=='AbortError')say(error.message+' This request will not be retried automatically.');}
    finally{if(version===referenceVersion){busy=false;refresh();}}
  };
}
async function renderPrices(parent,modelIds) {
  text(parent,'h3','Video cost estimate');
  let catalog;try{catalog=await fetch('pricing.json').then(r=>r.json());}catch{text(parent,'p','Price catalog unavailable.');return;}
  const rates=catalog.rates.filter(r=>modelIds.includes(r.modelId));
  if(!rates.length){text(parent,'p','No verified provider price is available for these models.');return;}
  const label=text(parent,'label','Provider and configuration'),select=document.createElement('select');label.append(select);
  rates.forEach(rate=>{const option=text(select,'option',`${rate.provider} · ${rate.model} · ${rate.resolution} · audio ${rate.audio}`);option.value=rate.id;});
  const durationLabel=text(parent,'label','Seconds'),duration=document.createElement('select');durationLabel.append(duration);
  const takesLabel=text(parent,'label','Takes'),takes=document.createElement('input');takes.type='number';takes.min='1';takes.max='20';takes.value='1';takesLabel.append(takes);
  const output=text(parent,'p','');output.setAttribute('aria-live','polite');const attribution=text(parent,'p','');
  function update(){try{const estimate=estimateRate(catalog,select.value,Number(duration.value),Number(takes.value));output.textContent=`$${estimate.perTake} per take · $${estimate.estimatedTotal} USD estimated total`;attribution.replaceChildren();text(attribution,'span',`${estimate.stale?'Outdated price — ':''}Verified ${estimate.verifiedAt.slice(0,10)} · ${estimate.catalogRevision}. `);const link=text(attribution,'a','Provider pricing');const source=new URL(estimate.source);if(source.protocol==='https:'){link.href=source.href;link.target='_blank';link.rel='noopener';}}catch(error){output.textContent=error.message;}}
  select.onchange=()=>{duration.replaceChildren();rates.find(r=>r.id===select.value).durations.forEach(d=>{const option=text(duration,'option',String(d));option.value=String(d);});update();};duration.onchange=update;takes.oninput=update;select.onchange();
  text(parent,'p','Catalog estimate, not a charge or availability guarantee. Excludes analysis, first-frame generation, tax, platform markup and upscaling. No video generation is connected.');
}
button.onclick=async()=>{
  if(button.disabled)return;busy=true;refresh();const controller=new AbortController();run=controller;const version=referenceVersion;result.hidden=true;
  try {
    say('Preparing your reference…');const body=await prepare(media());controller.signal.throwIfAborted();
    say('Submitting your reference…');let data=await post('/api/analyze',{...body,token,requestId},controller.signal);
    data=await waitForJob(data,say,controller.signal);if(version!==referenceVersion)return;
    await renderReport(data,version);if(version===referenceVersion)say('Analysis ready. Review the suggested scene before generating anything.');
  }catch(error){if(error.name!=='AbortError')say(error.message);}
  finally{if(version===referenceVersion){busy=false;token='';if(widget!==undefined)window.turnstile.reset(widget);refresh();}}
};
async function init(){
  if(window.L3V_API?.enabled!==true)return;
  try{
    const response=await fetch('/api/analyzer/config');if(!response.ok)throw new Error();config=await response.json();
    if(!config.enabled||!config.sitekey)throw new Error();
    privacy.textContent='On submission, your image or sampled frames are sent to the analysis service.';
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload=()=>{widget=mountSecurity(security,'reference_analyze',value=>{token=value;refresh();});};script.onerror=()=>{note.textContent='The security check could not load. Refresh to try again.';};document.head.append(script);
  }catch{config=null;note.textContent='The analysis service is unavailable. You can still preview a reference.';}
  refresh();
}
init();
