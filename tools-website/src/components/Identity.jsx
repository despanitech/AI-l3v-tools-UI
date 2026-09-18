import {useEffect,useState} from 'react';
import IdentityResults from './IdentityResults.jsx';
import NameLogoGenerator from './NameLogoGenerator.jsx';
import RecentIdentityVisualizations from './RecentIdentityVisualizations.jsx';
import exampleLibrary from '../lib/identity-example-library.json';
import {savedRequest} from '../lib/name-logo-request.mjs';

const exampleLabels={logo:'Name logo',initials:'Initials',signature:'Signature'};
function randomExamples(){
 return ['logo','initials','signature'].map(category=>{
  const choices=exampleLibrary.filter(item=>item.category===category);
  const index=crypto.getRandomValues(new Uint32Array(1))[0]%choices.length;
  return choices[index];
 });
}
const PURCHASE_COPY={
 confirming:{title:'Confirming your payment',body:'Waiting for Stripe to confirm. This only takes a moment.'},
 preparing:{title:'Thanks for your payment',body:'Your bundle is being prepared. This page can be left open.'},
 ready:{title:'Thanks for your payment',body:'Your bundle is ready to download.'},
 'videos-failed':{title:'Your videos did not complete',body:'The images are ready, but the videos failed and nothing has been delivered. Retry them to finish your set.'},
 'videos-rejected':{title:'The video provider blocked this name',body:'Its content filter judged the name or artwork profane or explicit, so the videos cannot be made and nothing has been delivered. Start again with a different name or spelling.'},
 delivered:{title:'Saved to My assets',body:'Your bundle is stored in the library and stays available there.'},
 downloaded:{title:'Your bundle has been downloaded',body:'It stays available here. Download it again any time.'},
 unconfirmed:{title:'Payment not confirmed yet',body:'Nothing was prepared and you have not been charged twice. Reload in a moment, or contact support with your request reference.'},
};

