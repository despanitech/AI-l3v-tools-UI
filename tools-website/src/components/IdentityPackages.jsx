import {useEffect,useRef,useState} from 'react';
import {zip,safeEntryName} from '../lib/zip.mjs';
import './IdentityPackages.css';
import {call,headers} from '../lib/name-logo-request.mjs';
import {applicationArtwork,applicationGroups,applicationPreviewImage,applicationPreviewStyle,applicationSubjects,recommendedApplications,selectionSubjects} from './identityApplicationSubjects';

const packages=[
 {id:'free',count:9,kicker:'FREE',price:'$0',name:'Try it',headline:'9 included previews',description:'Your nine generated real-world previews are included.',features:['Your generated random applications','No extra generation required','Standard resolution'],image:'/assets/signature-demos/david-villi-large-scale-signature-collage.png',position:'left bottom',example:'Tattoo preview',modalCopy:'Nine real-world applications generated with your identity.'},
 {id:'creator',count:10,kicker:'MOST POPULAR',price:'$5.99',oldPrice:'$9.99',name:'Creator set',headline:'10-image collection',description:'Receive 10 different application images built around your design.',features:['Distinct products and use cases','No recolors counted as another example','HD image downloads'],image:'/assets/signature-demos/david-villi-three-signatures-product-collage.png',position:'right top',example:'Perfume identity',modalCopy:'Ten different product and personal applications in HD.',recommended:true},
 {id:'studio',count:25,kicker:'COMPLETE',price:'$9.99',oldPrice:'$19.99',name:'Signature studio',headline:'25 images + videos',description:'Receive 25 distinct application images + videos and production-ready files.',features:['Distinct products, spaces, and use cases','No recolors counted as another example','4K image downloads','Short product and reveal videos'],image:'/assets/signature-demos/david-villi-large-scale-signature-collage.png',position:'left top',example:'Full brand rollout',modalCopy:'Twenty-five distinct applications plus short cinematic videos.'},
];

function ExampleModal({item,onClose}){
 useEffect(()=>{const close=e=>e.key==='Escape'&&onClose();document.addEventListener('keydown',close);document.body.classList.add('identity-package-modal-open');return()=>{document.removeEventListener('keydown',close);document.body.classList.remove('identity-package-modal-open')}},[onClose]);
 return <div className="identity-package-modal" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section role="dialog" aria-modal="true" aria-labelledby="identity-package-example-title"><button className="identity-package-close" type="button" onClick={onClose}>Close</button><p>{item.price==='\$0'?'FREE PACKAGE':`${item.price} PACKAGE`}</p><h2 id="identity-package-example-title">{item.headline}</h2><span>{item.modalCopy}</span><img src={item.image} style={{objectPosition:item.position}} alt={`${item.headline} example: ${item.example}`}/></section></div>;
}

const INTENT_KEY='l3v.identity.purchase-intent';

function readIntent(){
 try{
  const value=JSON.parse(sessionStorage.getItem(INTENT_KEY));
  return value&&Array.isArray(value.subjects)&&value.subjects.length?value:null;
 }catch{return null}
}

