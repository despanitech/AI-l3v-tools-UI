import {useEffect,useMemo,useState} from 'react';
import {applicationSubjects,demoPreviewImage,demoIdentityName} from '../lib/application-templates.mjs';
import {accessFetch} from '../lib/master-access.mjs';

// The rail shows what it says: the previews of the identity being made, as
// they land, newest first. Before any exist it shows the demo identity, and
// says so. Every tile opens full size.
const DEMO_MODES=['logo','initials','signature'];

function demoSamples(count){
 const pool=[];
 for(const mode of DEMO_MODES)for(const subject of applicationSubjects){const image=demoPreviewImage(subject,mode);if(image)pool.push({key:`${mode}:${subject.id}`,name:subject.name,imageUrl:image,demo:true})}
 return pool.map(item=>({item,order:crypto.getRandomValues(new Uint32Array(1))[0]})).sort((a,b)=>a.order-b.order).slice(0,count).map(x=>x.item);
}

// Module-level so the rail survives unmounting (e.g. switching to My assets and back).
const kept={items:[],urls:new Map()};
// Feed images are private, so they are fetched with the invitation header and
// held as object URLs for the session rather than re-requested every poll.
const feedImages=new Map();

export default function RecentIdentityVisualizations(){
 // The rail keeps the last real previews it was shown - across step changes,
 // a cleared set and route switches - and owns copies of the images, since the
 // generator revokes its object URLs when the set is cleared.
 const [live,setLive]=useState(()=>kept.items);
 useEffect(()=>{
  let cancelled=false;
  const update=async event=>{
   const items=(Array.isArray(event.detail?.items)?event.detail.items:[]).filter(item=>item?.status==='succeeded'&&item.imageUrl);
   if(!items.length)return;
   const next=[];
   for(const item of items.slice().reverse().slice(0,8)){
    let imageUrl=kept.urls.get(item.key);
    if(!imageUrl){
     try{const blob=await (await fetch(item.imageUrl)).blob();imageUrl=URL.createObjectURL(blob);kept.urls.set(item.key,imageUrl)}catch{continue}
    }
    next.push({key:item.key,name:item.name||'Real-world preview',imageUrl});
   }
   if(cancelled||!next.length)return;
   kept.items=next;setLive(next);
  };
  window.addEventListener('identity:previews',update);
  return()=>{cancelled=true;window.removeEventListener('identity:previews',update)};
 },[]);
 // The shared feed: the newest real previews across every visitor, kept for
 // good on the edge. This browser's own previews go first, then the feed, and
 // the demos only while no one has generated anything yet.
 const [feed,setFeed]=useState([]);
 useEffect(()=>{
  let stopped=false;
  const load=async()=>{try{
   const response=await accessFetch('/api/name-logo/recent');if(!response.ok)return;
   const data=await response.json();if(stopped)return;
   const next=[];
   for(const item of (data.items||[]).slice(0,12)){
    let imageUrl=feedImages.get(item.id);
    if(!imageUrl){
     const image=await accessFetch(item.url);if(!image.ok)continue;
     imageUrl=URL.createObjectURL(await image.blob());feedImages.set(item.id,imageUrl);
    }
    next.push({key:'recent:'+item.id,name:applicationSubjects.find(s=>s.id===item.template)?.name||(item.template||'preview').replace(/-/g,' ').replace(/^\w/,c=>c.toUpperCase()),imageUrl});
   }
   if(!stopped&&next.length)setFeed(next);
  }catch{}};
  load();const timer=setInterval(load,30000);
  return()=>{stopped=true;clearInterval(timer)};
 },[]);
 const demos=useMemo(()=>demoSamples(8),[]);
 const merged=[...live,...feed.filter(item=>!live.some(own=>own.key===item.key))].slice(0,12);
 const shown=merged.length?merged:demos;
 const open=item=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:item.imageUrl,alt:item.name}}));
 return <aside className="identity-showcase" aria-label={merged.length?'Latest generations':'Demo visualizations'}>
  <p className="eyebrow">{merged.length?'LATEST GENERATIONS':'DEMO VISUALIZATIONS'}</p>
  <div className="identity-showcase-strip"><div className="identity-showcase-track">{[...shown,...shown].map((item,index)=><figure key={`${item.key}-${index}`}>
   <button type="button" onClick={()=>open(item)} aria-label={`View ${item.name} full size`}><img src={item.imageUrl} alt={item.name} loading="lazy"/></button>
  </figure>)}</div></div>
  {!merged.length&&<small className="identity-showcase-note">{demoIdentityName} demos. Real generations appear here as they are made.</small>}
 </aside>;
}
