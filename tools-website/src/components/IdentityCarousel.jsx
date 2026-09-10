import {useRef, useState} from 'react';

const names = ['Clara Bellamy', 'Theo Whitaker', 'Evelyn Ashford', 'Maya Sinclair', 'Nora Laurent', 'Felix Hartwell', 'Iris Kendrick', 'Hugo Wellington', 'Ava Prescott', 'Zara Fitzgerald', 'Dalia Roswell', 'Olivia Bennett', 'Cassian Mercer', 'Leila Morgan', 'Rhea Callahan', 'Jasper Delacroix', 'Sienna Beaumont', 'Bianca Donovan', 'Amara Kingsley', 'Yara Petrov'];
// Viewports reveal the original concepts without altering the source sheets.
const frames = [
  [157,29,838,261],[157,320,838,280],[157,631,838,295],[157,959,838,261],[157,1250,838,255],
  [37,52,952,248],[37,358,952,247],[37,664,952,248],[37,971,952,236],[37,1264,952,233],
  [40,75,945,206],[40,359,945,207],[40,646,945,206],[40,930,945,217],[40,1196,945,235],
  [45,55,935,254],[45,366,935,257],[45,678,935,253],[45,985,935,237],[45,1275,935,229],
];

export default function IdentityCarousel() {
  const [index, setIndex] = useState(0);
  const touch = useRef(null);
  const move = delta => setIndex(current => (current + delta + names.length) % names.length);
  return <article className="tool-tile identity-carousel" aria-label="Magic Identity design showcase">
    <div className="tile-top"><span className="identity-ai-label">AI-POWERED PERSONAL DESIGN</span><span aria-hidden="true">✦</span></div>
    <h2>Magic Identity</h2><p>Your name. Reimagined by AI.</p>
    <div className="concept-viewport" role="region" aria-roledescription="carousel" aria-label="20 identity design concepts" tabIndex={0}
      onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touch.current !== null) { const distance = e.changedTouches[0].clientX - touch.current; if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1); } touch.current = null; }}>
      <svg viewBox={frames[index].join(' ')} role="img" aria-label={`${names[index]} design concept`}><image href={`/assets/identity-concepts/sheet-${Math.floor(index / 5) + 1}.png`} width="1024" height="1536" /></svg>
    </div>
    <div className="concept-controls">
      <button type="button" aria-label="Previous design" onClick={() => move(-1)}>←</button>
      <label><span className="concept-count" aria-live="polite">{index + 1} / 20</span><select aria-label="Choose a design" value={index} onChange={e => setIndex(Number(e.target.value))}>{names.map((name, i) => <option key={name} value={i}>{name}</option>)}</select></label>
      <button type="button" aria-label="Next design" onClick={() => move(1)}>→</button>
    </div>
    <div className="tile-variations"><span>Name Logos</span><span>Initials</span><span>Signatures</span></div>
    <a className="tile-bottom" href="#logo"><span>Explore your name</span><span aria-hidden="true">↗</span></a>
  </article>;
}
