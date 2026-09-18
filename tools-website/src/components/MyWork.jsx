import {useEffect,useRef,useState} from 'react';
import {accessFetch,requestReceipt} from '../lib/master-access.mjs';
import {importAccountWork,savedReceipts} from '../lib/video-receipt.mjs';
import {savedRequest,headers as nameLogoHeaders} from '../lib/name-logo-request.mjs';

const DESIGN_LABELS={logo:'Name logo',initials:'Initials',signature:'Signature'};
const label=row=>row.resource_kind==='name-logo-job'?(DESIGN_LABELS[row.mode]||'Identity design'):({'name-logo-visualization':'Real-world preview','analysis':'Analysis','first-frame':'First frame','video':'Video','name-logo-portfolio':'Identity collection','identity-video':'Video','video-job':row.job_kind==='frame'?'First frame':row.job_kind==='video'?'Video':'Analysis'}[row.resource_kind]||row.resource_kind.replaceAll('-',' '));
const stageLabel=row=>row.mode?(DESIGN_LABELS[row.mode]||'Identity design'):row.stage_key?.startsWith('video_')?'Generated video':row.stage_key?.startsWith('frame_')?'First frame':'Identity design';

const isDesign=row=>row.resource_kind==='name-logo-job';
// Anything generated from one of the three packages lands here, so a bundle is
// offered whenever any real-world preview was ever produced for the request.
const isPreview=row=>row.resource_kind==='name-logo-visualization'&&row.job_status==='succeeded';
const isClip=row=>row.resource_kind==='identity-video'&&row.job_status==='succeeded';
const identityName=rows=>{const named=rows.find(row=>row.first);return named?`${named.first} ${named.last||''}`.trim():''};
const previewTitle=row=>{const template=row.template||row.output?.template||'';return template?template.replace(/-/g,' ').replace(/^\w/,c=>c.toUpperCase()):'Real-world preview'};

