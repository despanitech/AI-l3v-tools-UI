import {useEffect,useRef,useState} from 'react';
import {zip,safeEntryName} from '../lib/zip.mjs';
import './IdentityPackages.css';
import {call,headers} from '../lib/name-logo-request.mjs';
import {accessFetch} from '../lib/master-access.mjs';
import {pickVideoSubjects} from '../lib/video-picks.mjs';
import {ARTWORK_SHORT,artworkCounts,balanceArtwork,nextArtwork} from '../lib/artwork-mix.mjs';
import {failureText,retryText} from '../lib/failure-copy.mjs';
import {INCLUDED_PREVIEWS} from '../../generation-allowance.mjs';
import {applicationArtwork,applicationGroups,applicationPreviewImage,applicationPreviewStyle,applicationSubjects,recommendedApplications,selectionSubjects} from './identityApplicationSubjects';

const packages=[
 {id:'free',count:5,kicker:'FREE',price:'$0',name:'Try it',headline:'5 included previews',description:'Your five generated real-world previews are included.',features:['Your generated random applications','No extra generation required','Standard resolution'],image:'/assets/signature-demos/david-villi-large-scale-signature-collage.png',position:'left bottom',example:'Tattoo preview',modalCopy:'Five real-world applications generated with your identity.'},
 {id:'creator',count:10,videos:0,kicker:'MOST POPULAR',price:'$5.99',oldPrice:'$9.99',name:'Creator set',headline:'10-image collection',description:'Receive 10 different application images built around your design.',features:['Distinct products and use cases','No recolors counted as another example','HD image downloads'],image:'/assets/signature-demos/david-villi-three-signatures-product-collage.png',position:'right top',example:'Perfume identity',modalCopy:'Ten different product and personal applications in HD.',recommended:true},
 {id:'studio',count:15,videos:2,kicker:'COMPLETE',price:'$9.99',oldPrice:'$19.99',name:'Signature studio',headline:'15 images + 2 videos',description:'Receive 15 distinct application images, two 5-second videos and production-ready files.',features:['Distinct products, spaces, and use cases','No recolors counted as another example','4K image downloads','Two 5-second product and reveal videos'],image:'/assets/signature-demos/david-villi-large-scale-signature-collage.png',position:'left top',example:'Full brand rollout',modalCopy:'Fifteen distinct applications plus two short cinematic videos.'},
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
 // Back from checkout the intent says what was bought; showing it while the
 // payment is confirmed keeps the free package from looking selected.
 const [selected,setSelected]=useState(()=>readIntent()?.packageId||'free');
 const [example,setExample]=useState(null);
 const [activeGroup,setActiveGroup]=useState('All');
 const [selectedSubjects,setSelectedSubjects]=useState(()=>{const intent=readIntent();return intent?.subjects?.length?intent.subjects:recommendedApplications[intent?.packageId]||recommendedApplications.free});
 // Which artwork each product carries. Left alone, the set is split evenly
 // across the designs; the buyer can change any product.
 const [artworkBySubject,setArtworkBySubject]=useState(()=>readIntent()?.artwork||{});
 const [selectionSaved,setSelectionSaved]=useState(false);
 const [activeDesignId,setActiveDesignId]=useState(()=>designs.find(item=>/^[a-f0-9]{32}$/.test(item?.id))?.id||'');
 const [jobs,setJobs]=useState({});
 const [isGenerating,setIsGenerating]=useState(false);
 const [generationError,setGenerationError]=useState(''),[spent,setSpent]=useState(false);
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
 // A package already bought shows what it bought, but the other paid package
 // must remain purchasable, and the state must be legible rather than the
 // payment control simply vanishing.
 const paidPackageName=packages.find(item=>item.id===(entitlement?.packageId||entitlement?.fulfilledPackageId))?.name||'';
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
 const activeMode=availableDesigns.find(item=>item.id===activeDesignId)?.mode||'';
 const designModes=availableDesigns.map(item=>item.mode).filter(Boolean);
 const naturalArtwork=id=>applicationArtwork(applicationSubjects.find(item=>item.id===id)||{id}).mode;
 useEffect(()=>{if(!designModes.length)return;setArtworkBySubject(current=>balanceArtwork(selectedSubjects,designModes,current,naturalArtwork))},[selectedSubjects,designModes.join(',')]);
 const artworkFor=id=>(purchaseIntent?.artwork||artworkBySubject)[id]||activeMode;
 const designFor=id=>availableDesigns.find(item=>item.mode===artworkFor(id))?.id||purchaseIntent?.designId||activeDesignId;
 const cycleArtwork=id=>setArtworkBySubject(current=>({...current,[id]:nextArtwork(current[id]||activeMode,designModes)}));
 const applyArtworkToAll=()=>setArtworkBySubject(Object.fromEntries(selectedSubjects.map(id=>[id,activeMode])));
 const balanceEvenly=()=>setArtworkBySubject(balanceArtwork(selectedSubjects,designModes,{},naturalArtwork));
 const mixCounts=artworkCounts(purchaseIntent?.artwork||artworkBySubject,selectedSubjects);
 const visibleSubjects=activeGroup==='All'?selectionSubjects:selectionSubjects.filter(item=>item.group===activeGroup);
 // Once a package is paid for, the order is fixed: no upgrade, downgrade or
 // change of applications while the bundle is being made or after delivery.
 const choosePackage=id=>{if(locked)return;setSelected(id);setSelectedSubjects(recommendedApplications[id]||[]);setSelectionSaved(false)};
 // A paid entitlement is the only thing this step can be about. Selection
 // starts at "free" on every mount - a reload, another tab, or walking back
 // to this step - so without this the bought package compared unequal to the
 // selection, looked unpaid, and generation never started. The subjects come
 // from the checkout intent when this tab still has it, and otherwise from
 // the package's recommended set; the gateway fingerprints design+template,
 // so nothing already made is paid for twice.
 useEffect(()=>{
  // A delivered package is shown as the bought one too; it does not entitle
  // (packageId is null then), so nothing starts generating from this.
  const paid=entitlement?.packageId||entitlement?.fulfilledPackageId;
  if(!paid||selected===paid)return;
  setSelected(paid);
  setSelectedSubjects(purchaseIntent?.subjects?.length?purchaseIntent.subjects:(recommendedApplications[paid]||[]));
 },[entitlement?.packageId,entitlement?.fulfilledPackageId]);
 const toggleSubject=id=>{if(locked)return;setSelectionSaved(false);setSelectedSubjects(current=>current.includes(id)?current.filter(item=>item!==id):current.length<chosen.count?[...current,id]:current)};
 useEffect(()=>{if(!activeDesignId&&availableDesigns[0])setActiveDesignId(availableDesigns[0].id)},[activeDesignId,availableDesigns]);
 useEffect(()=>()=>{generationController.current?.abort();generatedUrls.current.forEach(URL.revokeObjectURL)},[]);
 // Previews are usually still generating when step 4 is reached, so one read
 // returns an empty list. The retry loop lives inside this effect: driving it
 // from a dependency re-ran the effect, and its cleanup aborted the in-flight
 // image fetches before they could finish, so the list never populated.
 useEffect(()=>{
  if(!request?.id){setPreviewsLoading(false);return}
  const controller=new AbortController();
  let cancelled=false,attempts=0;
  if(!includedVisualizations.length)setPreviewsLoading(true);
  const read=async()=>{
   if(cancelled)return;
   try{
    const response=await call('visualization-list',request,{},controller.signal);
    const completed=(response?.visualizations||[]).filter(item=>item.status==='succeeded'&&item.output?.template).slice(-9)
     .sort((left,right)=>String(left.output.template).localeCompare(String(right.output.template))||String(left.id).localeCompare(String(right.id)));
    const loaded=await Promise.all(completed.map(async item=>{
     const image=await fetch(`/api/name-logo/visualization-image?id=${encodeURIComponent(item.id)}`,{headers:headers(request),signal:controller.signal});
     if(!image.ok)return null;
     const imageUrl=URL.createObjectURL(await image.blob());generatedUrls.current.add(imageUrl);
     const subject=applicationSubjects.find(candidate=>candidate.id===item.output.template);
     return {...item,imageUrl,name:subject?.name||item.output.template};
    }));
    if(cancelled)return;
    const items=loaded.filter(Boolean);
    setIncludedVisualizations(items);
    setPreviewsLoading(false);
    if(items.length>=INCLUDED_PREVIEWS)return;
   }catch(error){
    if(error.name==='AbortError'||cancelled)return;
    setGenerationError('Included previews could not be loaded.');
    setPreviewsLoading(false);
   }
   // About three minutes, then stop rather than poll a stalled request forever.
   if(!cancelled&&++attempts<40)setTimeout(read,5000);
  };
  read();
  return()=>{cancelled=true;controller.abort()};
 },[request?.id]);
 const updateJob=(subjectId,change)=>setJobs(current=>({...current,[subjectId]:{...current[subjectId],...change}}));
 const waitForVisualization=async(subjectId,signal,designId=activeDesignId,update=updateJob)=>{
  let result=await call('visualization-generate',request,{designId,template:subjectId},signal);
  update(subjectId,{id:result.id,status:result.status,retry:result.retry||null});
  while(['queued','running'].includes(result.status)){
   await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,2500);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))},{once:true})});
   result=await call('visualization-status',request,{id:result.id},signal);
   update(subjectId,{id:result.id,status:result.status,retry:result.retry||null});
  }
  if(result.status!=='succeeded'){const error=new Error(failureText(result.diagnostic,'This visualization could not be completed.'));error.diagnostic=result.diagnostic||null;throw error}
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
 // Studio's clips: started once the images are in, tracked by the preview
 // they were made from, and delivery waits for them.
 const [videos,setVideos]=useState({});
 const deliveryStarted=useRef(false);
 const [deliveredHere,setDelivered]=useState(false);
 // Delivery is a fact on the server, so a reload or another tab shows the
 // identity as finished instead of offering the package for sale again.
 const delivered=deliveredHere||Boolean(entitlement?.fulfilledAt);
 const locked=Boolean(purchaseStage||paidFor||delivered||checkingOut);
 const trackedSubjects=purchaseIntent?.subjects?.length?purchaseIntent.subjects:selectedSubjects;
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
 const generatedItems=trackedSubjects
  .map(id=>({id,job:jobs[id],subject:applicationSubjects.find(item=>item.id===id)}))
  .filter(item=>item.job?.status==='succeeded'&&item.job.imageUrl)
  .map(item=>({id:item.id,name:item.subject?.name||item.id,imageUrl:item.job.imageUrl}));
 const selectionShort=Math.max(0,chosen.count-selectedSubjects.length);
 const imagesReady=generatedItems.length>0&&progressSettled===progressTotal;
 const videosTotal=paidFor?Math.min(chosen.videos||0,designModes.length):0;
 const videoList=Object.values(videos);
 const videosReady=videoList.filter(item=>item.status==='succeeded'&&item.video).length;
 const videosRunning=videoList.some(item=>!['succeeded','failed'].includes(item.status));
 const videosFailed=videoList.filter(item=>item.status==='failed').length;
 // Every clip that was paid for has to be in. A failed clip does not settle
 // the set - it stops delivery and is offered for retry.
 const videosSettled=videosTotal===0||videosReady>=videosTotal;
 const videosBlocked=videosTotal>0&&imagesReady&&!videosRunning&&videosFailed>0&&videosReady<videosTotal;
 // Nothing says "ready" - not the bar, not the banner, not Download - until
 // the clips are in as well. A set with clips still rendering is not done.
 const bundleReady=imagesReady&&videosSettled;
 const stepsTotal=progressTotal+videosTotal,stepsDone=progressSettled+videosReady;
 const generationFinished=progressTotal>0&&progressSettled===progressTotal&&generatedItems.length>0;
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
  // Paying is the instruction. Nothing else should have to be pressed, whether
  // the buyer is returning from Stripe or arriving already entitled.
  if(!paidFor||!request?.access||purchaseStarted.current)return;
  const subjects=purchaseIntent?.subjects?.length?purchaseIntent.subjects:selectedSubjects;
  if(!subjects.length)return;
  purchaseStarted.current=true;
  const controller=new AbortController();generationController.current=controller;
  setIsGenerating(true);
  setJobs(Object.fromEntries(subjects.map(id=>[id,{status:'waiting'}])));
  let cursor=0;
  const worker=async()=>{
   while(cursor<subjects.length){
    const subjectId=subjects[cursor++];
    try{await waitForVisualization(subjectId,controller.signal,designFor(subjectId))}
    catch(error){if(error.name!=='AbortError')updateJob(subjectId,{status:'failed',error:error.status===403?'Not included in your package.':error.message})}
   }
  };
  Promise.all(Array.from({length:Math.min(8,subjects.length)},worker)).then(()=>{
   if(controller.signal.aborted)return;
   setIsGenerating(false);
   setPurchaseStage('ready');
   try{sessionStorage.removeItem(INTENT_KEY)}catch{}
  });
 },[paidFor,purchaseIntent,request?.access?.requestId]);

 // The buyer should see this without scrolling, so the state is published for
 // the shell to render under the step strip. Same pattern as the lightbox.
 useEffect(()=>{
  const detail=(purchaseStage||paidFor||delivered)?{
   stage:purchaseStage==='confirming'?'confirming':purchaseStage==='unconfirmed'?'unconfirmed':delivered?'delivered':bundleReady?'ready':videosBlocked?'videos-failed':'preparing',
   packageName:paidPackageName||'',
   downloadedAt:entitlement?.downloadedAt||null,
   // After a reload nothing is held in memory, so a delivered identity would
   // read "0 of 10 ready" under a banner saying the bundle is stored.
   ready:delivered?0:stepsDone,
   total:delivered?0:stepsTotal,
   videosReady:delivered?0:videosReady,
   videosTotal:delivered?0:videosTotal,
  }:null;
  window.dispatchEvent(new CustomEvent('identity:purchase-state',{detail}));
 },[purchaseStage,paidFor,delivered,bundleReady,paidPackageName,generatedItems.length,progressTotal,entitlement?.downloadedAt,videosReady,videosTotal]);

 useEffect(()=>{
  const download=()=>{if(delivered)downloadStoredBundle();else if(bundleReady)bundleAndDownload(generatedItems,'bundle')};
  window.addEventListener('identity:download-bundle',download);
  return()=>window.removeEventListener('identity:download-bundle',download);
 },[bundleReady,generatedItems,bundling]);

 // Test mode only: a paid request can never show Pay again, so without this
 // the payment flow cannot be exercised twice without generating a new
 // identity and spending provider calls. The edge refuses it in live mode.
 const resetPurchase=async()=>{
  try{
   await call('purchase-reset',request,{});
   purchaseStarted.current=false;
   setJobs({});setPurchaseStage('');setPurchaseIntent(null);setEntitlement(null);
   try{sessionStorage.removeItem(INTENT_KEY)}catch{}
   window.dispatchEvent(new CustomEvent('identity:purchase-state',{detail:null}));
   const data=await call('entitlement',request,{});setEntitlement(data);
  }catch{setGenerationError('The test purchase could not be cleared.')}
 };

 // Delivery: once the images exist, store the bundle durably and mark the
 // purchase fulfilled. Storing first matters - the purchase stops entitling
 // once fulfilled, so doing it the other way round could leave a buyer with
 // neither an entitlement nor a bundle.
 useEffect(()=>{
  if(!paidFor||!bundleReady||!videosSettled||!request?.access||deliveryStarted.current)return;
  deliveryStarted.current=true;
  (async()=>{
   try{
    await call('bundle-build',request,{name:name||''});
    await call('fulfil',request,{});
    // My assets lists work claimed for the account. The bundle is already
    // stored under it; the claim makes the card appear.
    await accessFetch('/api/account/claim',{method:'POST',headers:{'X-L3V-Request-Id':request.access.requestId,'X-L3V-Request-Receipt':request.access.receipt}}).catch(()=>{});
    setDelivered(true);
    window.dispatchEvent(new CustomEvent('identity:purchase-delivered'));
    // Delivery finishes the identity. The set and the name leave the working
    // context, so the next visit to step 1 asks for a name, and the buyer is
    // taken to My assets, where the bundle now lives.
    window.dispatchEvent(new CustomEvent('identity:order-again'));
    location.hash='assets';
   }catch{
    // Leave the entitlement intact so delivery can be retried on reload.
    deliveryStarted.current=false;
    setGenerationError('Your images are ready but could not be saved to My assets yet.');
   }
  })();
 },[paidFor,bundleReady,videosSettled,request?.access?.requestId,name]);

 // One clip per design, started the moment the first image of that design is
 // in - not after the whole set. Motion-friendly products are preferred when
 // more than one has finished. A design whose images all failed gets no clip.
 const startedModes=useRef(new Set()),startAttempts=useRef({});
 // Clips are submitted one after another: three at once raced on the
 // purchase record at the edge and two of them were forgotten.
 const startQueue=useRef(Promise.resolve());
 const [retryTick,setRetryTick]=useState(0);
 // Clear the failed clips and let the start effect submit them again.
 function retryVideos(){
  setVideos(current=>Object.fromEntries(Object.entries(current).filter(([,item])=>item.status!=='failed')));
  for(const [,item] of Object.entries(videos))if(item.status==='failed'&&item.mode)startedModes.current.delete(item.mode);
  setRetryTick(tick=>tick+1);
 }
 useEffect(()=>{
  if(!paidFor||!videosTotal||!request?.access)return;
  for(const mode of designModes.slice(0,videosTotal)){
   if(startedModes.current.has(mode))continue;
   const finished=generatedItems.filter(item=>artworkFor(item.id)===mode&&jobs[item.id]?.id);
   if(!finished.length){
    if(imagesReady){startedModes.current.add(mode);setVideos(current=>({...current,['none-'+mode]:{status:'failed',mode,name:`${ARTWORK_SHORT[mode]||mode} video`,error:'No finished image to make this video from.'}}))}
    continue;
   }
   const pick=pickVideoSubjects(finished,1)[0];
   startedModes.current.add(mode);
   setVideos(current=>({...current,[pick.id]:{status:'starting',mode,name:pick.name,startedAt:Date.now()}}));
   const started=startQueue.current.catch(()=>{}).then(()=>call('visualization-video',request,{id:jobs[pick.id].id}));
   startQueue.current=started;
   started
    .then(created=>setVideos(current=>({...current,[pick.id]:{...current[pick.id],jobId:created.id,status:['queued','running','succeeded'].includes(created.status)?created.status:'queued',video:created.video||null}})))
    .catch(error=>{
     // A refused start cost nothing. The preview may simply not be stored
     // yet, so try again a few times before giving up on this clip.
     const attempts=(startAttempts.current[mode]||0)+1;startAttempts.current[mode]=attempts;
     if(error.status!==403&&attempts<4){setVideos(current=>({...current,[pick.id]:{...current[pick.id],status:'starting',error:null}}));setTimeout(()=>{startedModes.current.delete(mode);setRetryTick(tick=>tick+1)},15000);return}
     setVideos(current=>({...current,[pick.id]:{...current[pick.id],status:'failed',error:error.status===403?'Not included in your package.':'This video could not be started.'}}));
    });
  }
 },[paidFor,videosTotal,imagesReady,generatedItems.length,request?.access?.requestId,retryTick]);
 // Poll every clip that is still work, five seconds apart, until none is.
 useEffect(()=>{
  const pending=Object.entries(videos).filter(([,item])=>item.jobId&&['queued','running'].includes(item.status));
  if(!pending.length||!request?.access)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   for(const [subject,item] of pending){
    try{const state=await call('visualization-video-status',request,{id:item.jobId},controller.signal);
     // Only queued and running are still work. Anything else the backend
     // reports - failed, ambiguous, expired - is over, or the wait never ends.
     const status=state.status==='succeeded'?(state.video?'succeeded':'running'):['queued','running'].includes(state.status)?state.status:'failed';
     setVideos(items=>({...items,[subject]:{...items[subject],status,video:state.video||null,error:status==='failed'?failureText(state.diagnostic,state.error||'This video could not be completed.'):null}}))}
    catch(error){if(error.name==='AbortError')return;if(error.status===404)setVideos(items=>({...items,[subject]:{...items[subject],status:'failed',error:'This video expired.'}}))}
   }
  },5000);
  return()=>{clearTimeout(timer);controller.abort()};
 },[videos,request?.access?.requestId]);

 const packagesBusy=Boolean(isGenerating||videosRunning||confirmingPayment||bundling||(purchaseStage&&purchaseStage!=='ready'&&purchaseStage!=='unconfirmed'&&!delivered));
 useEffect(()=>{window.dispatchEvent(new CustomEvent('identity:busy',{detail:{source:'packages',busy:packagesBusy}}))},[packagesBusy]);
 useEffect(()=>()=>window.dispatchEvent(new CustomEvent('identity:busy',{detail:{source:'packages',busy:false}})),[]);

 const startCheckout=async()=>{
  if(checkingOut)return;
  setGenerationError('');setSpent(false);setCheckingOut(true);
  try{
   // The redirect discards component state, so what was bought has to outlive it.
   try{sessionStorage.setItem(INTENT_KEY,JSON.stringify({packageId:selected,subjects:selectedSubjects,designId:activeDesignId,artwork:artworkBySubject}))}catch{}
   const data=await call('checkout',request,{packageId:selected});
   if(!data?.url)throw Error();
   location.assign(data.url);
  }catch(error){
   setSpent(error?.status===409);
   // 409 means this identity is spent: either paid already, or delivered to My
   // assets. Sending the buyer to Stripe anyway lands them on a dead session.
   setGenerationError(error?.status===409
    ?'This identity has already been purchased. Start a new identity to order another set.'
    :'Could not start checkout. Please try again.');
   setCheckingOut(false);
  }
 };

 // A delivered bundle is served from storage, the same copy My assets uses,
 // so it downloads after a reload when nothing is held in memory.
 const downloadStoredBundle=async()=>{
  if(bundling||!request?.access?.requestId)return;
  setBundleError('');setBundling(true);
  try{
   const response=await accessFetch(`/api/name-logo/bundle?request=${encodeURIComponent(request.access.requestId)}`,{headers:headers(request)});
   if(!response.ok)throw Error('unavailable');
   const url=URL.createObjectURL(await response.blob());
   const stem=String(name||'identity').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'identity';
   const link=document.createElement('a');
   link.href=url;link.download=`${stem}-bundle.zip`;
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   call('downloaded',request,{}).then(()=>setEntitlement(current=>current?{...current,downloadedAt:current.downloadedAt||new Date().toISOString(),downloadCount:(current.downloadCount||0)+1}:current)).catch(()=>{});
  }catch{setBundleError('Your bundle could not be downloaded right now. It is still available in My assets.')}
  finally{setBundling(false)}
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
   // A receipt, not a gate: taking delivery is recorded but never limits access.
   if(paidFor)call('downloaded',request,{}).then(()=>setEntitlement(current=>current?{...current,downloadedAt:current.downloadedAt||new Date().toISOString(),downloadCount:(current.downloadCount||0)+1}:current)).catch(()=>{});
  }catch{setBundleError('Could not prepare the download. Your previews are still available above.')}
  finally{setBundling(false)}
 };

 // The same selection and pay/download control sits above the packages and
 // below the applications, so neither end of the step has to be scrolled to.
 const packageActions=<><div><span>{paidPackageName?`PAID - ${paidPackageName.toUpperCase()}`:'YOUR SELECTION'}</span><strong>{chosen.price} · {chosen.headline}{selected!=='free'&&` · ${selectedSubjects.length}/${chosen.count} applications`}</strong></div>{selected==='free'?<button type="button" className="identity-bundle-download" disabled={bundling||!includedVisualizations.length} onClick={()=>bundleAndDownload(includedVisualizations,'previews')}>{bundling?'Preparing download...':'Download'}</button>:delivered?<button type="button" className="identity-bundle-download" disabled={bundling} onClick={downloadStoredBundle}>{bundling?'Preparing download...':'Download'}</button>:paidFor?bundleReady?<button type="button" className="identity-bundle-download" disabled={bundling} onClick={()=>bundleAndDownload(generatedItems,'collection')}>{bundling?'Preparing download...':'Download'}</button>:imagesReady&&videosTotal?<button type="button" disabled>{`Creating your videos (${videosReady}/${videosTotal} ready)`}</button>:<button type="button" disabled>{progress.done?`${progress.done}/${progressTotal||chosen.count} ready`:progress.running?`Creating your images (${progress.running} in progress)`:'Starting your images...'}</button>:confirmingPayment?<button type="button" disabled>Confirming payment...</button>:checkoutEnabled?<button type="button" className="identity-checkout-start" disabled={checkingOut||selectedSubjects.length!==chosen.count} onClick={startCheckout}>{checkingOut?'Opening payment...':selectionShort?`Choose ${selectionShort} more application${selectionShort>1?'s':''}`:`Pay · ${chosen.price}${entitlement?.mode==='test'?' (test mode)':''}`}</button>:<button type="button" disabled>Payment setup in progress</button>}</>;
 return <section className="identity-package-picker" aria-labelledby="identity-package-title">
  <header><p>NEXT STEP</p><h2 id="identity-package-title">Use {name||'your identity'} in the real world</h2><span>Three clear package options, with one corresponding example shown inside each choice.</span></header>
  <div className="identity-package-actions">{packageActions}</div>
  <div className="identity-package-grid" role="radiogroup" aria-label="Visualization packages">{packages.map(item=>{const generatedImage=generatedPackageImages[item.id],collage=packageCollage(item.id),select=()=>choosePackage(item.id);return <article key={item.id} className={`identity-package-card${selected===item.id?' selected':''}`} role="radio" aria-checked={selected===item.id} tabIndex={0} onClick={event=>{if(!event.target.closest('button'))select()}} onKeyDown={event=>{if(event.target!==event.currentTarget||!['Enter',' '].includes(event.key))return;event.preventDefault();select()}}><div className="identity-package-kicker"><span>{item.kicker}</span>{item.recommended&&<b>RECOMMENDED</b>}<button type="button" onClick={()=>setExample({...item,image:generatedImage||item.image,position:generatedImage?'center':item.position})}>See example</button></div>{previewsLoading||(request?.id&&!collage.length)?<div className="identity-package-collage identity-package-collage-loading" aria-label="Loading generated image collage">{Array.from({length:6},(_,index)=><i key={index}/>)}</div>:collage.length?<div className="identity-package-collage" aria-label={`${item.name} generated image collage`}>{collage.map(preview=><div className="identity-package-collage-tile" key={preview.id}><img src={preview.imageUrl} alt={`${preview.name} visualization`}/><button type="button" onClick={event=>{event.stopPropagation();window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:preview.imageUrl,alt:`${preview.name} visualization`}}))}}>View</button></div>) }<span>{item.id.toUpperCase()} EXAMPLES</span><strong>{item.headline}</strong></div>:<button className="identity-package-image" type="button" aria-label={`See ${item.headline} example`} onClick={()=>setExample({...item,image:item.image,position:item.position})} style={{backgroundImage:`url(${item.image})`,backgroundPosition:item.position}}><span>{item.id.toUpperCase()} EXAMPLE</span><strong>{item.example}</strong></button>}<div className="identity-package-copy">{item.oldPrice&&<span className="identity-founder-badge">FOUNDER'S EDITION</span>}<p>{item.oldPrice&&<del>{item.oldPrice}</del>} {item.price}</p><h3>{item.name}</h3><span>{item.description}</span><ul>{item.features.map(feature=><li key={feature}>{feature}</li>)}</ul></div><button className="identity-package-select" type="button" aria-pressed={selected===item.id} disabled={locked&&selected!==item.id} onClick={()=>choosePackage(item.id)}>{selected===item.id?'Selected':`Choose ${item.name.replace(' set','').replace('Signature studio','Studio')}`}</button></article>})}</div>
  {(purchaseStage||paidFor||delivered)&&<section className="identity-purchase-flow" aria-live="polite">
   <header>
    <h3>{purchaseStage==='confirming'?'Confirming your payment':purchaseStage==='unconfirmed'?'Payment not confirmed yet':delivered?'Saved to My assets':'Thanks for your payment'}</h3>
    <span>{purchaseStage==='confirming'?'Waiting for Stripe to confirm before your bundle is prepared.'
      :purchaseStage==='unconfirmed'?'The confirmation has not arrived. Nothing was prepared and you have not been charged twice. Reload this page in a moment, or contact support with your request reference.'
      :delivered?'Your bundle is stored in My assets and stays available there. Download it here or any time from the library.'
      :bundleReady?`Your ${paidPackageName||'package'} bundle is ready.`
      :videosBlocked?`${videosFailed} of ${videosTotal} videos could not be made. Nothing has been delivered yet - retry the videos to finish your ${paidPackageName||'package'} set.`
      :'Your bundle is being prepared. This page can be left open.'}</span>
   </header>
   {purchaseStage!=='confirming'&&purchaseStage!=='unconfirmed'&&<div className={`identity-generation-progress${videosBlocked?' is-failed':''}`}>
    <div className="identity-generation-bar"><i style={{width:`${stepsTotal?Math.round(stepsDone/stepsTotal*100):0}%`}}/></div>
    <p><strong>{progress.done}</strong> of {progressTotal} images ready{progressParts.length?` - ${progressParts.join(', ')}`:''}{videosTotal?` · ${videosReady} of ${videosTotal} videos`:''}</p>
    {purchaseStage!=='ready'&&<small>Each image is generated by a provider and takes a little while. This page can be left open.</small>}
   </div>}
   {videosTotal>0&&<div className={`identity-purchase-videos${videosBlocked?' is-failed':''}`}><p><strong>{videosReady}</strong> of {videosTotal} videos ready{videosRunning?' - each takes a minute or two':''}{videosBlocked&&<> · <b>{videosFailed} failed</b></>}{videosBlocked&&<button type="button" className="identity-retry-videos" onClick={retryVideos}>Retry the failed videos</button>}</p><div className="identity-video-grid">{Object.entries(videos).map(([subject,item])=><figure key={subject}>{item.video?<video src={item.video} controls muted playsInline preload="metadata"/>:<div className={`identity-video-pending${item.status==='failed'?' is-failed':''}`}>{item.status==='failed'?(item.error||'Not completed'):item.status==='starting'?'Starting...':`Rendering${item.startedAt?` · started ${new Date(item.startedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}`}</div>}<figcaption><strong>{item.name||applicationSubjects.find(s=>s.id===subject)?.name||subject}</strong>{item.mode&&<small> · {ARTWORK_SHORT[item.mode]||item.mode}</small>}</figcaption></figure>)}</div></div>}
   {purchasedReady.length>0&&<div className="identity-purchase-grid">{purchasedReady.map(item=><figure className="identity-viewable-image" key={item.id}><img src={item.imageUrl} alt={`${item.name} visualization`}/><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:item.imageUrl,alt:`${item.name} visualization`}}))}>View</button><figcaption><strong>{item.name}</strong></figcaption></figure>)}</div>}
   {delivered&&<button type="button" className="identity-order-again" onClick={()=>window.dispatchEvent(new CustomEvent('identity:order-again'))}>Start a new identity</button>}
   {entitlement?.mode==='test'&&!delivered&&<button type="button" className="identity-reset-purchase" onClick={resetPurchase}>Clear this test purchase</button>}
   {bundleReady&&<button type="button" className="identity-bundle-download" disabled={bundling} onClick={()=>bundleAndDownload(generatedItems,'bundle')}>{bundling?'Preparing download...':'Download bundle'}</button>}
  </section>}
  {selected==='free'?<section className="identity-included-previews" aria-labelledby="identity-included-title"><header><div><p>INCLUDED WITH FREE</p><h3 id="identity-included-title">Your generated applications</h3><span>{includedVisualizations.length>=INCLUDED_PREVIEWS?'These random previews were created while your identity was being prepared.':includedVisualizations.length?'Some of this set’s previews have expired and are no longer stored. The ones below are still available to download.':'This set’s previews have expired and are no longer stored.'}</span>{includedVisualizations.length<INCLUDED_PREVIEWS&&!previewsLoading&&<button type="button" className="identity-refill-previews" onClick={()=>window.dispatchEvent(new CustomEvent('identity:refill-previews'))}>Generate a fresh set</button>}</div><strong>{includedVisualizations.length===INCLUDED_PREVIEWS?`${INCLUDED_PREVIEWS} ready`:`${includedVisualizations.length} available`}</strong></header><div>{includedVisualizations.map(item=><figure className="identity-viewable-image" key={item.id}><img src={item.imageUrl} alt={`${item.name} visualization`}/><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:item.imageUrl,alt:`${item.name} visualization`}}))}>View</button><figcaption><strong>{item.name}</strong><span>Included</span></figcaption></figure>)}</div></section>:<section className="identity-subject-picker" aria-labelledby="identity-subject-title">
   <header><div><p>MAKE IT YOURS</p><h3 id="identity-subject-title">Choose where your identity appears</h3><span>Pick {chosen.count} distinct, real-world applications. We started you with a balanced mix.</span></div><strong className={selectedSubjects.length===chosen.count?'complete':''}>{selectedSubjects.length} / {chosen.count} selected</strong></header>
   <nav aria-label="Application categories">{['All',...applicationGroups].map(group=><button key={group} type="button" className={activeGroup===group?'active':''} onClick={()=>setActiveGroup(group)}>{group}</button>)}</nav>
   {availableDesigns.length>1&&<p className="identity-demo-note">The tiles below are John Smith demos. Your order is made with <strong>your own {activeMode?({logo:'name logo',initials:'initials',signature:'signature'})[activeMode]:'design'}</strong>, applied to every product you choose.</p>}
   {availableDesigns.length>1&&selected!=='free'&&<p className="identity-artwork-mix"><strong>Your mix:</strong> {designModes.map(mode=>`${mixCounts[mode]||0} ${ARTWORK_SHORT[mode].toLowerCase()}`).join(' · ')}. Click the label on any selected product to change its artwork.{!locked&&<> <button type="button" onClick={balanceEvenly}>Balance evenly</button> <button type="button" onClick={applyArtworkToAll}>Apply {ARTWORK_SHORT[activeMode]?.toLowerCase()||'this'} to all</button></>}</p>}
   {availableDesigns.length>1&&<div className="identity-artwork-choice"><span>ARTWORK TO APPLY</span>{availableDesigns.map((design,index)=><button key={design.id} type="button" className={activeDesignId===design.id?'active':''} onClick={()=>setActiveDesignId(design.id)}>{design.mode||['Name logo','Initials','Signature'][index]||`Design ${index+1}`}</button>)}</div>}
   <div className="identity-subject-grid">{visibleSubjects.map(subject=>{const checked=selectedSubjects.includes(subject.id);const unavailable=!checked&&selectedSubjects.length>=chosen.count;const job=jobs[subject.id];const tileMode=selected!=='free'&&checked?artworkFor(subject.id):activeMode;const imageUrl=job?.imageUrl||applicationPreviewImage(subject,tileMode);const preview=job?.imageUrl?{backgroundImage:`url(${job.imageUrl})`,backgroundPosition:'center',backgroundSize:'cover'}:applicationPreviewStyle(subject,tileMode);const artwork=applicationArtwork(subject,tileMode);return <button key={subject.id} type="button" className={`${checked?'selected':''}${job?' has-job':''}`} aria-pressed={checked} disabled={unavailable||isGenerating||locked} onClick={()=>toggleSubject(subject.id)}><span className="identity-subject-preview" style={preview}><span className="identity-subject-view" role="button" tabIndex="0" onClick={event=>{event.stopPropagation();window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:imageUrl,alt:`${subject.name} with ${artwork.label}`}}))}} onKeyDown={event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:imageUrl,alt:`${subject.name} with ${artwork.label}`}}))}}>View</span></span><span className={`identity-subject-check${job?.status==='running'?' is-running':''}`}>{job?.status==='running'?'':job?.status==='succeeded'?'OK':job?.status==='failed'?'!':checked?'OK':'+'}</span>{checked&&selected!=='free'&&designModes.length>1&&!job&&<span className={`identity-subject-artwork${locked?' is-locked':''}`} role="button" tabIndex="0" title={locked?'The order is fixed':'Change the artwork on this product'} onClick={event=>{event.stopPropagation();if(!locked)cycleArtwork(subject.id)}} onKeyDown={event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();if(!locked)cycleArtwork(subject.id)}}>{ARTWORK_SHORT[tileMode]||tileMode}</span>}<div><strong>{subject.name}</strong><small title={job?.status==='failed'?job.error:job?.retry?retryText(job.retry):undefined} className={job?.retry&&job.status==='running'?'is-retrying':''}>{job?.status==='succeeded'?'Ready':job?.status==='failed'?(job.error||'Failed'):job?.retry&&job.status==='running'?`Retrying ${job.retry.attempt}${job.retry.of?`/${job.retry.of}`:''}`:job?job.status:`${subject.group} · ${artwork.label}`}</small></div></button>})}</div>
   <div className="identity-subject-actions"><button type="button" onClick={()=>{setSelectedSubjects(recommendedApplications[selected]);setSelectionSaved(false)}}>Restore suggested mix</button><button type="button" onClick={()=>{setSelectedSubjects([]);setSelectionSaved(false)}}>Clear all</button></div>
  </section>}
  {generationError&&<p className="identity-subject-error" role="alert">{generationError}{spent&&<> <button type="button" className="identity-order-again" onClick={()=>window.dispatchEvent(new CustomEvent('identity:order-again'))}>Start a new identity</button></>}</p>}
  {bundleError&&<p className="identity-subject-error" role="alert">{bundleError}</p>}
  {!(purchaseStage||paidFor)&&(isGenerating||progressSettled>0&&progressSettled<progressTotal)&&progressTotal>0&&<div className="identity-generation-progress" role="status" aria-live="polite">
   <div className="identity-generation-bar"><i style={{width:`${Math.round(progressSettled/progressTotal*100)}%`}}/></div>
   <p><strong>{progress.done}</strong> of {progressTotal} ready{progressParts.length?` - ${progressParts.join(', ')}`:''}</p>
   <small>Each image is generated by a provider and takes a little while. This page can be left open.</small>
  </div>}
  <footer>{packageActions}</footer>
  {example&&<ExampleModal item={example} onClose={()=>setExample(null)}/>} 
 </section>;
}





