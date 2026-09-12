import {useEffect, useRef} from 'react';

export default function VideoSampleResult({mode, open, onClose}) {
  const dialog = useRef(null), details = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  const source = mode === 'reel' ? 'Facebook Reel' : 'image';
  return <>
    <dialog ref={dialog} className="video-sample-dialog sample-plan-dialog" aria-labelledby="sample-heading" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="dialog-heading"><div><p className="eyebrow">SAMPLE RESULT</p><h2 id="sample-heading">Video creation plan</h2></div><button autoFocus className="secondary" onClick={() => dialog.current.close()}>Close</button></div>
      <div className="sample-plan-body">
        <p className="sample-context">This example shows what appears after your {source} is analyzed.</p>
        <aside className="video-demo-cta"><div><strong>Try yours now</strong><span>Analyze your own {source} and build a real 5-second video.</span></div><button type="button" onClick={() => dialog.current.close()}>Start creating →</button></aside>
        <div className="result-stage-grid sample-stage-grid">
          <article className="result-stage"><div className="stage-top"><span className="stage-number">01</span><span className="stage-state complete">Complete</span></div><h3>Analysis</h3><p>A calm cinematic landscape with a clear subject, muted color and soft directional light.</p><button className="text-button" type="button" onClick={() => details.current?.showModal()}>Review details</button></article>
          <article className="result-stage"><div className="stage-top"><span className="stage-number">02</span><span className="stage-state active">Next</span></div><h3>First frame</h3><p>Create a still image of the proposed new scene and approve it before video generation.</p><button className="secondary" type="button" disabled>Create a first frame</button></article>
          <article className="result-stage video-stage"><div className="stage-top"><span className="stage-number">03</span><span className="stage-state">Waiting</span></div><h3>Generate video</h3><p>Approve the first frame to unlock video settings and the final generation button.</p></article>
        </div>
        <p className="privacy">Sample only. Nothing is submitted and no credits are used.</p>
      </div>
    </dialog>
    <dialog className="analysis-dialog sample-analysis-dialog" ref={details} aria-labelledby="sample-details-heading" onClick={event => { if (event.target === details.current) details.current.close(); }}>
      <div className="dialog-heading"><div><p className="eyebrow">FULL ANALYSIS</p><h2 id="sample-details-heading">Review details</h2></div><button className="secondary" type="button" onClick={() => details.current?.close()}>Close</button></div>
      <div className="dialog-body">
        <section><h3>Direction summary</h3><p>A calm cinematic landscape with a clear subject, muted color and soft directional light.</p><p>Creative goal: create a different scene that keeps the reference’s visual character and mood.</p></section>
        <section><h3>Recommended model</h3><div className="model-detail"><h4>Seedance 2.5 via Runway</h4><p>A strong option for a short image-to-video shot with restrained camera movement.</p></div></section>
        <section><h3>Reference details</h3><ul><li>Atmospheric, detailed and softly lit.</li><li>Clear focal point with open space around it.</li><li>Slow camera movement and subtle environmental motion.</li></ul></section>
        <section><h3>Suggested prompt</h3><div className="prompt-detail">Track gently toward the subject while the environment moves subtly. Keep the composition stable, preserve the soft directional light, and avoid sudden motion.</div></section>
      </div>
    </dialog>
  </>;
}