// The card strip shows a few images; the gallery shows every one, each
// opening full size. Both read straight from the gateway with the request's
// receipt, so nothing is cached in this browser beyond the object URLs.
function AssetPreviews({rows,all=false,onOpen,onMore}){
 const [items,setItems]=useState([]),[settled,setSettled]=useState(false);
 // Loaded tiles are kept by resource id, so opening everything adds the rest
 // in small batches instead of fetching all 36 again and decoding them in one
 // go - which is what froze the page. Object URLs are released on unmount.
 const cache=useRef(new Map()),objects=useRef([]);
 useEffect(()=>()=>{objects.current.forEach(URL.revokeObjectURL);objects.current=[];cache.current.clear()},[rows[0]?.request_id]);
 useEffect(()=>{let live=true;const controller=new AbortController();setSettled(false);
  const publish=order=>{if(!live)return;setItems(order.map(id=>cache.current.get(id)).filter(Boolean))};
  async function load(){
   try{
    const root=rows[0],receipt=await requestReceipt(root.request_id),access={requestId:root.request_id,receipt};
    if(root.scope==='name-logo'){
     const designs=rows.filter(isDesign),previews=rows.filter(isPreview),clips=rows.filter(isClip);
     const wantedImages=all?[...designs,...previews]:[...designs.slice(0,3),...previews.slice(0,6)];
     const wantedClips=all?clips:clips.slice(0,2);
     const order=[...wantedImages,...wantedClips].map(row=>row.resource_id);
     publish(order);
     const loadImage=async row=>{
      if(cache.current.has(row.resource_id))return;
      const path=isDesign(row)?'image':'visualization-image';
      const response=await fetch(`/api/name-logo/${path}?id=${encodeURIComponent(row.resource_id)}`,{headers:nameLogoHeaders({access}),signal:controller.signal});
      if(!response.ok)return;
      const src=URL.createObjectURL(await response.blob());objects.current.push(src);
      cache.current.set(row.resource_id,{kind:'image',src,label:isDesign(row)?stageLabel(row):previewTitle(row),design:isDesign(row)});
     };
     const loadClip=async row=>{
      if(cache.current.has(row.resource_id))return;
      const response=await fetch('/api/name-logo/visualization-video-status',{method:'POST',headers:{'Content-Type':'application/json',...nameLogoHeaders({access})},body:JSON.stringify({id:row.resource_id}),signal:controller.signal});
      if(!response.ok)return;const data=await response.json();
      if(data.video)cache.current.set(row.resource_id,{kind:'video',src:data.video,label:'Video'});
     };
     const pending=[...wantedImages.filter(row=>!cache.current.has(row.resource_id)),...wantedClips.filter(row=>!cache.current.has(row.resource_id))];
     for(let index=0;index<pending.length;index+=6){
      await Promise.all(pending.slice(index,index+6).map(row=>isClip(row)?loadClip(row):loadImage(row)));
      publish(order);
      if(!live)return;
     }
     if(live)setSettled(true);
     return;
    }
    const jobs=rows.filter(row=>row.resource_kind==='video-job').slice(-6),loaded=[];
    for(const row of jobs){
     const response=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json','X-L3V-Request-Id':access.requestId,'X-L3V-Request-Receipt':access.receipt},body:JSON.stringify({id:row.resource_id}),signal:controller.signal});
     if(!response.ok)continue;
     const data=await response.json();
     if(typeof data.video==='string')loaded.push({kind:'video',src:data.video,label:'Generated video'});
     else if(typeof data.image==='string'&&data.image.startsWith('data:image/'))loaded.push({kind:'image',src:data.image,label:'First frame'});
    }
    if(live){setItems(loaded.reverse());setSettled(true)}
   }catch(error){if(error.name!=='AbortError'&&live){setSettled(true)}}
  }
  load();
  return()=>{live=false;controller.abort()};
 },[rows,all]);
 if(!items.length)return <p className="asset-gallery-empty" role="status">{settled?(all?'These images are no longer available here. The stored bundle, if there is one, still is.':'The images have aged out of the gateway; a stored bundle is still here if you downloaded one.'):'Loading images...'}</p>;
 const total=rows.filter(row=>isDesign(row)||isPreview(row)||isClip(row)).length,more=all?0:Math.max(0,total-items.length);
 const loadingMore=all&&!settled;
 return <div className={all?'asset-grid is-all':'asset-grid'} aria-label={all?'All saved images':'Saved work previews'}>{items.map((item,index)=><figure key={item.src+index} className={`asset-tile${item.design?' is-design':''}${item.kind==='video'?' is-video':''}`}>
  {item.kind==='video'
   ?<><video src={item.src} muted playsInline preload="metadata" controls aria-label={item.label}/><span className="asset-tile-badge">▶ VIDEO</span></>
   :<button type="button" onClick={()=>onOpen?.(item)} aria-label={`View ${item.label} full size`}><img src={item.src} alt={item.label} loading="lazy" decoding="async"/></button>}
  <figcaption>{item.label}</figcaption>
 </figure>)}{more>0&&<figure className="asset-tile asset-tile-more"><button type="button" onClick={onMore} aria-label={`Show all ${total} items`}>+{more}<small>more</small></button><figcaption>Open everything</figcaption></figure>}{loadingMore&&<figure className="asset-tile asset-tile-more is-loading" aria-live="polite"><div><span className="style-spinner" aria-hidden="true"/><small>{items.length} of {total}</small></div><figcaption>Loading the rest</figcaption></figure>}</div>;
}

