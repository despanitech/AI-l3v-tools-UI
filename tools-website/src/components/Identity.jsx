import {useEffect, useRef, useState} from 'react';
import {readStored, writeStored} from '../lib/storage.js';

const directions = [
  ['name', 'Magic Name', 'Your first name, shaped into a mark.'],
  ['initials', 'Magic Initials', 'Two initials, intertwined.'],
  ['signature', 'Magic Signature', 'Your first initial and full surname.'],
];
const examples = {
  name: {file: 'magic-name.png', alt: 'Evan — Diagonal Weave name logo example'},
  initials: {file: 'magic-initials.png', alt: 'E and H — Gothic Weave initials example'},
  signature: {file: 'magic-signature.png', alt: 'E. Hart — Couture Sweep signature example'},
};
function savedNames() { try { return JSON.parse(readStored('l3v-logo-names', '{}')) || {}; } catch { return {}; } }
const initial = text => new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text)[Symbol.iterator]().next().value?.segment || '';

export default function Identity({tool, localPreview}) {
  const [saved] = useState(savedNames);
  const [first, setFirst] = useState(typeof saved.first === 'string' ? saved.first : '');
  const [last, setLast] = useState(typeof saved.last === 'string' ? saved.last : '');
  const [direction, setDirection] = useState(directions.some(([id]) => id === saved.direction) ? saved.direction : 'name');
  const [editor, setEditor] = useState('idle');
  const buttons = useRef([]);
  const visible = ['logo', 'initials', 'signature'].includes(tool);
  useEffect(() => { if (visible) setDirection(tool === 'logo' ? 'name' : tool); }, [tool, visible]);
  useEffect(() => { writeStored('l3v-logo-names', JSON.stringify({first, last, direction})); }, [first, last, direction]);
  useEffect(() => {
    if (!visible || !localPreview) return;
    const controller = new AbortController();
    setEditor('loading');
    fetch('/api/logo-status', {signal: controller.signal}).then(r => r.json()).then(data => setEditor(data.available ? 'ready' : 'missing')).catch(error => { if (error.name !== 'AbortError') setEditor('missing'); });
    return () => controller.abort();
  }, [visible, localPreview, tool]);
  const example = !first.trim() && !last.trim();
  const f = example ? 'Evan' : first.trim(), l = example ? 'Hart' : last.trim();
  const values = {name: f || 'Add your first name', initials: f && l ? `${initial(f).toLocaleUpperCase()}.${initial(l).toLocaleUpperCase()}.` : 'Add both names', signature: f && l ? `${initial(f).toLocaleUpperCase()}. ${l}` : 'Add both names'};
  function navigate(event, index) {
    const next = {ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2}[event.key];
    if (next === undefined) return;
    event.preventDefault(); setDirection(directions[next][0]); buttons.current[next].focus();
  }
  return <section id="logo-panel" aria-label="Magic Identity" hidden={!visible}>
    <div className="name-workspace"><p className="eyebrow">YOUR NAME, THREE DIRECTIONS</p><h1>Make it your own.</h1>
      <div className="shared-name"><label>First name<input id="first-name" autoComplete="given-name" placeholder="Evan" maxLength={80} value={first} onChange={e => setFirst(e.target.value)} /></label><label>Last name<input id="last-name" autoComplete="family-name" placeholder="Hart" maxLength={80} value={last} onChange={e => setLast(e.target.value)} /></label></div>
      <div className="direction-cards" role="tablist" aria-label="Creative direction">{directions.map(([id, label, copy], i) => <button key={id} ref={el => { buttons.current[i] = el; }} id={'direction-' + id} role="tab" aria-selected={direction === id} aria-controls="direction-preview" tabIndex={direction === id ? 0 : -1} onClick={() => setDirection(id)} onKeyDown={e => navigate(e, i)}><span>0{i + 1}</span><strong>{label}</strong><small>{copy}</small><span className="direction-artwork"><img src={'/assets/identity/' + examples[id].file} alt={examples[id].alt} width={id === 'signature' ? 1774 : 1254} height={id === 'signature' ? 887 : 1254} loading="lazy" decoding="async" /></span><small className="artwork-label">Style example</small><small className="typed-name-label">{example ? 'Example text' : 'Your text'}</small><b id={'sample-' + id}>{values[id]}</b></button>)}</div>
      <div id="direction-preview" role="tabpanel" aria-labelledby={'direction-' + direction}><p id="direction-text" aria-live="polite">{example ? 'Example text' : 'Text to use'}: {values[direction]}</p><button className="secondary" disabled>Generation coming soon</button><p className="direction-note">Text preview only. Artwork generation is not connected.</p></div>
    </div>
    {localPreview && <><div className="logo-heading"><div><h1>Magic Name</h1><p>Choose a name design and refine its shape.</p></div><a href="http://127.0.0.1:4184/" target="_blank" rel="noopener">Open full window ↗</a></div><aside className="logo-roadmap" aria-label="Initials and upcoming tools"><a href="http://127.0.0.1:4184/initials-round-2026-09-09/index.html" target="_blank" rel="noopener">Review 30 initials concepts ↗</a><span>Drafts including N.O. and L.D. · Review only</span><a href="http://127.0.0.1:4184/surname-sampler/index.html?v=restored-core" target="_blank" rel="noopener">Review lettering studies ↗</a><span>150 new studies · Unreviewed · Previous batch retained</span></aside><p id="logo-status" role="status">{editor === 'loading' ? 'Opening the local editor…' : editor === 'missing' ? 'The local logo editor is not running. Start it, then select Magic Name again.' : ''}</p>{editor === 'ready' && <iframe id="logo-frame" title="Magic Name editor" allow="clipboard-write" src="http://127.0.0.1:4184/" />}</>}
  </section>;
}
