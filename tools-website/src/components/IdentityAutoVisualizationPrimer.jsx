import {useEffect,useRef} from 'react';
import {call,headers} from '../lib/name-logo-request.mjs';
import {automaticApplicationPicks} from './identityApplicationSubjects';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const terminal=new Set(['succeeded','failed','cancelled']);

export default function IdentityAutoVisualizationPrimer({request,designs=[],assets={},enabled=false,onUpdate}){
  const running=useRef(new Set());
  const urls=useRef(new Set());
  const controller=useRef(new AbortController());
  const storageKey=`l3v-active-visualizations:${request?.id||'none'}`;
  const readyDesigns=designs.slice(0,3).map(design=>!design?.placeholder&&assets[design.id]?.png?design:null);
  const readyKey=readyDesigns.map(design=>design?.id||'-').join(':');

  useEffect(()=>()=>{controller.current.abort();urls.current.forEach(url=>URL.revokeObjectURL(url))},[]);

  useEffect(()=>{
    if(!request?.id)return;
    let cancelled=false;
    (async()=>{
      try{
        const response=await call('visualization-list',request,{},controller.current.signal);
        for(const job of response?.visualizations||[]){
          if(cancelled||job.status!=='succeeded'||!job.output?.sourceDesignId||!job.output?.template)continue;
          const key=`${job.output.sourceDesignId}:${job.output.template}`;
          const imageResponse=await fetch(`/api/name-logo/visualization-image?id=${encodeURIComponent(job.id)}`,{headers:headers(request),signal:controller.current.signal});
          if(!imageResponse.ok)continue;
          const imageUrl=URL.createObjectURL(await imageResponse.blob());
          urls.current.add(imageUrl);
          const recovered={id:job.output.template,designId:job.output.sourceDesignId,key,jobId:job.id,imageId:job.id,status:'succeeded',imageUrl};
          let saved={};
          try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}')}catch{}
          saved[key]=recovered;
          sessionStorage.setItem(storageKey,JSON.stringify(saved));
          onUpdate(key,recovered);
        }
      }catch(error){if(error?.name!=='AbortError')console.warn('Could not recover completed visualizations')}
    })();
    return()=>{cancelled=true};
  },[request?.id,storageKey,onUpdate]);

  useEffect(()=>{
    let saved={};
    try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}')}catch{}
    const persist=(key,patch)=>{
      saved[key]={...saved[key],...patch};
      sessionStorage.setItem(storageKey,JSON.stringify(saved));
      onUpdate(key,saved[key]);
    };
    const picks=automaticApplicationPicks(readyDesigns);
    const tattooDesign=readyDesigns.find(design=>design?.mode==='logo')||readyDesigns.find(design=>design?.mode==='initials')||readyDesigns.find(Boolean);
    const tattooIndex=picks.findIndex(item=>item.id==='upper-arm-tattoo');
    if(tattooDesign&&tattooIndex>=0){
      picks[tattooIndex]={...picks[tattooIndex],designId:tattooDesign.id};
    }else if(tattooDesign){
      picks[0]={...picks[0],id:'upper-arm-tattoo',name:'Upper-arm tattoo',designId:tattooDesign.id};
    }
    picks.forEach(item=>{
      const key=`${item.designId}:${item.id}`;
      const prior=saved[key];
      if(running.current.has(key)||(!enabled&&!prior?.jobId))return;
      running.current.add(key);
      persist(key,{...item,key,status:prior?.status||'queued'});
      (async()=>{
        try{
          let jobId=prior?.status==='failed'?null:prior?.jobId;
          let job=prior?.status==='failed'?{}:(prior||{});
          if(!jobId){
            const response=await call('visualization-generate',request,{designId:item.designId,template:item.id},controller.current.signal);
            job=response?.job||response;
            jobId=job?.id||job?.jobId;
            if(!jobId)throw new Error('Visualization job was not accepted.');
            persist(key,{jobId,status:job.status||'queued'});
          }
          while(!terminal.has(job?.status)){
            await wait(2200);
            // The edge accepts exactly {id}. Sending a second field made every poll 400,
            // so every automatic preview failed even though its job had succeeded.
            const response=await call('visualization-status',request,{id:jobId},controller.current.signal);
            job=response?.job||response;
            persist(key,{jobId,status:job?.status||'running'});
          }
          if(job.status!=='succeeded')throw new Error(job.error||'Visualization generation failed.');
          const imageId=job?.id||jobId;
          const response=await fetch(`/api/name-logo/visualization-image?id=${encodeURIComponent(imageId)}`,{headers:headers(request),signal:controller.current.signal});
          if(!response.ok)throw new Error(`Visualization image could not be loaded (${response.status}).`);
          const imageUrl=URL.createObjectURL(await response.blob());
          urls.current.add(imageUrl);
          persist(key,{jobId,imageId,status:'succeeded',imageUrl});
        }catch(error){
          if(error?.name==='AbortError')return;
          // A saved preview whose job has aged out of the queue answers 404.
          // That is expiry, not a generation failure, and it is recoverable by
          // generating a fresh one rather than something to investigate.
          if(error?.status===404)persist(key,{status:'expired',error:'This preview expired and is no longer stored.'});
          else persist(key,{status:'failed',error:error?.message||'Visualization generation failed.'});
        }finally{running.current.delete(key)}
      })();
    });
  },[readyKey,enabled,request,storageKey,onUpdate]);

  return null;
}
