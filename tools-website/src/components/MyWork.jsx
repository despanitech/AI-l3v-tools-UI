import {useEffect,useState} from 'react';
import {accessFetch,requestReceipt} from '../lib/master-access.mjs';
import {importAccountWork,savedReceipts} from '../lib/video-receipt.mjs';
import {savedRequest,headers as nameLogoHeaders} from '../lib/name-logo-request.mjs';

const DESIGN_LABELS={logo:'Name logo',initials:'Initials',signature:'Signature'};
const label=row=>row.resource_kind==='name-logo-job'?(DESIGN_LABELS[row.mode]||'Identity design'):({'name-logo-visualization':'Real-world preview','analysis':'Analysis','first-frame':'First frame','video':'Video','name-logo-portfolio':'Identity collection','video-job':row.job_kind==='frame'?'First frame':row.job_kind==='video'?'Video':'Analysis'}[row.resource_kind]||row.resource_kind.replaceAll('-',' '));
const stageLabel=row=>row.mode?(DESIGN_LABELS[row.mode]||'Identity design'):row.stage_key?.startsWith('video_')?'Generated video':row.stage_key?.startsWith('frame_')?'First frame':'Identity design';

const isDesign=row=>row.resource_kind==='name-logo-job';
// Anything generated from one of the three packages lands here, so a bundle is
// offered whenever any real-world preview was ever produced for the request.
const isPreview=row=>row.resource_kind==='name-logo-visualization'&&row.job_status==='succeeded';
const identityName=rows=>{const named=rows.find(row=>row.first);return named?`${named.first} ${named.last||''}`.trim():''};
const previewTitle=row=>{const template=row.template||row.output?.template||'';return template?template.replace(/-/g,' ').replace(/^\w/,c=>c.toUpperCase()):'Real-world preview'};

// The card strip shows a few images; the gallery shows every one, each
// opening full size. Both read straight from the gateway with the request's
// receipt, so nothing is cached in this browser beyond the object URLs.
function AssetPreviews({rows,all=false,onOpen}){
 const [items,setItems]=useState([]);
 useEffect(()=>{let live=true;const objects=[],controller=new AbortController();
  async function load(){
   try{
    const root=rows[0],receipt=await requestReceipt(root.request_id),access={requestId:root.request_id,receipt};
    if(root.scope==='name-logo'){
     const designs=rows.filter(isDesign),previews=rows.filter(isPreview);
     const wanted=all?[...designs,...previews]:[...designs.slice(0,3),...previews.slice(0,5)];
     const loaded=(await Promise.all(wanted.map(async row=>{
      const path=isDesign(row)?'image':'visualization-image';
      const response=await fetch(`/api/name-logo/${path}?id=${encodeURIComponent(row.resource_id)}`,{headers:nameLogoHeaders({access}),signal:controller.signal});
      if(!response.ok)return null;
      const src=URL.createObjectURL(await response.blob());objects.push(src);
      return {kind:'image',src,label:isDesign(row)?stageLabel(row):previewTitle(row)};
     }))).filter(Boolean);
     if(live)setItems(loaded);
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
    if(live)setItems(loaded.reverse());
   }catch(error){if(error.name!=='AbortError'&&live)setItems([])}
  }
  load();
  return()=>{live=false;controller.abort();objects.forEach(URL.revokeObjectURL)};
 },[rows,all]);
 if(!items.length)return all?<p className="asset-gallery-empty" role="status">Loading images...</p>:null;
 return <div className={all?'asset-gallery':'asset-preview-strip'} aria-label={all?'All saved images':'Saved work previews'}>{items.map((item,index)=><figure key={item.src+index}>
  {item.kind==='video'
   ?<video src={item.src} muted playsInline preload="metadata" controls aria-label={item.label}/>
   :<button type="button" onClick={()=>onOpen?.(item)} aria-label={`View ${item.label} full size`}><img src={item.src} alt={item.label}/></button>}
  <figcaption>{item.label}</figcaption>
 </figure>)}</div>;
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
   const root=rows[0],previews=rows.filter(isPreview),designs=rows.filter(isDesign);
   const person=identityName(rows),isOpen=expanded===root.request_id;
   return <article key={root.request_id} className={isOpen?'is-open':''}>
    <div className="asset-card-copy">
     <strong>{root.scope==='video'?'Video project':person?`Identity designs for ${person}`:'Identity designs'}</strong>
     <small>{new Date(root.created).toLocaleString()}{root.expires?` · kept until ${new Date(root.expires).toLocaleDateString()}`:''}</small>
     <div className="asset-types">{[...new Set(rows.map(label))].map(type=><span key={type}>{type}</span>)}</div>
     {root.scope==='name-logo'&&<small className="asset-counts">{designs.length} design{designs.length===1?'':'s'}{previews.length?` · ${previews.length} real-world preview${previews.length===1?'':'s'}`:''}</small>}
    </div>
    <div className="asset-card-actions">
     {root.scope==='video'
      ?<button type="button" onClick={()=>openVideo(rows)}>Open</button>
      :<button type="button" aria-expanded={isOpen} onClick={()=>setExpanded(isOpen?'':root.request_id)}>{isOpen?'Close':'Open'}</button>}
     {(previews.length>0||stores[root.request_id])&&<button type="button" className="asset-bundle" disabled={bundling===root.request_id} onClick={()=>downloadBundle(rows)}>{bundling===root.request_id?'Preparing...':`Download bundle (${stores[root.request_id]?.count||previews.length})`}</button>}
    </div>
    <AssetPreviews rows={rows} all={isOpen} onOpen={setLightbox}/>
   </article>;
  })}</div>
  {lightbox&&<div className="asset-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.label} onClick={()=>setLightbox(null)}>
   <button type="button" aria-label="Close full-size image" onClick={()=>setLightbox(null)}>Close</button>
   <figure onClick={event=>event.stopPropagation()}><img src={lightbox.src} alt={lightbox.label}/><figcaption>{lightbox.label}</figcaption></figure>
  </div>}
 </section>;
}
