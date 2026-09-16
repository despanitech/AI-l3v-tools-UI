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
export default function Identity({tool}) {
 // Rehydrate from the saved request so returning to Step 1 with an active set
 // shows the name that set was generated from, rather than empty fields that
 // read as an edit and raise the regeneration warning.
 const [first,setFirst]=useState(()=>savedRequest()?.first||''),[last,setLast]=useState(()=>savedRequest()?.last||'');
 const [examples]=useState(randomExamples);
 const [lightbox,setLightbox]=useState(null);
 const localBuild=['localhost','127.0.0.1'].includes(location.hostname);
 const requestedStep=Number(new URLSearchParams(location.search).get('buildStep'));
 const routeStep=tool==='generating'?(requestedStep===3?3:4):tool==='demo'?4:requestedStep===2?2:1;
 const [activeStep,setActiveStep]=useState(routeStep);
 const [furthestStep,setFurthestStep]=useState(routeStep);
 const steps=['Enter name','Pick styles','Generate','See It Live'];
 useEffect(()=>{if(localBuild||tool==='demo'||tool==='generating')setActiveStep(routeStep)},[routeStep,localBuild,tool]);
 useEffect(()=>{if(!lightbox)return;const close=event=>{if(event.key==='Escape')setLightbox(null)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[lightbox]);
 useEffect(()=>{const open=event=>setLightbox(event.detail);window.addEventListener('identity:open-image',open);return()=>window.removeEventListener('identity:open-image',open)},[]);
 const imageLightbox=lightbox&&<div className="identity-image-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.alt} onClick={()=>setLightbox(null)}><button type="button" aria-label="Close full-size image" onClick={()=>setLightbox(null)}>Close</button><img src={lightbox.src} alt={lightbox.alt} onClick={event=>event.stopPropagation()}/></div>;
 function reportStep(number){setActiveStep(number);setFurthestStep(current=>Math.max(current,number))}
 function clearActiveSet(number){setActiveStep(number);setFurthestStep(number)}
 function openBuildStep(number){if(tool==='demo'||number===activeStep||number>furthestStep)return;const next=`${location.pathname}?buildStep=${number}#logo`;history.pushState(null,'',next);setActiveStep(number);window.dispatchEvent(new CustomEvent('identity-step-navigation',{detail:number}));window.dispatchEvent(new HashChangeEvent('hashchange'))}
 const stepper=<nav className="identity-stepper" aria-label={`Step ${activeStep} of 4`}><span className="identity-stepper-mobile">Step {activeStep} of 4 · {steps[activeStep-1]}</span>{steps.map((label,index)=>{const number=index+1,state=number<activeStep?'complete':number===activeStep?'active':'upcoming',content=<><b>{number<activeStep?'✓':String(number).padStart(2,'0')}</b><span>{label}</span></>;return number<=furthestStep&&number!==activeStep&&tool!=='demo'?<button type="button" className={`identity-step ${state}`} onClick={()=>openBuildStep(number)} key={label}>{content}</button>:<span className={`identity-step ${state}`} aria-current={number===activeStep?'step':undefined} key={label}>{content}</span>})}</nav>;
 if(['demo','generating'].includes(tool))return <section id="logo-panel" className="simple-name-entry identity-build-shell">{stepper}<IdentityResults generating={tool==='generating'} onBack={()=>openBuildStep(1)} />{imageLightbox}</section>;
 if(!['logo','initials','signature'].includes(tool))return null;
 return <section id="logo-panel" className="simple-name-entry identity-build-shell" aria-label="Magic Identity">{stepper}<div className="identity-entry-layout"><div className="identity-entry-main"><NameLogoGenerator buildStep={activeStep} intro={<> <div className="entry-samples" aria-label="Design examples">{examples.map((item,i)=>{const label=exampleLabels[item.category],w=item.category==='signature'?1774:1254,h=item.category==='signature'?887:1254;return <figure key={item.job}><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label} example in ${item.styleName} style`}><defs><filter id={`entry-ink-${i}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="luminance"/><feComposite in="luminance" in2="SourceAlpha" operator="in" result="ink"/><feFlood floodColor="currentColor"/><feComposite operator="in" in2="ink"/></filter></defs><image href={item.src} width={w} height={h} preserveAspectRatio="xMidYMid meet" filter={`url(#entry-ink-${i})`}/></svg><figcaption>{label} · {item.styleName}</figcaption></figure>})}</div><h1>Create your name logo and initials</h1></>} first={first} last={last} visible={true} onFirst={setFirst} onLast={setLast} onStepChange={reportStep} onActiveSetCleared={clearActiveSet} /></div><RecentIdentityVisualizations/></div>{imageLightbox}</section>;
}



