import {useCallback,useEffect,useRef,useState} from 'react';
import SecurityCheck from './SecurityCheck.jsx';
import StyleCatalog from './StyleCatalog.jsx';
import VectorEditor from './VectorEditor.jsx';
import IdentityMockup from './IdentityMockup.jsx';
import IdentityGenerationStage from './IdentityGenerationStage.jsx';
import IdentityAutoVisualizationPrimer from './IdentityAutoVisualizationPrimer.jsx';
import {savedRequest,remember,createRequest,call,headers} from '../lib/name-logo-request.mjs';
import {accessFetch} from '../lib/master-access.mjs';

export default function NameLogoGenerator({first,last,visible,onFirst,onLast,intro,onStepChange,onActiveSetCleared,buildStep}){
 const localSample=typeof window!=='undefined'&&['localhost','127.0.0.1'].includes(window.location.hostname);
 const [config,setConfig]=useState(null),[selected,setSelected]=useState([{mode:'logo',id:'soft-angular'},{mode:'initials',id:'woven-serif'},{mode:'signature',id:'compact-autograph'}]),[request,setRequest]=useState(savedRequest),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[token,setToken]=useState(''),[message,setMessage]=useState(''),[assets,setAssets]=useState({}),[editing,setEditing]=useState(null),[mockup,setMockup]=useState(null);
 const [step,setStep]=useState(()=>localSample&&new URLSearchParams(location.search).get('buildStep')==='2'?'styles':'name');
 const active=useRef(null),cache=useRef({});
 const [showPackages,setShowPackages]=useState(false);
 const [manualStep,setManualStep]=useState(null);
 const [visualizations,setVisualizations]=useState({});
 const [autoVisualizations,setAutoVisualizations]=useState(false);
 const [regenerationWarning,setRegenerationWarning]=useState(null);
 const updateVisualization=useCallback((key,patch)=>setVisualizations(current=>({...current,[key]:{...current[key],...patch}})),[]);
 useEffect(()=>setVisualizations({}),[request?.id]);

 useEffect(()=>{if(localSample&&!request&&buildStep===1)setStep('name');if(localSample&&!request&&buildStep===2)setStep('styles')},[localSample,request,buildStep]);
 // Stripe returns to a fresh page load, where showPackages has reset to false
 // and the app would otherwise land on Step 3. Both outcomes return to the
 // package step: completed so the purchase can be confirmed, cancelled so the
 // choice can be made again.
 useEffect(()=>{
  if(!new URLSearchParams(location.search).get('purchase'))return;
  setShowPackages(true);setManualStep(4);
 },[]);
 useEffect(()=>{const navigate=event=>{const target=Number(event.detail);setManualStep(target);if(target===1||target===2)setStep(target===2?'styles':'name');if(target===3)setShowPackages(false);if(target===4)setShowPackages(true)};window.addEventListener('identity-step-navigation',navigate);return()=>window.removeEventListener('identity-step-navigation',navigate)},[]);

 useEffect(()=>{const c=new AbortController();accessFetch('/api/name-logo/catalog',{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{setConfig(data);setSelected(['logo','initials','signature'].map(mode=>({mode,id:data.styles?.find(s=>s.mode===mode)?.id||({logo:'soft-angular',initials:'woven-serif',signature:'compact-autograph'})[mode]})))}).catch(e=>{if(e.name!=='AbortError'){setConfig({enabled:false,styles:[]});setMessage('Could not connect. Refresh to try again.')}});return()=>{c.abort();active.current?.abort();Object.values(cache.current).forEach(a=>{URL.revokeObjectURL(a.png);if(a.svg)URL.revokeObjectURL(a.svg)})}},[]);

 useEffect(()=>{if(request?.id)poll(request)},[]);

 async function load(current,design,signal){if(cache.current[design.id])return;const base='/api/name-logo/image?id='+design.id,r=await fetch(base,{headers:headers(current),signal});if(!r.ok)throw Error();const item={png:URL.createObjectURL(await r.blob())};if(design.output?.svg){const v=await fetch(base+'&format=svg',{headers:headers(current),signal});if(v.ok){item.source=await v.text();item.svg=URL.createObjectURL(new Blob([item.source],{type:'image/svg+xml'}))}}cache.current[design.id]=item;setAssets({...cache.current})}
 async function poll(current){active.current?.abort();const c=new AbortController();active.current=c;setBusy(true);try{const deadline=Date.now()+15*60*1000;while(Date.now()<deadline){const data=await call('status',current,{id:current.id},c.signal);if(!data.designs?.length)throw Error();setResult(data);for(const d of data.designs)if(d.status==='succeeded')await load(current,d,c.signal);const ready=data.designs.filter(d=>d.status==='succeeded').length,settled=data.designs.filter(d=>!['queued','running'].includes(d.status)).length;setMessage(`${ready} of ${data.designs.length} designs ready`);if(settled===data.designs.length)return;await new Promise(r=>setTimeout(r,2500));c.signal.throwIfAborted()}setMessage('Still processing. Check progress again; your request is saved.')}catch(e){if(e.name!=='AbortError')setMessage('Connection interrupted. Your request is saved; check progress again.')}finally{if(active.current===c)setBusy(false)}}
 async function generate(){if(busy||request?.id||!token)return;let current;try{current=request||await createRequest(first,last,selected);remember(current)}catch{setMessage('This browser blocked safe request recovery. Open this invitation in Safari or Chrome, then try again.');return}setRequest(current);setAutoVisualizations(true);setBusy(true);const c=new AbortController();active.current=c;try{const selection=current.styles?{styles:current.styles}:{styleId:current.styleId};const data=await call('generate',current,{first:current.first,last:current.last,...selection,requestKey:current.requestKey,token},c.signal);if(!/^[a-f0-9]{64}$/.test(data.id))throw Error();const accepted={...current,id:data.id};remember(accepted);setRequest(accepted);await poll(accepted)}catch(e){if(e.name!=='AbortError')setMessage('Submission could not be confirmed. Recover the saved request; do not create another.')}finally{setBusy(false);setToken('')}}
 function changeName(){setShowPackages(false);active.current?.abort();remember(null);setRequest(null);setResult(null);setEditing(null);setMockup(null);setMessage('');setBusy(false);setStep('name');Object.values(cache.current).forEach(a=>{URL.revokeObjectURL(a.png);if(a.svg)URL.revokeObjectURL(a.svg)});cache.current={};setAssets({})}
 function invalidateActiveSet(target){active.current?.abort();remember(null);setRequest(null);setResult(null);setShowPackages(false);setManualStep(target);setAutoVisualizations(false);setVisualizations({});Object.values(cache.current).forEach(a=>{URL.revokeObjectURL(a.png);if(a.svg)URL.revokeObjectURL(a.svg)});cache.current={};setAssets({});onActiveSetCleared?.(target)}
 // Returning to step 1 with a finished set offers no way to begin again,
 // because retyping an identical name is not a change and nothing else clears
 // the active set. This does, keeping the name so it can be reused as is.
 function startAgain(){
  try{sessionStorage.removeItem('l3v.identity.purchase-intent')}catch{}
  window.dispatchEvent(new CustomEvent('identity:purchase-state',{detail:null}));
  invalidateActiveSet(1);
  setStep('name');
 }

 function requestChange(target,apply){if(!request){apply();return}setRegenerationWarning({target,apply})}
 function confirmChange(){if(!regenerationWarning)return;const {target,apply}=regenerationWarning;invalidateActiveSet(target);apply();setRegenerationWarning(null)}
 function changeFirst(value){requestChange(1,()=>onFirst(value))}
 function changeLast(value){requestChange(1,()=>onLast(value))}
 function changeStyles(value){requestChange(2,()=>setSelected(value))}

 if(!visible)return null;
 const generatedDesigns=result?.designs||[];
 const generationComplete=generatedDesigns.length>0&&generatedDesigns.every(design=>design.status==='succeeded');
 const currentStep=manualStep||(request?(generationComplete&&showPackages?4:3):step==='styles'?2:1);
 useEffect(()=>onStepChange?.(currentStep),[currentStep,onStepChange]);
 const viewingPast=Boolean(request&&(manualStep===1||manualStep===2));
 const generationFooter=step==='styles'?(request?<button className="identity-try-button" onClick={()=>setManualStep(3)}>Continue to generated designs →</button>:<button className="identity-try-button" disabled={!config?.enabled||selected.length!==3||selected.some(s=>!s.id)||!first.trim()||!last.trim()||!token||busy} onClick={generate}>Generate collection</button>):null;
 const generationSecurity=!request&&step==='styles'&&config?.enabled?<SecurityCheck config={config} action="name_logo" size="compact" onToken={setToken} onError={setMessage}/>:null;
 const recovery=request&&!request.id&&!busy&&config?.enabled?<div className="generation-recovery"><SecurityCheck config={config} action="name_logo" size="compact" onToken={setToken} onError={setMessage}/><button disabled={!token} onClick={generate}>Recover saved request</button></div>:null;

 return <>
  <section className="live-logo-generator" aria-label="Create your designs">
   {regenerationWarning&&<div className="identity-regeneration-warning" role="status"><div><strong>This change needs a new generation</strong><span>Your current generated set will remain saved unless you continue.</span></div><button type="button" onClick={()=>setRegenerationWarning(null)}>Keep current set</button><button type="button" className="confirm" onClick={confirmChange}>Change and regenerate</button></div>}
   {(!request||viewingPast)&&step==='name'&&intro}
   {(!request||viewingPast)&&<>{step==='name'?<><div className="shared-name"><label>Enter your first name<input id="first-name" value={first} maxLength={80} onChange={e=>changeFirst(e.target.value)}/></label><label>Enter your last name<input id="last-name" value={last} maxLength={80} onChange={e=>changeLast(e.target.value)}/></label></div><button className="identity-try-button" disabled={!first.trim()||!last.trim()} onClick={()=>{setStep('styles');if(request)setManualStep(2)}}>Continue →</button>{request&&<button type="button" className="identity-start-again" onClick={startAgain}>Start a new identity with this name</button>}</>:config&&<StyleCatalog first={first} last={last} styles={config.styles||[]} selected={selected} onChange={changeStyles} onEdit={()=>{setStep('name');if(request)setManualStep(1)}} security={generationSecurity} footer={generationFooter}/>}</>}
   {!config?.enabled&&<p role="status">{config?'Generation is not available yet.':'Checking availability...'}</p>}
   {!request&&<p role="status">{message}</p>}
   {request&&<IdentityAutoVisualizationPrimer request={request} designs={generatedDesigns} assets={assets} enabled={autoVisualizations} onUpdate={updateVisualization}/>} 
   {request&&!viewingPast&&<IdentityGenerationStage request={request} result={result} busy={busy} message={message} assets={assets} recovery={recovery} onPoll={request.id&&!busy?()=>poll(request):null} onReset={changeName} onEdit={id=>setEditing(id)} onMockup={id=>setMockup(id)} showPackages={showPackages} onNext={()=>{setShowPackages(true);setManualStep(4)}} visualizations={visualizations}/>} 
   {editing&&<VectorEditor key={editing} source={assets[editing].source} onClose={()=>setEditing(null)}/>} 
   {mockup&&<IdentityMockup key={mockup} request={request} designId={mockup} templates={config.visualizations||[]} onClose={()=>setMockup(null)}/>} 
  </section>
 </>
}
