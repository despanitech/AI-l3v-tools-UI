import {useMemo} from 'react';
import {demoClips, demoIdentityName} from '../lib/application-templates.mjs';

const ARTWORK = {logo: 'Name logo', initials: 'Initials', signature: 'Signature'};

// "See it move": the l3v Dvalo sample clips, autoplaying muted, so a visitor
// sees what a finished identity looks like in motion before generating. Shows
// nothing until a video run has been imported into the manifest.
export default function SampleVideoStrip() {
  const clips = useMemo(() => demoClips(), []);
  if (!clips.length) return null;
  return <aside className="identity-video-strip" aria-label={`${demoIdentityName} sample videos`}>
    <p className="eyebrow">SEE IT MOVE</p>
    <div className="identity-video-strip-track">
      {clips.map(clip => <figure key={clip.src}>
        <video src={clip.src} muted loop autoPlay playsInline preload="metadata" aria-label={`${clip.name} in motion`}/>
        <figcaption><strong>{clip.name}</strong><small>{ARTWORK[clip.mode] || clip.mode}</small></figcaption>
      </figure>)}
    </div>
  </aside>;
}