function PurchaseBanner({state}){
 if(!state)return null;
 const copy=PURCHASE_COPY[state.stage==='ready'&&state.downloadedAt?'downloaded':state.stage==='videos-failed'&&state.videosContentRejected?'videos-rejected':state.stage]||PURCHASE_COPY.preparing;
 const done=state.stage==='ready',waiting=state.stage==='confirming',failed=state.stage==='unconfirmed';
 const percent=state.total?Math.round(state.ready/state.total*100):0;
 return <aside className={`identity-purchase-banner ${state.stage}`} role="status" aria-live="polite">
  <span className="identity-purchase-mark" aria-hidden="true">{done?'✓':failed?'!':''}</span>
  <div>
   <strong>{copy.title}</strong>
   <span>{copy.body}</span>
   {!waiting&&!failed&&state.total>0&&<div className="identity-purchase-meter"><i style={{width:`${percent}%`}}/></div>}
   {!waiting&&!failed&&state.total>0&&<small>{state.ready} of {state.total} ready{state.videosTotal?` · videos ${state.videosReady} of ${state.videosTotal}${state.videosRunning?` (${state.videosRunning} rendering${state.videosStartedAt?` since ${new Date(state.videosStartedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''})`:state.videosFailed?` (${state.videosFailed} failed)`:''}`:''}{state.packageName?` · ${state.packageName}`:''}</small>}
  </div>
  {done&&<button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('identity:download-bundle'))}>{state.downloadedAt?'Download again':'Download bundle'}</button>}
  {state.stage==='videos-failed'&&state.videosFailedReasons?.length>0&&<ul className="identity-purchase-reasons" aria-label="Why the videos failed">{state.videosFailedReasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul>}
  {state.stage==='videos-failed'&&!state.videosContentRejected&&<button type="button" className="is-retry" onClick={()=>window.dispatchEvent(new CustomEvent('identity:retry-videos'))}>Retry the failed videos</button>}
  {state.stage==='videos-failed'&&state.videosContentRejected&&<button type="button" className="is-retry" onClick={()=>window.dispatchEvent(new CustomEvent('identity:order-again'))}>Start again with a different name</button>}
 </aside>;
}

export default function Identity({tool}) {
 // Rehydrate from the saved request so returning to Step 1 with an active set
 // shows the name that set was generated from, rather than empty fields that
 // read as an edit and raise the regeneration warning.
 const [first,setFirst]=useState(()=>savedRequest()?.first||''),[last,setLast]=useState(()=>savedRequest()?.last||'');
 const [examples]=useState(randomExamples);
 const [lightbox,setLightbox]=useState(null);
 const [purchase,setPurchase]=useState(null);
 // Each step reports whether it has work in flight (designs, previews,
 // paid images, delivery). While any of them does, the step strip is locked:
 // walking away mid-run either abandons the work or confuses the state.
 const [working,setWorking]=useState({});
 const busy=Object.values(working).some(Boolean);
 useEffect(()=>{const update=event=>{const {source,busy}=event.detail||{};if(!source)return;setWorking(current=>current[source]===Boolean(busy)?current:{...current,[source]:Boolean(busy)})};window.addEventListener('identity:busy',update);return()=>window.removeEventListener('identity:busy',update)},[]);
 const localBuild=['localhost','127.0.0.1'].includes(location.hostname);
 const requestedStep=Number(new URLSearchParams(location.search).get('buildStep'));
 const routeStep=tool==='generating'?(requestedStep===3?3:4):tool==='demo'?4:requestedStep===2?2:1;
 const [activeStep,setActiveStep]=useState(routeStep);
 const [furthestStep,setFurthestStep]=useState(routeStep);
 const steps=['Enter name','Pick styles','Generate','See It Live'];
 useEffect(()=>{if(localBuild||tool==='demo'||tool==='generating')setActiveStep(routeStep)},[routeStep,localBuild,tool]);
 useEffect(()=>{if(!lightbox)return;const close=event=>{if(event.key==='Escape')setLightbox(null)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[lightbox]);
 useEffect(()=>{const open=event=>setLightbox(event.detail);window.addEventListener('identity:open-image',open);return()=>window.removeEventListener('identity:open-image',open)},[]);
 useEffect(()=>{const update=event=>setPurchase(event.detail);window.addEventListener('identity:purchase-state',update);return()=>window.removeEventListener('identity:purchase-state',update)},[]);
 const imageLightbox=lightbox&&<div className="identity-image-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.alt} onClick={()=>setLightbox(null)}><button type="button" aria-label="Close full-size image" onClick={()=>setLightbox(null)}>Close</button><img src={lightbox.src} alt={lightbox.alt} onClick={event=>event.stopPropagation()}/></div>;
 function reportStep(number){setActiveStep(number);setFurthestStep(current=>Math.max(current,number))}
 function clearActiveSet(number){setActiveStep(number);setFurthestStep(number)}
 function reachedStep(number){setFurthestStep(current=>Math.max(current,number))}
 // A delivered identity is finished: the bundle is in My assets and the
 // purchase no longer entitles. Walking back from it is the start of a new
 // order, so the name and set are cleared rather than reopening a request
 // that can only be refused at checkout.
 function openBuildStep(number){if(busy||tool==='demo'||number===activeStep||number>furthestStep)return;if(purchase?.stage==='delivered'&&number<4){window.dispatchEvent(new CustomEvent('identity:order-again'));return}const next=`${location.pathname}?buildStep=${number}#logo`;history.pushState(null,'',next);setActiveStep(number);window.dispatchEvent(new CustomEvent('identity-step-navigation',{detail:number}));window.dispatchEvent(new HashChangeEvent('hashchange'))}
 const stepper=<nav className={`identity-stepper${busy?' is-locked':''}`} aria-label={`Step ${activeStep} of 4`} aria-busy={busy||undefined}><span className="identity-stepper-mobile">Step {activeStep} of 4 · {steps[activeStep-1]}</span>{steps.map((label,index)=>{const number=index+1,state=number<activeStep?'complete':number===activeStep?'active':'upcoming',content=<><b>{number<activeStep?'✓':String(number).padStart(2,'0')}</b><span>{label}</span></>;return number<=furthestStep&&number!==activeStep&&tool!=='demo'?<button type="button" className={`identity-step ${state}`} disabled={busy} title={busy?'Please wait for the current work to finish':undefined} onClick={()=>openBuildStep(number)} key={label}>{content}</button>:<span className={`identity-step ${state}`} aria-current={number===activeStep?'step':undefined} key={label}>{content}</span>})}</nav>;
 if(['demo','generating'].includes(tool))return <section id="logo-panel" className="simple-name-entry identity-build-shell">{stepper}<IdentityResults generating={tool==='generating'} onBack={()=>openBuildStep(1)} />{imageLightbox}</section>;
 if(!['logo','initials','signature'].includes(tool))return null;
 return <section id="logo-panel" className="simple-name-entry identity-build-shell" aria-label="Magic Identity">{stepper}<PurchaseBanner state={purchase}/><div className="identity-entry-layout"><div className="identity-entry-main"><NameLogoGenerator buildStep={activeStep} intro={<> <div className="entry-samples" aria-label="Design examples">{examples.map((item,i)=>{const label=exampleLabels[item.category],w=item.category==='signature'?1774:1254,h=item.category==='signature'?887:1254;return <figure key={item.job}><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label} example in ${item.styleName} style`}><defs><filter id={`entry-ink-${i}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="luminance"/><feComposite in="luminance" in2="SourceAlpha" operator="in" result="ink"/><feFlood floodColor="currentColor"/><feComposite operator="in" in2="ink"/></filter></defs><image href={item.src} width={w} height={h} preserveAspectRatio="xMidYMid meet" filter={`url(#entry-ink-${i})`}/></svg><figcaption>{label} · {item.styleName}</figcaption></figure>})}</div><h1>Create your name logo and initials</h1></>} first={first} last={last} visible={true} onFirst={setFirst} onLast={setLast} onStepChange={reportStep} onReachable={reachedStep} onActiveSetCleared={clearActiveSet} /></div><RecentIdentityVisualizations/></div>{imageLightbox}</section>;
}