export default function IdentityPackages({request,name,designs=[]}){
 const [selected,setSelected]=useState('free');
 const [example,setExample]=useState(null);
 const [activeGroup,setActiveGroup]=useState('All');
 const [selectedSubjects,setSelectedSubjects]=useState(recommendedApplications.free);
 const [selectionSaved,setSelectionSaved]=useState(false);
 const [activeDesignId,setActiveDesignId]=useState(()=>designs.find(item=>/^[a-f0-9]{32}$/.test(item?.id))?.id||'');
 const [jobs,setJobs]=useState({});
 const [isGenerating,setIsGenerating]=useState(false);
 const [generationError,setGenerationError]=useState('');
 const [includedVisualizations,setIncludedVisualizations]=useState([]);
 const [previewsLoading,setPreviewsLoading]=useState(Boolean(request?.id));
 const [bundling,setBundling]=useState(false);
 const [bundleError,setBundleError]=useState('');
 const [entitlement,setEntitlement]=useState(null);
 const [checkingOut,setCheckingOut]=useState(false);
 const [purchaseStage,setPurchaseStage]=useState(()=>new URLSearchParams(location.search).get('purchase')==='complete'?'confirming':'');
 const [purchaseIntent,setPurchaseIntent]=useState(()=>readIntent());
 const [confirmingPayment,setConfirmingPayment]=useState(()=>new URLSearchParams(location.search).get('purchase')==='complete');
 const generationController=useRef(null);
 const generatedUrls=useRef(new Set());
 const chosen=packages.find(item=>item.id===selected);
 const paidFor=Boolean(entitlement&&entitlement.packageId===selected);
 const checkoutEnabled=entitlement?.enabled===true;
 const generatedTattoo=includedVisualizations.find(item=>item.output?.template?.includes('tattoo'))?.imageUrl;
 const generatedCreator=includedVisualizations.find(item=>['perfume-bottle','product-box','candle-jar','mailing-box'].includes(item.output?.template))?.imageUrl||includedVisualizations.find(item=>item.imageUrl!==generatedTattoo)?.imageUrl;
 const generatedStudio=includedVisualizations.find(item=>['storefront-sign','building-facade','event-tent','stadium-screen','cafe-umbrella'].includes(item.output?.template))?.imageUrl||includedVisualizations.find(item=>item.imageUrl!==generatedTattoo&&item.imageUrl!==generatedCreator)?.imageUrl;
 const generatedPackageImages={free:generatedTattoo,creator:generatedCreator,studio:generatedStudio};
 const packageCollage=(packageId)=>{
  if(!includedVisualizations.length)return [];
  if(packageId==='free'){
   const tattoo=includedVisualizations.find(item=>item.output?.template?.includes('tattoo'));
   return [...(tattoo?[tattoo]:[]),...includedVisualizations.filter(item=>item!==tattoo)].slice(0,6);
  }
  const offset={free:0,creator:3,studio:6}[packageId]||0;
  return Array.from({length:Math.min(6,includedVisualizations.length)},(_,index)=>includedVisualizations[(offset+index)%includedVisualizations.length]);
 };
 const availableDesigns=designs.filter(item=>/^[a-f0-9]{32}$/.test(item?.id));
 const visibleSubjects=activeGroup==='All'?selectionSubjects:selectionSubjects.filter(item=>item.group===activeGroup);
 const choosePackage=id=>{setSelected(id);setSelectedSubjects(recommendedApplications[id]||[]);setSelectionSaved(false)};
 const toggleSubject=id=>{setSelectionSaved(false);setSelectedSubjects(current=>current.includes(id)?current.filter(item=>item!==id):current.length<chosen.count?[...current,id]:current)};
 useEffect(()=>{if(!activeDesignId&&availableDesigns[0])setActiveDesignId(availableDesigns[0].id)},[activeDesignId,availableDesigns]);
 useEffect(()=>()=>{generationController.current?.abort();generatedUrls.current.forEach(URL.revokeObjectURL)},[]);
 useEffect(()=>{
  if(!request?.id){setPreviewsLoading(false);return}
  const controller=new AbortController();
  setPreviewsLoading(true);
  (async()=>{try{
   const response=await call('visualization-list',request,{},controller.signal);
   const completed=(response?.visualizations||[]).filter(item=>item.status==='succeeded'&&item.output?.template).slice(-9).sort((left,right)=>String(left.output.template).localeCompare(String(right.output.template))||String(left.id).localeCompare(String(right.id)));
   const loaded=await Promise.all(completed.map(async item=>{
    const image=await fetch(`/api/name-logo/visualization-image?id=${item.id}`,{headers:headers(request),signal:controller.signal});
    if(!image.ok)return null;
    const imageUrl=URL.createObjectURL(await image.blob());generatedUrls.current.add(imageUrl);
    const subject=applicationSubjects.find(candidate=>candidate.id===item.output.template);
    return {...item,imageUrl,name:subject?.name||item.output.template};
   }));
   setIncludedVisualizations(loaded.filter(Boolean));
  }catch(error){if(error.name!=='AbortError')setGenerationError('Included previews could not be loaded.')}finally{if(!controller.signal.aborted)setPreviewsLoading(false)}})();
  return()=>controller.abort();
 },[request?.id]);
 const updateJob=(subjectId,change)=>setJobs(current=>({...current,[subjectId]:{...current[subjectId],...change}}));
 const waitForVisualization=async(subjectId,signal,designId=activeDesignId,update=updateJob)=>{
  let result=await call('visualization-generate',request,{designId,template:subjectId},signal);
  update(subjectId,{id:result.id,status:result.status});
  while(['queued','running'].includes(result.status)){
   await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,2500);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))},{once:true})});
   result=await call('visualization-status',request,{id:result.id},signal);
   update(subjectId,{id:result.id,status:result.status});
  }
  if(result.status!=='succeeded')throw new Error('This visualization could not be completed.');
  const response=await fetch(`/api/name-logo/visualization-image?id=${result.id}`,{headers:headers(request),signal});
  if(!response.ok)throw new Error('The generated visualization could not be loaded.');
  const imageUrl=URL.createObjectURL(await response.blob());generatedUrls.current.add(imageUrl);
  update(subjectId,{status:'succeeded',imageUrl});
 };
 // Entitlement is read from the server. Returning from Stripe proves nothing
 // on its own; the webhook is what grants access.
 // Stripe redirects back the moment payment succeeds, but the webhook arrives
 // independently and usually a moment later. A single read on return would
 // find nothing and the button would still ask for payment, so after a
 // completed checkout the entitlement is polled until it appears.
 useEffect(()=>{
  if(!request?.access)return;
  let active=true,attempts=0;
  const returning=new URLSearchParams(location.search).get('purchase')==='complete';
  const clearReturn=()=>{
   const url=new URL(location.href);
   if(!url.searchParams.has('purchase'))return;
   url.searchParams.delete('purchase');
   history.replaceState(null,'',url.pathname+url.search+url.hash);
  };
  const read=async()=>{
   if(!active)return;
   attempts++;
   try{
    const data=await call('entitlement',request,{});
    if(!active)return;
    setEntitlement(data);
    if(data?.packageId){setConfirmingPayment(false);if(returning)setPurchaseStage('paid');clearReturn();return}
   }catch{}
   if(!active)return;
   // About a minute of polling, backing off so a lost webhook does not spin.
   if(returning&&attempts<20){setTimeout(read,attempts<5?2000:4000);return}
   if(returning){setConfirmingPayment(false);setPurchaseStage('unconfirmed');clearReturn();}
  };
  read();
  return()=>{active=false};
 },[request?.access?.requestId,selectionSaved]);

 const purchaseStarted=useRef(false);
 const trackedSubjects=purchaseStage?(purchaseIntent?.subjects||[]):selectedSubjects;
 const progress=trackedSubjects.reduce((total,id)=>{
  const status=jobs[id]?.status;
  if(status==='succeeded')total.done++;
  else if(status==='failed')total.failed++;
  else if(status==='running')total.running++;
  else if(status==='queued')total.queued++;
  else total.waiting++;
  return total;
 },{done:0,failed:0,running:0,queued:0,waiting:0});
 const progressTotal=trackedSubjects.length;
 const progressSettled=progress.done+progress.failed;
 const progressParts=[
  progress.running&&`${progress.running} generating`,
  progress.queued&&`${progress.queued} queued`,
  progress.waiting&&`${progress.waiting} waiting`,
  progress.failed&&`${progress.failed} failed`,
 ].filter(Boolean);
 const purchasedSubjects=purchaseIntent?.subjects||[];
 const purchasedReady=purchasedSubjects.map(id=>({id,job:jobs[id],subject:applicationSubjects.find(item=>item.id===id)}))
  .filter(item=>item.job?.status==='succeeded'&&item.job.imageUrl)
  .map(item=>({id:item.id,name:item.subject?.name||item.id,imageUrl:item.job.imageUrl}));
 const purchasedFailed=purchasedSubjects.filter(id=>jobs[id]?.status==='failed').length;

 // Once the webhook has confirmed payment, produce what was bought without
 // asking for another click. Re-running is safe: the gateway fingerprints
 // design+template and returns the existing job rather than charging again,
 // so a refresh mid-flight adopts the running jobs.
 useEffect(()=>{
  if(purchaseStage!=='paid'||!purchaseIntent||!request?.access||purchaseStarted.current)return;
  purchaseStarted.current=true;
  const controller=new AbortController();generationController.current=controller;
  const subjects=purchaseIntent.subjects;
  const designId=purchaseIntent.designId||activeDesignId;
  setJobs(Object.fromEntries(subjects.map(id=>[id,{status:'waiting'}])));
  let cursor=0;
  const worker=async()=>{
   while(cursor<subjects.length){
    const subjectId=subjects[cursor++];
    try{await waitForVisualization(subjectId,controller.signal,designId)}
    catch(error){if(error.name!=='AbortError')updateJob(subjectId,{status:'failed',error:error.message})}
   }
  };
  Promise.all(Array.from({length:Math.min(3,subjects.length)},worker)).then(()=>{
   if(controller.signal.aborted)return;
   setPurchaseStage('ready');
   try{sessionStorage.removeItem(INTENT_KEY)}catch{}
  });
 },[purchaseStage,purchaseIntent,request?.access?.requestId]);

 const startCheckout=async()=>{
  if(checkingOut)return;
  setGenerationError('');setCheckingOut(true);
  try{
   // The redirect discards component state, so what was bought has to outlive it.
   try{sessionStorage.setItem(INTENT_KEY,JSON.stringify({packageId:selected,subjects:selectedSubjects,designId:activeDesignId}))}catch{}
   const data=await call('checkout',request,{packageId:selected});
   if(!data?.url)throw Error();
   location.assign(data.url);
  }catch{
   setGenerationError('Could not start checkout. Please try again.');
   setCheckingOut(false);
  }
 };

 const bundleAndDownload=async(items=includedVisualizations,label='previews')=>{
  if(bundling||!items.length)return;
  setBundleError('');setBundling(true);
  try{
   const files=await Promise.all(items.map(async(item,index)=>{
    const response=await fetch(item.imageUrl);
    if(!response.ok)throw Error('unavailable');
    return {name:safeEntryName(item.name,index),bytes:new Uint8Array(await response.arrayBuffer())};
   }));
   const stem=String(name||'identity').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'identity';
   const url=URL.createObjectURL(zip(files));
   const link=document.createElement('a');
   link.href=url;link.download=`${stem}-${label}.zip`;
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setBundleError('Could not prepare the download. Your previews are still available above.')}
  finally{setBundling(false)}
 };

 const generateSelection=async()=>{
  if(selectedSubjects.length!==chosen.count||isGenerating)return;
  const detail={packageId:chosen.id,price:chosen.price,subjects:selectedSubjects};
  try{sessionStorage.setItem('l3v.identity.application-selection',JSON.stringify(detail))}catch{}
  window.dispatchEvent(new CustomEvent('identity:application-selection',{detail}));
  setSelectionSaved(true);
  if(!activeDesignId){setGenerationError('Choose a completed identity design before generating visualizations.');return}
  generationController.current?.abort();
  const controller=new AbortController();generationController.current=controller;
  setGenerationError('');setIsGenerating(true);setJobs(Object.fromEntries(selectedSubjects.map(id=>[id,{status:'waiting'}])));
  let cursor=0;
  const worker=async()=>{while(cursor<selectedSubjects.length){const subjectId=selectedSubjects[cursor++];try{await waitForVisualization(subjectId,controller.signal)}catch(error){if(error.name!=='AbortError')updateJob(subjectId,{status:'failed',error:error.message})}}};
  try{await Promise.all(Array.from({length:Math.min(3,selectedSubjects.length)},worker))}finally{if(!controller.signal.aborted)setIsGenerating(false)}
 };
 return <section className="identity-package-picker" aria-labelledby="identity-package-title">
  <header><p>NEXT STEP</p><h2 id="identity-package-title">Use {name||'your identity'} in the real world</h2><span>Three clear package options, with one corresponding example shown inside each choice.</span></header>
  <div className="identity-package-grid" role="radiogroup" aria-label="Visualization packages">{packages.map(item=>{const generatedImage=generatedPackageImages[item.id],collage=packageCollage(item.id),select=()=>choosePackage(item.id);return <article key={item.id} className={`identity-package-card${selected===item.id?' selected':''}`} role="radio" aria-checked={selected===item.id} tabIndex={0} onClick={event=>{if(!event.target.closest('button'))select()}} onKeyDown={event=>{if(event.target!==event.currentTarget||!['Enter',' '].includes(event.key))return;event.preventDefault();select()}}><div className="identity-package-kicker"><span>{item.kicker}</span>{item.recommended&&<b>RECOMMENDED</b>}<button type="button" onClick={()=>setExample({...item,image:generatedImage||item.image,position:generatedImage?'center':item.position})}>See example</button></div>{previewsLoading?<div className="identity-package-collage identity-package-collage-loading" aria-label="Loading generated image collage">{Array.from({length:6},(_,index)=><i key={index}/>)}</div>:collage.length?<div className="identity-package-collage" aria-label={`${item.name} generated image collage`}>{collage.map(preview=><div className="identity-package-collage-tile" key={preview.id}><img src={preview.imageUrl} alt={`${preview.name} visualization`}/><button type="button" onClick={event=>{event.stopPropagation();window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:preview.imageUrl,alt:`${preview.name} visualization`}}))}}>View</button></div>) }<span>{item.id.toUpperCase()} EXAMPLES</span><strong>{item.headline}</strong></div>:<button className="identity-package-image" type="button" aria-label={`See ${item.headline} example`} onClick={()=>setExample({...item,image:item.image,position:item.position})} style={{backgroundImage:`url(${item.image})`,backgroundPosition:item.position}}><span>{item.id.toUpperCase()} EXAMPLE</span><strong>{item.example}</strong></button>}<div className="identity-package-copy">{item.oldPrice&&<span className="identity-founder-badge">FOUNDER'S EDITION</span>}<p>{item.oldPrice&&<del>{item.oldPrice}</del>} {item.price}</p><h3>{item.name}</h3><span>{item.description}</span><ul>{item.features.map(feature=><li key={feature}>{feature}</li>)}</ul></div><button className="identity-package-select" type="button" aria-pressed={selected===item.id} onClick={()=>choosePackage(item.id)}>{selected===item.id?'Selected':`Choose ${item.name.replace(' set','').replace('Signature studio','Studio')}`}</button></article>})}</div>
  {purchaseStage?<section className="identity-purchase-flow" aria-live="polite">
   <header>
    <h3>{purchaseStage==='confirming'?'Confirming your payment':purchaseStage==='unconfirmed'?'Payment not confirmed yet':purchaseStage==='ready'?'Your collection is ready':'Preparing your collection'}</h3>
    <span>{purchaseStage==='confirming'?'Stripe has taken the payment. Waiting for confirmation before generating.'
      :purchaseStage==='unconfirmed'?'The payment confirmation has not arrived. Nothing was generated, and you have not been charged twice. Reload this page in a moment, or contact support with your request reference.'
      :purchaseStage==='ready'?'Every image in your package is ready to download.'
      :'Your images are being generated. This page can be left open.'}</span>
   </header>
   {purchaseStage!=='confirming'&&purchaseStage!=='unconfirmed'&&<div className="identity-generation-progress">
    <div className="identity-generation-bar"><i style={{width:`${progressTotal?Math.round(progressSettled/progressTotal*100):0}%`}}/></div>
    <p><strong>{progress.done}</strong> of {progressTotal} ready{progressParts.length?` - ${progressParts.join(', ')}`:''}</p>
    {purchaseStage!=='ready'&&<small>Each image is generated by a provider and takes a little while. This page can be left open.</small>}
   </div>}
   {purchasedReady.length>0&&<div className="identity-purchase-grid">{purchasedReady.map(item=><figure className="identity-viewable-image" key={item.id}><img src={item.imageUrl} alt={`${item.name} visualization`}/><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:item.imageUrl,alt:`${item.name} visualization`}}))}>View</button><figcaption><strong>{item.name}</strong></figcaption></figure>)}</div>}
   {purchaseStage==='ready'&&<button type="button" className="identity-bundle-download" disabled={bundling||!purchasedReady.length} onClick={()=>bundleAndDownload(purchasedReady,'collection')}>{bundling?'Preparing download...':`Bundle and download (${purchasedReady.length})`}</button>}
  </section>:selected==='free'?<section className="identity-included-previews" aria-labelledby="identity-included-title"><header><div><p>INCLUDED WITH FREE</p><h3 id="identity-included-title">Your generated applications</h3><span>These random previews were created while your identity was being prepared.</span></div><strong>{includedVisualizations.length} / 9 ready</strong></header><div>{includedVisualizations.map(item=><figure className="identity-viewable-image" key={item.id}><img src={item.imageUrl} alt={`${item.name} visualization`}/><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:item.imageUrl,alt:`${item.name} visualization`}}))}>View</button><figcaption><strong>{item.name}</strong><span>Included</span></figcaption></figure>)}</div></section>:<section className="identity-subject-picker" aria-labelledby="identity-subject-title">
   <header><div><p>MAKE IT YOURS</p><h3 id="identity-subject-title">Choose where your identity appears</h3><span>Pick {chosen.count} distinct, real-world applications. We started you with a balanced mix.</span></div><strong className={selectedSubjects.length===chosen.count?'complete':''}>{selectedSubjects.length} / {chosen.count} selected</strong></header>
   <nav aria-label="Application categories">{['All',...applicationGroups].map(group=><button key={group} type="button" className={activeGroup===group?'active':''} onClick={()=>setActiveGroup(group)}>{group}</button>)}</nav>
   {availableDesigns.length>1&&<div className="identity-artwork-choice"><span>ARTWORK TO APPLY</span>{availableDesigns.map((design,index)=><button key={design.id} type="button" className={activeDesignId===design.id?'active':''} onClick={()=>setActiveDesignId(design.id)}>{design.mode||['Name logo','Initials','Signature'][index]||`Design ${index+1}`}</button>)}</div>}
   <div className="identity-subject-grid">{visibleSubjects.map(subject=>{const checked=selectedSubjects.includes(subject.id);const unavailable=!checked&&selectedSubjects.length>=chosen.count;const job=jobs[subject.id];const imageUrl=job?.imageUrl||applicationPreviewImage(subject);const preview=job?.imageUrl?{backgroundImage:`url(${job.imageUrl})`,backgroundPosition:'center',backgroundSize:'cover'}:applicationPreviewStyle(subject);const artwork=applicationArtwork(subject);return <button key={subject.id} type="button" className={`${checked?'selected':''}${job?' has-job':''}`} aria-pressed={checked} disabled={unavailable||isGenerating} onClick={()=>toggleSubject(subject.id)}><span className="identity-subject-preview" style={preview}><span className="identity-subject-view" role="button" tabIndex="0" onClick={event=>{event.stopPropagation();window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:imageUrl,alt:`${subject.name} with ${artwork.label}`}}))}} onKeyDown={event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:imageUrl,alt:`${subject.name} with ${artwork.label}`}}))}}>View</span></span><span className={`identity-subject-check${job?.status==='running'?' is-running':''}`}>{job?.status==='running'?'':job?.status==='succeeded'?'OK':job?.status==='failed'?'!':checked?'OK':'+'}</span><div><strong>{subject.name}</strong><small>{job?.status==='succeeded'?'Ready':job?.status==='failed'?'Failed':job?job.status:`${subject.group} · ${artwork.label}`}</small></div></button>})}</div>
   <div className="identity-subject-actions"><button type="button" onClick={()=>{setSelectedSubjects(recommendedApplications[selected]);setSelectionSaved(false)}}>Restore suggested mix</button><button type="button" onClick={()=>{setSelectedSubjects([]);setSelectionSaved(false)}}>Clear all</button></div>
  </section>}
  {generationError&&<p className="identity-subject-error" role="alert">{generationError}</p>}
  {bundleError&&<p className="identity-subject-error" role="alert">{bundleError}</p>}
  {(isGenerating||progressSettled>0&&progressSettled<progressTotal)&&progressTotal>0&&<div className="identity-generation-progress" role="status" aria-live="polite">
   <div className="identity-generation-bar"><i style={{width:`${Math.round(progressSettled/progressTotal*100)}%`}}/></div>
   <p><strong>{progress.done}</strong> of {progressTotal} ready{progressParts.length?` - ${progressParts.join(', ')}`:''}</p>
   <small>Each image is generated by a provider and takes a little while. This page can be left open.</small>
  </div>}
  <footer><div><span>YOUR SELECTION</span><strong>{chosen.price} · {chosen.headline}{selected!=='free'&&` · ${selectedSubjects.length}/${chosen.count} applications`}</strong></div>{selected==='free'?<button type="button" className="identity-bundle-download" disabled={bundling||!includedVisualizations.length} onClick={bundleAndDownload}>{bundling?'Preparing download...':`Bundle and download${includedVisualizations.length?` (${includedVisualizations.length})`:''}`}</button>:paidFor?<button type="button" disabled={selectedSubjects.length!==chosen.count||isGenerating} onClick={generateSelection}>{isGenerating?(progress.done?`${progress.done}/${chosen.count} ready`:progress.running?`Generating ${progress.running}...`:'Starting...'):selectionSaved&&Object.values(jobs).some(job=>job.status==='succeeded')?'Generation complete':`Generate ${chosen.count} images`}</button>:confirmingPayment?<button type="button" disabled>Confirming payment...</button>:checkoutEnabled?<button type="button" className="identity-checkout-start" disabled={checkingOut||selectedSubjects.length!==chosen.count} onClick={startCheckout}>{checkingOut?'Opening checkout...':`Continue to payment · ${chosen.price}${entitlement?.mode==='test'?' (test mode)':''}`}</button>:<button type="button" disabled>Payment setup in progress</button>}</footer>
  {example&&<ExampleModal item={example} onClose={()=>setExample(null)}/>} 
 </section>;
}