export default function MyWork({hidden}){
 const [groups,setGroups]=useState([]),[message,setMessage]=useState(''),[bundling,setBundling]=useState(''),[stores,setStores]=useState({});
 // Opening an identity shows every image right here, not the generator.
 const [expanded,setExpanded]=useState(''),[lightbox,setLightbox]=useState(null);
 useEffect(()=>{if(!lightbox)return;const close=event=>{if(event.key==='Escape')setLightbox(null)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[lightbox]);

 useEffect(()=>{
  if(hidden)return;
  let live=true;
  async function load(){
   setMessage('Loading your assets...');
   try{
    const logo=savedRequest()?.access,receipts=[...savedReceipts(),...(logo?[logo]:[])];
    const unique=[...new Map(receipts.map(item=>[item.requestId,item])).values()];
    await Promise.all(unique.map(access=>accessFetch('/api/account/claim',{method:'POST',headers:{'X-L3V-Request-Id':access.requestId,'X-L3V-Request-Receipt':access.receipt}}).catch(()=>null)));
    const response=await accessFetch('/api/account/work');
    if(!response.ok)throw Error();
    const {work=[]}=await response.json(),map=new Map();
    for(const row of work){const list=map.get(row.request_id)||[];list.push(row);map.set(row.request_id,list)}
    const ordered=[...map.values()].sort((left,right)=>String(right[0].created).localeCompare(String(left[0].created)));
    if(live){setGroups(ordered);setMessage(work.length?'':'No assets yet. Your generated work will appear here.')}
    const kept=await accessFetch('/api/name-logo/bundle-list',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.ok?r.json():null).catch(()=>null);
    if(live&&kept)setStores(Object.fromEntries((kept.bundles||[]).map(item=>[item.requestId,item])));
   }catch{if(live)setMessage('Your asset library is temporarily unavailable.')}
  }
  load();
  return()=>{live=false};
 },[hidden]);

 async function openVideo(rows){
  await importAccountWork(rows);location.hash='video';location.reload();
 }

 // Stored bundles are durable; the gateway's copies age out with the queue.
 // Ask the Worker to store one if it has not already, then take it from R2.
 async function downloadBundle(rows){
  const root=rows[0];
  if(bundling)return;
  setBundling(root.request_id);
  try{
   const receipt=await requestReceipt(root.request_id),access={requestId:root.request_id,receipt};
   const stored=stores[root.request_id];
   if(!stored){
    const built=await accessFetch('/api/name-logo/bundle-build',{method:'POST',headers:{'Content-Type':'application/json',...nameLogoHeaders({access})},body:JSON.stringify({name:identityName(rows)})});
    if(!built.ok&&built.status!==409){setMessage('That bundle could not be prepared.');return}
   }
   const response=await accessFetch(`/api/name-logo/bundle?request=${encodeURIComponent(root.request_id)}`,{headers:nameLogoHeaders({access})});
   if(!response.ok){setMessage('That bundle is no longer available to download.');return}
   const url=URL.createObjectURL(await response.blob());
   const link=document.createElement('a');
   const stem=(identityName(rows)||'identity').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'identity';
   link.href=url;link.download=`${stem}-bundle.zip`;
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setMessage('That bundle could not be prepared.')}
  finally{setBundling('')}
 }

 return <section className="my-work" hidden={hidden}>
  <p className="eyebrow">PRIVATE LIBRARY</p>
  <h1>My assets</h1>
  <p>Everything generated under this invitation. Designs and previews are kept until the date on each card; a downloaded bundle is stored and stays available after that.</p>
  {message&&<p role="status">{message}</p>}
  <div className="work-list">{groups.map(rows=>{
   const root=rows[0],previews=rows.filter(isPreview),designs=rows.filter(isDesign),clips=rows.filter(isClip);
   const person=identityName(rows),isOpen=expanded===root.request_id;
   const counts=[designs.length&&`${designs.length} design${designs.length===1?'':'s'}`,previews.length&&`${previews.length} real-world preview${previews.length===1?'':'s'}`,clips.length&&`${clips.length} video${clips.length===1?'':'s'}`].filter(Boolean);
   return <article key={root.request_id} className={`asset-card${isOpen?' is-open':''}`}>
    <header className="asset-card-head">
     <div className="asset-card-copy">
      <p className="asset-kicker">{root.scope==='video'?'VIDEO PROJECT':'IDENTITY'} · {new Date(root.created).toLocaleDateString(undefined,{dateStyle:'medium'})}</p>
      <h2>{root.scope==='video'?'Video project':person||'Identity designs'}</h2>
      <span className="asset-meta">{counts.join(' · ')}{counts.length&&root.expires?' · ':''}{root.expires?`kept until ${new Date(root.expires).toLocaleDateString(undefined,{dateStyle:'medium'})}`:''}</span>
      <div className="asset-types">{[...new Set(rows.map(label))].map(type=><span key={type}>{type}</span>)}</div>
     </div>
     <div className="asset-card-actions">
      {root.scope==='video'
       ?<button type="button" onClick={()=>openVideo(rows)}>Open</button>
       :<button type="button" aria-expanded={isOpen} onClick={()=>setExpanded(isOpen?'':root.request_id)}>{isOpen?'Show less':'Open'}</button>}
      {(previews.length>0||stores[root.request_id])&&<button type="button" className="asset-bundle" disabled={bundling===root.request_id} onClick={()=>downloadBundle(rows)}>{bundling===root.request_id?'Preparing...':`Download bundle (${stores[root.request_id]?.count||previews.length})`}</button>}
     </div>
    </header>
    <AssetPreviews rows={rows} all={isOpen} onOpen={setLightbox} onMore={()=>setExpanded(root.request_id)}/>
   </article>;
  })}</div>
  {lightbox&&<div className="asset-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.label} onClick={()=>setLightbox(null)}>
   <button type="button" aria-label="Close full-size image" onClick={()=>setLightbox(null)}>Close</button>
   <figure onClick={event=>event.stopPropagation()}><img src={lightbox.src} alt={lightbox.label}/><figcaption>{lightbox.label}</figcaption></figure>
  </div>}
 </section>;
}
