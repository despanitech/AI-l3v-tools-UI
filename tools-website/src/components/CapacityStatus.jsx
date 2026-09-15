import {useEffect,useState} from 'react';
import {fetchCapacityStatus} from '../lib/capacity-status.mjs';

export default function CapacityStatus(){
 const localPreview=['localhost','127.0.0.1'].includes(location.hostname);
 const previewData={server:{loadPercent:5,memoryUsedPercent:18},queue:{running:0,maxRunning:20,inFlight:0,maxPending:200,availableRunning:20}};
 const [data,setData]=useState(localPreview?previewData:null);
 useEffect(()=>{let live=true,timer;const load=()=>fetchCapacityStatus().then(value=>{if(live)setData(value)}).catch(()=>{if(live)setData(localPreview?previewData:null)}).finally(()=>{if(live)timer=setTimeout(load,15000)});load();return()=>{live=false;clearTimeout(timer)}},[localPreview]);
 if(!data)return <span className="capacity-status unavailable" title="Live capacity is temporarily unavailable">Capacity unavailable</span>;
 const {queue,server}=data,pressure=queue.running>=queue.maxRunning||server.loadPercent>=85||server.memoryUsedPercent>=85;
 return <span className={`capacity-status${pressure?' pressure':''}`} aria-live="polite" title={`One-minute server load ${server.loadPercent}% of CPU count. Memory ${server.memoryUsedPercent}%. ${queue.availableRunning} running slots available.`}><i aria-hidden="true"/><span>Load {server.loadPercent}%</span><span>Running {queue.running}/{queue.maxRunning}</span><span>Jobs {queue.inFlight}/{queue.maxPending}</span></span>;
}
