import {useEffect, useRef, useState} from 'react';

const identityNames = ['Clara Bellamy', 'Theo Whitaker', 'Evelyn Ashford', 'Maya Sinclair', 'Nora Laurent', 'Felix Hartwell', 'Iris Kendrick', 'Hugo Wellington', 'Ava Prescott', 'Zara Fitzgerald', 'Dalia Roswell', 'Olivia Bennett', 'Cassian Mercer', 'Leila Morgan', 'Rhea Callahan', 'Jasper Delacroix', 'Sienna Beaumont', 'Bianca Donovan', 'Amara Kingsley', 'Yara Petrov'];
// Viewports reveal the original concepts without altering the source sheets.
const identityFrames = [
  [157,29,838,261],[157,320,838,280],[157,631,838,295],[157,959,838,261],[157,1250,838,255],
  [37,52,952,248],[37,358,952,247],[37,664,952,248],[37,971,952,236],[37,1264,952,233],
  [40,75,945,206],[40,359,945,207],[40,646,945,206],[40,930,945,217],[40,1196,945,235],
  [45,55,935,254],[45,366,935,257],[45,678,935,253],[45,985,935,237],[45,1275,935,229],
];

const videoNames = ['Cinematic frames','Before and after','Filmstrip','Viewfinder','Motion study','Product studio','Architecture','Food film','Travel postcard','Fashion editorial','Storyboard','Color study','Camera movement','Match the mood','Macro world','Music video','Street cinema','Nature documentary','Abstract motion','Miniature story'];
const videoFrames = [
[105,124,469,170],[705,128,479,171],[103,558,478,169],[705,553,479,177],[104,978,477,168],
[75,119,505,178],[669,119,504,178],[75,552,505,177],[669,552,504,178],[75,988,505,178],
[94,122,485,179],[678,122,488,179],[94,547,485,199],[679,547,487,199],[94,989,485,184],
[125,131,454,194],[696,132,457,194],[125,562,455,196],[697,563,455,196],[125,989,455,177]
];
const videoMessages = ['See a viral video? Make your version.', 'Discover how the look was created.', 'Break it down with AI.', 'Turn inspiration into prompts and instructions.', 'Bring that style to your videos.', 'Create something yours.'];
const videoSizes = [[1230,1278],[1208,1302],[1214,1295],[1221,1289]];
export default function IdentityCarousel({hidden, video = false}) {
  const names = video ? videoNames : identityNames;
  const frames = video ? videoFrames : identityFrames;
  const prefix = video ? 'video' : 'concept';
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!playing || hovered || focused || reduced || hidden || !visible) return;
    const timer = setTimeout(() => setIndex(current => (current + 1) % names.length), 5000);
    return () => clearTimeout(timer);
  }, [index, playing, hovered, focused, reduced, hidden, visible]);
  const touch = useRef(null);
  const move = delta => setIndex(current => (current + delta + names.length) % names.length);
  return <article className={`tool-tile identity-carousel${video ? ' video-carousel' : ''}`} aria-label={video ? 'AI Video Suggestion showcase' : 'Magic Identity design showcase'} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <div className="tile-top"><span className="identity-ai-label">{video ? 'AI-POWERED VIDEO IDEAS' : 'AI-POWERED PERSONAL DESIGN'}</span><span aria-hidden="true">✦</span></div>
        <div className="showcase-intro">
      {video ? <h2 className="video-message-stack">{videoMessages.map((message, i) => <span key={message} className={i === index % videoMessages.length ? 'is-active' : ''} aria-hidden={i !== index % videoMessages.length}>{message}</span>)}</h2> : <h2>Magic Identity</h2>}
      <p>{video ? 'Add a video, screenshot, or link. Get recommended AI models, prompts, and estimated costs.' : 'Your name. Reimagined by AI.'}</p>
    </div>
    <div className="concept-viewport" role="region" aria-roledescription="carousel" aria-label={video ? '20 video concepts' : '20 identity design concepts'} tabIndex={0}
      onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touch.current !== null) { const distance = e.changedTouches[0].clientX - touch.current; if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1); } touch.current = null; }}>
            {frames.map((frame, i) => <svg key={i} className={`concept-slide${index === i ? ' is-active' : ''}`} viewBox={frame.join(' ')} role="img" aria-hidden={index !== i} aria-label={`${names[i]} design concept`}>
        <defs><clipPath id={`${prefix}-crop-${i}`}>{video && i === 0 ? <><rect x="105" y="146" width="105" height="130" rx="4" /><rect x="210" y="124" width="263" height="170" rx="4" /><rect x="473" y="137" width="101" height="138" rx="4" /></> : <rect x={frame[0]} y={frame[1]} width={frame[2]} height={frame[3]} />}</clipPath><filter id={`${prefix}-ink-${i}`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.276 -.93 -.094 0 1.22" result="ink" />
          <feFlood floodColor="currentColor" /><feComposite operator="in" in2="ink" />
        </filter></defs>
        <image clipPath={`url(#${prefix}-crop-${i})`} href={`/assets/${video ? 'video' : 'identity'}-concepts/${video ? 'sheet' : 'names-sheet'}-${Math.floor(i / 5) + 1}.png`} width={video ? videoSizes[Math.floor(i / 5)][0] : 1024} height={video ? videoSizes[Math.floor(i / 5)][1] : 1536} filter={video ? undefined : `url(#${prefix}-ink-${i})`} />
      </svg>)}
    </div>
    <div className="concept-controls">
      <button type="button" aria-label={video ? 'Previous video concept' : 'Previous design'} onClick={() => move(-1)}>←</button>
      <label><span className="concept-count" aria-live={playing ? 'off' : 'polite'}>{index + 1} / 20</span><select aria-label={video ? 'Choose a video concept' : 'Choose a design'} value={index} onChange={e => setIndex(Number(e.target.value))}>{names.map((name, i) => <option key={name} value={i}>{name}</option>)}</select></label>
      <button type="button" aria-label={video ? 'Next video concept' : 'Next design'} onClick={() => move(1)}>→</button>
    </div>
    <button className="concept-play" type="button" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause slideshow' : 'Play slideshow'}</button>
    <div className="tile-variations">{(video ? ['Video', 'Screenshot', 'Link'] : ['Name Logos', 'Initials', 'Signatures']).map(label => <span key={label}>{label}</span>)}</div>
    <a className="identity-try-button" href={video ? '#video' : '#logo'}>{video ? 'Analyze a reference' : 'Try your name'} <span aria-hidden="true">→</span></a>
  </article>;
}







