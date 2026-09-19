import {useMemo, useState, useEffect} from 'react';
import {createPortal} from 'react-dom';
import {demoClips, demoIdentityName, applicationSubjects} from '../lib/application-templates.mjs';
import {accessFetch} from '../lib/master-access.mjs';

const ARTWORK = {logo: 'Name logo', initials: 'Initials', signature: 'Signature'};
const nameFor = template => applicationSubjects.find(s => s.id === template)?.name
  || (template || '').replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()) || 'Sample video';

// "See it move": a live, accumulating strip of real sample clips. Each real
// generation adds one; the edge keeps the newest 20 and rotates the rest out.
// The demo clips seed it and fill any gap. Clips autoplay muted as previews;
// clicking one opens it large with sound and controls.
export default function SampleVideoStrip() {
  const demos = useMemo(() => demoClips(), []);
  const [feed, setFeed] = useState([]);
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const response = await accessFetch('/api/name-logo/recent-clips');
        if (!response.ok) return;
        const data = await response.json();
        if (stopped) return;
        setFeed((data.items || []).map(item => ({src: item.url, mode: '', name: nameFor(item.template)})));
      } catch {}
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);
  // Real clips first, newest at the top, then the demos to fill, capped at 20.
  const clips = (feed.length ? [...feed, ...demos.filter(d => !feed.some(f => f.src === d.src))] : demos).slice(0, 20);
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
      <div className="identity-video-strip-viewport">
        {/* Duplicated so the auto-scroll loops seamlessly; it pauses on hover so
            a clip can be clicked. All clips are shown, newest run and all. */}
        <div className="identity-video-strip-track">
          {[...clips, ...clips].map((clip, index) => <figure key={`${clip.src}-${index}`} aria-hidden={index >= clips.length}>
            <button type="button" className="identity-video-open" onClick={() => setOpen(clip)} aria-label={`Play ${clip.name} full size`} tabIndex={index >= clips.length ? -1 : 0}>
              <video src={clip.src} muted loop autoPlay playsInline preload="metadata" tabIndex={-1}/>
              <span className="identity-video-play" aria-hidden="true">▶</span>
            </button>
            <figcaption><strong>{clip.name}</strong><small>{ARTWORK[clip.mode] || 'Sample'}</small></figcaption>
          </figure>)}
        </div>
      </div>
    </aside>
    {open && typeof document !== 'undefined' && createPortal(
      <div className="identity-video-modal" role="dialog" aria-modal="true" aria-label={`${open.name} video`}
           onMouseDown={event => event.target === event.currentTarget && setOpen(null)}>
        <div className="identity-video-modal-inner">
          <button type="button" className="identity-video-modal-close" onClick={() => setOpen(null)}>Close</button>
          <video src={open.src} controls autoPlay loop playsInline/>
          <p>{open.name}{open.mode ? ' · ' + (ARTWORK[open.mode] || open.mode) : ''}</p>
        </div>
      </div>, document.body)}
  </>;
}
