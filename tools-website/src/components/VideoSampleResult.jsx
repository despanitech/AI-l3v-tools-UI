import {useEffect, useRef} from 'react';

export default function VideoSampleResult({mode, open, onClose}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  return <dialog ref={dialog} className="video-sample-dialog video-sample-result" aria-labelledby="sample-heading" onClose={onClose}>
    <div className="file-row"><span className="eyebrow">SAMPLE RESULTS</span><button autoFocus className="text-button" onClick={() => dialog.current.close()}>Close sample</button></div>
    <h2 id="sample-heading">Sample video direction</h2>
    <p className="hint">Example results. This is not an analysis of your {mode === 'reel' ? 'Reel' : 'image'}.</p>
    <dl className="sample-request"><div><dt>Input</dt><dd>{mode === 'reel' ? 'Facebook Reel URL' : 'Image'}</dd></div><div><dt>Reference</dt><dd>Example landscape</dd></div><div><dt>Request</dt><dd>DEMO-001 · example only</dd></div></dl>
    <h3>Reference analysis</h3><p>A calm, cinematic landscape with a small subject, muted colors and soft directional light.</p>
    <ul><li><strong>Visual style:</strong> atmospheric, detailed and softly lit.</li><li><strong>Composition:</strong> a clear focal point with room around it.</li><li><strong>{mode === 'reel' ? 'Example motion observation' : 'Suggested motion'}:</strong> slow camera movement and subtle environmental detail.</li></ul>
    <h3>Recommended approach</h3><p>Create an original first frame that carries the reference’s mood, then animate it with restrained movement.</p>
    <div className="sample-model"><h4>Seedance 2.5 via Runway</h4><p>Example choice for a short image-to-video shot. The real recommendation will depend on the reference.</p><p><strong>Example setup:</strong> 5 seconds · 480p · no audio</p><p><strong>Illustrative cost:</strong> $1.00, based on our earlier test. Confirm a current estimate before generation.</p></div>
    <h3>Creation steps</h3><ol><li>Review the reference analysis and choose the direction.</li><li>Create and approve the first frame.</li><li>Review motion instructions and the price.</li><li>Generate the video and retrieve it from this request.</li></ol>
    <div className="sample-outputs"><div><h3>First frame</h3><div className="sample-placeholder"><strong>First-frame result appears here</strong><span>No image generated for this sample.</span></div></div>
    <div><h3>Video result</h3><div className="sample-placeholder"><strong>Video player appears here</strong><span>Playback and download controls in the real result.</span></div></div></div>
    <p className="privacy">Sample only. No request receipt is created and no paid action is available here.</p>
  </dialog>;
}
