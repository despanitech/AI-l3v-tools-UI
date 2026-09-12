import {useState} from 'react';
import './IdentityResults.css';

const samples = [
  {id: 'name', label: 'Magic Name', style: 'Diagonal Weave', text: 'Evan', file: 'magic-name.png'},
  {id: 'initials', label: 'Magic Initials', style: 'Airy Ribbon', text: 'E.H.', file: 'magic-initials.png'},
  {id: 'signature', label: 'Magic Signature', style: 'Bold Autograph', text: 'E. Hart', file: 'magic-signature.png'},
];

export default function IdentityResults({onBack}) {
  const [selected, setSelected] = useState('name');
  const design = samples.find(item => item.id === selected);
  return <section className="identity-results" aria-label="Sample results">
    <header className="results-heading"><div><p className="eyebrow">SAMPLE COLLECTION</p><h1>Evan Hart</h1><p>Explore the results layout with our existing examples.</p></div><button className="text-button" onClick={onBack}>← Back to your name</button></header>
    <aside className="demo-primary-cta" aria-label="Create your own identity"><div><strong>Try your name now</strong><span>Turn your name into a logo, initials and signature.</span></div><button onClick={onBack}>Create yours →</button></aside>
    <div className="results-categories" aria-label="Design category">{samples.map(item => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div>
    <div className="results-layout">
      <div className="results-main"><div className="results-art"><img key={design.id} src={'/assets/identity/' + design.file} alt={`${design.text} — ${design.style} sample`} /></div><div className="results-caption"><div><strong>{design.style}</strong><span>{design.text} · Sample artwork</span></div><a className="identity-try-button" href={'/assets/identity/' + design.file} download={`evan-hart-${design.id}-sample.png`}>Download sample ↓</a></div></div>
      <aside className="results-options"><h2>Your collection</h2><p>One identity, three directions.</p>{samples.map(item => <button className="result-thumbnail" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><img src={'/assets/identity/' + item.file} alt="" /><span><strong>{item.label}</strong><small>{item.style}</small></span></button>)}<p className="results-note">These are Evan Hart examples, not designs generated from your name. Personal generation and the full style library are not connected yet.</p></aside>
    </div>
  </section>;
}
