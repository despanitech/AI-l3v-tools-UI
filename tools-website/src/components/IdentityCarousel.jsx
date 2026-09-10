import {useEffect, useRef, useState} from 'react';

const names = ['Clara Bellamy', 'Theo Whitaker', 'Evelyn Ashford', 'Maya Sinclair', 'Nora Laurent', 'Felix Hartwell', 'Iris Kendrick', 'Hugo Wellington', 'Ava Prescott', 'Zara Fitzgerald', 'Dalia Roswell', 'Olivia Bennett', 'Cassian Mercer', 'Leila Morgan', 'Rhea Callahan', 'Jasper Delacroix', 'Sienna Beaumont', 'Bianca Donovan', 'Amara Kingsley', 'Yara Petrov'];
// Viewports reveal the original concepts without altering the source sheets.
const frames = [
  [157,29,838,261],[157,320,838,280],[157,631,838,295],[157,959,838,261],[157,1250,838,255],
  [37,52,952,248],[37,358,952,247],[37,664,952,248],[37,971,952,236],[37,1264,952,233],
  [40,75,945,206],[40,359,945,207],[40,646,945,206],[40,930,945,217],[40,1196,945,235],
  [45,55,935,254],[45,366,935,257],[45,678,935,253],[45,985,935,237],[45,1275,935,229],
];

export default function IdentityCarousel({hidden}) {
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
  return <article className="tool-tile identity-carousel" aria-label="Magic Identity design showcase" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <div className="tile-top"><span className="identity-ai-label">AI-POWERED PERSONAL DESIGN</span><span aria-hidden="true">✦</span></div>
    <h2>Magic Identity</h2><p>Your name. Reimagined by AI.</p>
    <div className="concept-viewport" role="region" aria-roledescription="carousel" aria-label="20 identity design concepts" tabIndex={0}
      onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touch.current !== null) { const distance = e.changedTouches[0].clientX - touch.current; if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1); } touch.current = null; }}>
            {frames.map((frame, i) => <svg key={i} className={`concept-slide${index === i ? ' is-active' : ''}`} viewBox={frame.join(' ')} role="img" aria-hidden={index !== i} aria-label={`${names[i]} design concept`}>
        <defs><clipPath id={`concept-crop-${i}`}><rect x={frame[0]} y={frame[1]} width={frame[2]} height={frame[3]} /></clipPath><filter id={`concept-ink-${i}`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.276 -.93 -.094 0 1.22" result="ink" />
          <feFlood floodColor="currentColor" /><feComposite operator="in" in2="ink" />
        </filter></defs>
        <image clipPath={`url(#concept-crop-${i})`} href={`/assets/identity-concepts/sheet-${Math.floor(i / 5) + 1}.png`} width="1024" height="1536" filter={`url(#concept-ink-${i})`} />
      </svg>)}
    </div>
    <div className="concept-controls">
      <button type="button" aria-label="Previous design" onClick={() => move(-1)}>←</button>
      <label><span className="concept-count" aria-live={playing ? 'off' : 'polite'}>{index + 1} / 20</span><select aria-label="Choose a design" value={index} onChange={e => setIndex(Number(e.target.value))}>{names.map((name, i) => <option key={name} value={i}>{name}</option>)}</select></label>
      <button type="button" aria-label="Next design" onClick={() => move(1)}>→</button>
    </div>
    <button className="concept-play" type="button" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause slideshow' : 'Play slideshow'}</button>
    <div className="tile-variations"><span>Name Logos</span><span>Initials</span><span>Signatures</span></div>
    <a className="tile-bottom" href="#logo"><span>Explore your name</span><span aria-hidden="true">↗</span></a>
  </article>;
}


