import {useMemo, useState, useEffect} from 'react';
import {createPortal} from 'react-dom';
import {demoClips, demoIdentityName} from '../lib/application-templates.mjs';

const ARTWORK = {logo: 'Name logo', initials: 'Initials', signature: 'Signature'};

// "See it move": the l3v Dvalo sample clips, autoplaying muted as previews.
// Clicking one opens it large with sound and controls. Shows nothing until a
// video run has been imported into the manifest.
export default function SampleVideoStrip() {
  const clips = useMemo(() => demoClips(), []);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!open) return;
    const onKey = event => { if (event.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!clips.length) return null;
  return <>
    <aside className="identity-video-strip" aria-label={`${demoIdentityName} sample videos`}>
      <p className="eyebrow">SEE IT MOVE</p>
      <div className="identity-video-strip-track">
        {clips.map(clip => <figure key={clip.src}>
          <button type="button" className="identity-video-open" onClick={() => setOpen(clip)} aria-label={`Play ${clip.name} full size`}>
            <video src={clip.src} muted loop autoPlay playsInline preload="metadata" tabIndex={-1}/>
            <span className="identity-video-play" aria-hidden="true">▶</span>
          </button>
          <figcaption><strong>{clip.name}</strong><small>{ARTWORK[clip.mode] || clip.mode}</small></figcaption>
        </figure>)}
      </div>
    </aside>
    {open && typeof document !== 'undefined' && createPortal(
      <div className="identity-video-modal" role="dialog" aria-modal="true" aria-label={`${open.name} video`}
           onMouseDown={event => event.target === event.currentTarget && setOpen(null)}>
        <div className="identity-video-modal-inner">
          <button type="button" className="identity-video-modal-close" onClick={() => setOpen(null)}>Close</button>
          <video src={open.src} controls autoPlay loop playsInline/>
          <p>{open.name} · {ARTWORK[open.mode] || open.mode}</p>
        </div>
      </div>, document.body)}
  </>;
}
