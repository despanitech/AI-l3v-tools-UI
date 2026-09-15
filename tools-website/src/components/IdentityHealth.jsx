import {useEffect,useState} from 'react';
import {accessFetch} from '../lib/master-access.mjs';

export default function IdentityHealth(){
 const [snapshot,setSnapshot]=useState(null),[message,setMessage]=useState('Loading diagnostics...'),[version,setVersion]=useState(0);
 useEffect(()=>{const controller=new AbortController();setMessage('Loading diagnostics...');accessFetch('/api/name-logo/health',{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok&&body?.status!=='degraded')throw Error(body?.error||'Health check unavailable');setSnapshot(body);setMessage('')}).catch(error=>{if(error.name!=='AbortError')setMessage(error.message)});return()=>controller.abort()},[version]);
 const checks=snapshot?.checks||{},queue=snapshot?.queue||{},failures=snapshot?.recentFailures||[];
 return <section className="identity-health-page" aria-labelledby="identity-health-title">
  <header><div><p className="eyebrow">MAGIC IDENTITY OPERATIONS</p><h1 id="identity-health-title">System health</h1><p>Redacted, read-only production diagnostics.</p></div><button type="button" onClick={()=>setVersion(value=>value+1)}>Refresh</button></header>
  {message&&<p role="status">{message}</p>}
  {snapshot&&<><div className={`identity-health-status ${snapshot.status}`}><strong>{snapshot.status.toUpperCase()}</strong><span>Snapshot {snapshot.signature}</span><small>{snapshot.generatedAt}</small></div>
  <div className="identity-health-metrics"><article><span>Workers</span><strong>{snapshot.workers?.profilesReady}/{snapshot.workers?.configured}</strong><small>provider profiles ready</small></article><article><span>Memory</span><strong>{snapshot.server?.memory?.usedPercent??'--'}%</strong><small>host memory used</small></article><article><span>Release</span><strong>{snapshot.version}</strong><small>server revision</small></article></div>
  <section><h2>Checks</h2><div className="identity-health-checks">{Object.entries(checks).map(([name,healthy])=><article key={name}><i className={healthy?'ok':''}/><span>{name}</span><strong>{healthy?'Healthy':'Attention'}</strong></article>)}</div></section>
  <section><h2>Queue</h2><div className="identity-health-queue">{Object.entries(queue).flatMap(([kind,states])=>Object.entries(states).map(([state,count])=><article key={`${kind}-${state}`}><span>{kind}</span><strong>{count}</strong><small>{state}</small></article>))}</div></section>
  <section><h2>Recent failures</h2>{failures.length?<div className="identity-health-failures">{failures.map(item=><article key={item.jobId}><div><strong>{item.code}</strong><span>{item.kind} · {item.stage}</span></div><code>{item.traceId||item.jobId}</code><small>{item.created}</small></article>)}</div>:<p>No retained failures.</p>}</section></>}
 </section>
}
