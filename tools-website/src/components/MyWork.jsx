import {useEffect,useState} from 'react';
import {accessFetch,requestReceipt} from '../lib/master-access.mjs';
import {importAccountWork,savedReceipts} from '../lib/video-receipt.mjs';
import {remember,savedRequest,headers as nameLogoHeaders} from '../lib/name-logo-request.mjs';
import SupportProject from './SupportProject.jsx';
import DirectorPromo from './DirectorPromo.jsx';

const label=row=>row.resource_kind==='name-logo-job'?({logo:'Name logo',initials:'Initials',signature:'Signature'}[row.mode]||'Identity design'):({'analysis':'Analysis','first-frame':'First frame','video':'Video','name-logo-portfolio':'Identity collection','video-job':row.job_kind==='frame'?'First frame':row.job_kind==='video'?'Video':'Analysis'}[row.resource_kind]||row.resource_kind.replaceAll('-',' '));
const stageLabel=row=>row.mode?({logo:'Name logo',initials:'Initials',signature:'Signature'}[row.mode]||'Identity design'):row.stage_key?.startsWith('video_')?'Generated video':row.stage_key?.startsWith('frame_')?'First frame':'Identity design';

function AssetPreviews({rows}){
 const [items,setItems]=useState([]);
 useEffect(()=>{let live=true,objects=[];const controller=new AbortController();
  async function load(){
   try{
    const root=rows[0],receipt=await requestReceipt(root.request_id),access={requestId:root.request_id,receipt};
    if(root.scope==='name-logo'){
     const designs=rows.filter(row=>row.resource_kind==='name-logo-job').slice(0,6);
     const loaded=(await Promise.all(designs.map(async row=>{
      const response=await fetch('/api/name-logo/image?id='+encodeURIComponent(row.resource_id),{headers:nameLogoHeaders({access}),signal:controller.signal});
      if(!response.ok)return null;const src=URL.createObjectURL(await response.blob());objects.push(src);
      return {kind:'image',src,label:stageLabel(row)};
     }))).filter(Boolean);if(live)setItems(loaded);return;
    }
    const jobs=rows.filter(row=>row.resource_kind==='video-job').slice(-6),loaded=[];
    for(const row of jobs){
     const response=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json','X-L3V-Request-Id':access.requestId,'X-L3V-Request-Receipt':access.receipt},body:JSON.stringify({id:row.resource_id}),signal:controller.signal});
     if(!response.ok)continue;const data=await response.json();
     if(typeof data.video==='string')loaded.push({kind:'video',src:data.video,label:'Generated video'});
     else if(typeof data.image==='string'&&data.image.startsWith('data:image/'))loaded.push({kind:'image',src:data.image,label:'First frame'});
    }
    if(live)setItems(loaded.reverse());
   }catch(error){if(error.name!=='AbortError'&&live)setItems([])}
  }
  load();return()=>{live=false;controller.abort();objects.forEach(URL.revokeObjectURL)};
 },[rows]);
 if(!items.length)return null;
 return <div className="asset-preview-strip" aria-label="Saved work previews">{items.map((item,index)=><figure key={item.src+index}>{item.kind==='video'?<video src={item.src} muted playsInline preload="metadata" controls aria-label={item.label}/>:<img src={item.src} alt={item.label}/>}<figcaption>{item.label}</figcaption></figure>)}</div>;
}

export default function MyWork({hidden}){
 const [groups,setGroups]=useState([]),[message,setMessage]=useState('');
 useEffect(()=>{if(hidden)return;let live=true;async function load(){setMessage('Loading your assets…');try{const logo=savedRequest()?.access,receipts=[...savedReceipts(),...(logo?[logo]:[])],unique=[...new Map(receipts.map(item=>[item.requestId,item])).values()];await Promise.all(unique.map(access=>accessFetch('/api/account/claim',{method:'POST',headers:{'X-L3V-Request-Id':access.requestId,'X-L3V-Request-Receipt':access.receipt}}).catch(()=>null)));const response=await accessFetch('/api/account/work');if(!response.ok)throw Error();const {work=[]}=await response.json(),map=new Map();for(const row of work){const list=map.get(row.request_id)||[];list.push(row);map.set(row.request_id,list)}if(live){setGroups([...map.values()]);setMessage(work.length?'':'No assets yet. Your generated work will appear here.')}}catch{if(live)setMessage('Your asset library is temporarily unavailable.')}}load();return()=>{live=false}},[hidden]);
 async function open(rows){const root=rows[0];if(root.scope==='video'){await importAccountWork(rows);location.hash='video';location.reload();return}const portfolio=rows.find(r=>r.resource_kind==='name-logo-portfolio');if(!portfolio)return;remember({access:{requestId:root.request_id,receipt:await requestReceipt(root.request_id)},requestKey:root.request_id,id:portfolio.resource_id,first:portfolio.first||'',last:portfolio.last||''});location.hash='logo';location.reload()}
 return <section className="my-work" hidden={hidden}><p className="eyebrow">PRIVATE LIBRARY</p><h1>My assets</h1><p>Every retained analysis, first frame, video, logo, initials design and signature linked to this invitation.</p>{message&&<p role="status">{message}</p>}<div className="work-list">{groups.map(rows=><article key={rows[0].request_id}><div className="asset-card-copy"><strong>{rows[0].scope==='video'?'Video project':`Identity designs${rows.find(r=>r.first)?.first?' for '+rows.find(r=>r.first).first+' '+rows.find(r=>r.first).last:''}`}</strong><small>{new Date(rows[0].created).toLocaleString()}</small><div className="asset-types">{[...new Set(rows.map(label))].map(type=><span key={type}>{type}</span>)}</div></div><AssetPreviews rows={rows}/><button onClick={()=>open(rows)}>Open</button></article>)}</div><div className="asset-promos"><SupportProject variant="assets"/><DirectorPromo variant="assets"/></div></section>;
}
