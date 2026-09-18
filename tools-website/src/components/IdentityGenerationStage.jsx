import {failureText,retryText} from '../lib/failure-copy.mjs';
import {INCLUDED_PREVIEWS} from '../../generation-allowance.mjs';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import IdentityPackages from './IdentityPackages';
import {applicationPreviewStyle} from './identityApplicationSubjects';
import './IdentityResults.css';

const slots=[
  {type:'name-logo',label:'Name logo',number:'01'},
  {type:'initials',label:'Initials',number:'02'},
  {type:'signature',label:'Signature',number:'03'},
];

function designKind(design,index){
  const value=String(design?.output||design?.type||design?.kind||'').toLowerCase();
  if(value.includes('initial'))return 'initials';
  if(value.includes('signature'))return 'signature';
  if(value.includes('name')||value.includes('logo'))return 'name-logo';
  return slots[index]?.type;
}

function styleName(design){
  return design?.styleName||design?.style?.name||design?.title||design?.name||'Generated design';
}

function personName(request){
  return [request?.first||request?.firstName||request?.first_name||request?.givenName,request?.last||request?.lastName||request?.last_name||request?.familyName].filter(Boolean).join(' ')||request?.name||'Your name';
}

function previewTitle(item){return item?.title||item?.label||item?.name||item?.subject||item?.id||'Real-world application'}

