import {useEffect,useMemo,useState} from 'react';
import {applicationSubjects,demoPreviewImage} from '../lib/application-templates.mjs';

// The rail shows what it says: the previews of the identity being made, as
// they land, newest first. Before any exist it shows John Smith demos, and
// says so. Every tile opens full size.
const DEMO_MODES=['logo','initials','signature'];

function demoSamples(count){
 const pool=[];
 for(const mode of DEMO_MODES)for(const subject of applicationSubjects){const image=demoPreviewImage(subject,mode);if(image)pool.push({key:`${mode}:${subject.id}`,name:subject.name,imageUrl:image,demo:true})}
 return pool.map(item=>({item,order:crypto.getRandomValues(new Uint32Array(1))[0]})).sort((a,b)=>a.order-b.order).slice(0,count).map(x=>x.item);
}

// Module-level so the rail survives unmounting (e.g. switching to My assets and back).
const kept={items:[],urls:new Map()};

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
 const demos=useMemo(()=>demoSamples(8),[]);
 const shown=live.length?live:demos;
 const open=item=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:item.imageUrl,alt:item.name}}));
 return <aside className="identity-showcase" aria-label={live.length?'Recent visualizations':'Demo visualizations'}>
  <p className="eyebrow">{live.length?'RECENT VISUALIZATIONS':'DEMO VISUALIZATIONS'}</p>
  <div className="identity-showcase-strip"><div className="identity-showcase-track">{[...shown,...shown].map((item,index)=><figure key={`${item.key}-${index}`}>
   <button type="button" onClick={()=>open(item)} aria-label={`View ${item.name} full size`}><img src={item.imageUrl} alt={item.name} loading="lazy"/></button>
  </figure>)}</div></div>
  {!live.length&&<small className="identity-showcase-note">John Smith demos. Yours appear here as they are made.</small>}
 </aside>;
}