export default function IdentityGenerationStage({
  request,result,busy,message,assets={},recovery,onPoll,onReset,onRetry,onEdit,onMockup,
  showPackages=false,onNext,visualizations={},sample=false,
}){
  const [showResults,setShowResults]=useState(false);
  const designs=(result?.designs||[]).slice(0,3);
  const shown=slots.map((slot,index)=>designs.find((design,designIndex)=>designKind(design,designIndex)===slot.type)||designs[index]||null);
  const complete=shown.every(design=>design?.status==='succeeded'&&assets[design.id]?.png);
  const finished=shown.filter(design=>design?.status==='succeeded').length;
  // A design the backend gave up on - failed, ambiguous, expired - is over.
  // Only queued and running are still work; anything else must not spin.
  const designOver=design=>Boolean(design)&&!['queued','running','succeeded'].includes(design.status);
  const failedDesigns=shown.filter(designOver).length;
  const stillWorking=shown.some(design=>!design||['queued','running'].includes(design.status));
  const previews=Object.values(visualizations);
  const readyPreviews=previews.filter(item=>item.status==='succeeded').length;
  const failedPreviews=previews.filter(item=>item.status==='failed').length;
  const previewTotal=INCLUDED_PREVIEWS;
  const previewProgress=Math.round((readyPreviews/previewTotal)*100);
  const previewBatchFailed=failedPreviews===previewTotal;

  // The same advancement control is rendered above and below the content.
  // Step 4 is built on the included previews, so the way forward opens only once
  // they have all settled - it must not invite the buyer to skip them.
  const previewsPending=!sample&&!previewBatchFailed&&(previews.length<previewTotal||previews.some(item=>!['succeeded','failed','expired'].includes(item.status)));
  const nextBar=className=><div className={`${className}${previewsPending?' is-waiting':''}`}>
    <div><small>{previewBatchFailed?'PREVIEWS NEED ATTENTION':previewsPending?'PREVIEWS IN PROGRESS':'NEXT'}</small><strong>{previewBatchFailed?'The preview batch did not complete. Retry it without regenerating your identity.':previewsPending?`Preparing your ${previewTotal} previews - ${readyPreviews} of ${previewTotal} ready. Your package options open when they are in.`:'Now select your package.'}</strong></div>
    <button type="button" disabled={previewsPending} aria-disabled={previewsPending} onClick={previewBatchFailed?()=>location.reload():previewsPending?undefined:onNext}>{previewBatchFailed?'Retry previews':previewsPending?`${readyPreviews} / ${previewTotal}`:'Next'}</button>
  </div>;
  const readyActions=className=><div className={className}>
    <div><small>STEP 3 COMPLETE</small><strong>Your identity is ready. Now select your package.</strong></div>
    <button type="button" onClick={onNext}>Next: See It Live</button>
  </div>;
  const downloadAll=()=>shown.forEach((design,index)=>{
    const href=assets[design?.id]?.png;
    if(!href)return;
    const link=document.createElement('a');
    link.href=href;
    link.download=`${slots[index].type}.png`;
    link.click();
  });

  if(complete&&showPackages){
    return <div className="identity-generation-stage identity-step4-stage identity-wide-stage">
      <div className="identity-step4-layout identity-package-workspace">
        <aside className="identity-step4-sidebar">
          <div>
            <p className="eyebrow">YOUR GENERATED IDENTITY</p>
            <h2>Name, initials, signature</h2>
            <p>All three designs are ready to apply.</p>
          </div>
          <div className="identity-step4-designs">
            {shown.map((design,index)=><figure key={design.id}>
              <img src={assets[design.id]?.png} alt={`${slots[index].label} result`}/>
              <figcaption><strong>{slots[index].label}</strong><small>{styleName(design)}</small></figcaption>
            </figure>)}
          </div>
          <div className="identity-step4-sidebar-actions">
            <button className="primary-action" type="button" onClick={()=>setShowResults(true)}>Visualise results</button>
            <button type="button" onClick={downloadAll}>Download images</button>
            <button type="button" onClick={onReset}>Start over</button>
          </div>
        </aside>
        <IdentityPackages request={request} name={personName(request)} designs={shown}/>
      </div>
      {showResults&&typeof document!=='undefined'&&createPortal(
        <div className="identity-results-overlay" role="dialog" aria-modal="true" aria-label="Generated identity results" onMouseDown={event=>event.target===event.currentTarget&&setShowResults(false)}>
          <section>
            <header><div><small>YOUR GENERATED IDENTITY</small><h2>{personName(request)}</h2></div><button type="button" onClick={()=>setShowResults(false)}>Close</button></header>
            <div>{shown.map((design,index)=><figure key={design.id}><img src={assets[design.id]?.png} alt={`${slots[index].label} result`}/><figcaption><strong>{slots[index].label}</strong><small>{styleName(design)}</small></figcaption></figure>)}</div>
          </section>
        </div>,document.body)}
    </div>;
  }

  if(complete){
    return <section className="identity-generation-stage identity-wide-stage identity-step3-complete" aria-label="Review generated identity and applications">
      <div className="identity-step3-workspace">
        <aside className="identity-step3-design-rail">
          <div><p className="eyebrow">YOUR ACTIVE SET</p><h2>{personName(request)}</h2><p>Your generated designs are saved.</p></div>
          {shown.map((design,index)=><figure key={design.id} className="identity-viewable-image">
            {assets[design.id]?.png?<button type="button" className="identity-design-open" onClick={()=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:assets[design.id].png,alt:`${slots[index].label} - ${styleName(design)}`}}))} aria-label={`View ${slots[index].label} full size`}><img src={assets[design.id].png} alt={`${slots[index].label} result`}/></button>:<img src={assets[design.id]?.png} alt={`${slots[index].label} result`}/>}
            <figcaption><strong>{slots[index].label}</strong><small>{styleName(design)}</small></figcaption>
          </figure>)}
        </aside>
        <main className="identity-step3-applications">
          <header><div><p className="eyebrow">SEE IT TAKE SHAPE</p><h2>Adding your identity</h2><p>Applying your generated designs to apparel, products, and places.</p></div><strong>{readyPreviews} / {previewTotal} ready</strong></header>
          {nextBar('identity-step3-next identity-step3-next-top')}
          <div className="identity-step3-preview-progress" aria-label={`${readyPreviews} of ${previewTotal} previews ready`}><i style={{width:`${Math.max(previews.length?4:0,previewProgress)}%`}}/><span>{readyPreviews?`${readyPreviews} complete · `:''}{failedPreviews?`${failedPreviews} need attention · `:''}{Math.max(0,previewTotal-readyPreviews-failedPreviews)} in progress</span></div>
          <div className="identity-step3-application-grid">
            {(previews.length?previews:Array.from({length:previewTotal},(_,index)=>({key:`waiting-${index}`,status:'waiting'}))).map(item=><figure key={item.key}>
              <div style={!item.imageUrl&&item.id?applicationPreviewStyle(item):undefined}>{item.imageUrl?<button type="button" className="identity-preview-open" onClick={()=>window.dispatchEvent(new CustomEvent('identity:open-image',{detail:{src:item.imageUrl,alt:`${previewTitle(item)} visualization`}}))} aria-label={`View ${previewTitle(item)} full size`}><img src={item.imageUrl} alt={`${previewTitle(item)} visualization`}/></button>:<span className={item.status==='failed'?'is-failed':''}>{item.status!=='failed'&&<i className="identity-preview-spinner"/>}{item.status==='failed'?'Preview needs attention':'Adding your identity…'}</span>}</div>
              <figcaption><strong>{item.id?previewTitle(item):'Preparing preview'}</strong><small title={item.status==='failed'?failureText(item.diagnostic):item.retry?retryText(item.retry):undefined} className={item.retry&&item.status!=='succeeded'&&item.status!=='failed'?'is-retrying':''}>{item.status==='succeeded'?'Ready':item.status==='failed'?failureText(item.diagnostic,'Not completed.'):item.retry?`Retrying ${item.retry.attempt}${item.retry.of?`/${item.retry.of}`:''}`:'In progress'}</small></figcaption>
            </figure>)}
          </div>
          {nextBar('identity-step3-next')}
        </main>
      </div>
    </section>;
  }

  return <section className={`identity-generation-stage identity-wide-stage${complete?' is-complete':''}`} aria-label="Generate and review identity designs">
    <header className="generation-heading">
      <div>
        <p className="eyebrow">{complete?'YOUR IDENTITY IS READY':'CREATING YOUR COLLECTION'}</p>
        <h2>{personName(request)}</h2>
        <p>{complete?'Review your three finished designs, then continue when you are ready.':'Your three designs are being created in parallel. Each finished design appears here automatically.'}</p>
      </div>
      <button type="button" onClick={onReset}>Start over</button>
    </header>
    {complete&&readyActions('identity-step3-ready-actions top')}

    {!complete&&<div className="collection-progress">
      <div><strong>{busy?'Generating your identity':failedDesigns>0&&!stillWorking?'Generation stopped':'Generation in progress'}</strong><span>{finished} of 3 ready{failedDesigns>0&&!stillWorking?` · ${failedDesigns} failed`:''}</span></div>
      <div className="collection-progress-track"><i style={{width:`${Math.max(4,finished/3*100)}%`}}/></div>
    </div>}

    <div className="identity-generating-selected">
      <ol className="identity-generation-timeline">
        <li className="complete"><strong>Request accepted</strong><span>Your selections are locked in.</span></li>
        <li className={complete?'complete':'active'}><strong>Generating</strong><span>Three workers create the designs in parallel.</span></li>
        <li className={complete?'complete':''}><strong>Review</strong><span>Continue only when you are ready.</span></li>
      </ol>
      <div className="identity-generation-placeholders">
        {slots.map((slot,index)=>{
          const design=shown[index];
          const image=design&&assets[design.id]?.png;
          const failed=designOver(design);
          const reason=design?.error||failureText(design?.diagnostic);
          const retrying=!failed&&!image&&design?.status==='running'&&retryText(design?.retry);
          return <article key={slot.type}>
            <div className="identity-generation-placeholder-frame">
              <span>{slot.number}</span>
              {image?<img src={image} alt={`${slot.label} result`}/>:<div>{!failed&&<span className="style-spinner"/>}<strong>{failed?'Could not generate':retrying?'Retrying':'Generating'}</strong><small className={retrying?'is-retrying':''}>{failed?reason:retrying||`${slot.label} will appear here.`}</small></div>}
            </div>
            <footer><div><strong>{slot.label}</strong><small>{design?styleName(design):'Preparing worker'}</small></div><b>{image?'Ready':failed?'Failed':retrying?'Retrying':'Working'}</b></footer>
          </article>;
        })}
        <p className="identity-generation-stability-note">Finished designs stay in place while the remaining work completes.</p>
      </div>
    </div>

    {complete&&readyActions('identity-step3-ready-actions')}

    {!complete&&message&&<p className="generation-status-message">{message}</p>}
    {!complete&&recovery&&<div className="generation-recovery"><strong>{recovery.title||'Generation needs attention'}</strong><p>{recovery.message||message}</p>{onPoll&&<button type="button" onClick={onPoll}>Check again</button>}</div>}
    {failedDesigns>0&&!stillWorking&&!busy&&onRetry&&<div className="generation-recovery is-failed" role="alert"><strong>{failedDesigns===1?'One design did not complete':`${failedDesigns} designs did not complete`}</strong><p>The provider gave up on {failedDesigns===1?'it':'them'}. Your name and styles are kept; generate the set again to get a complete collection.</p><button type="button" onClick={onRetry}>Generate the set again</button></div>}
  </section>;
}
