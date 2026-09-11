import {useEffect, useState} from 'react';
import {estimateRate} from '../lib/api-client.mjs';

export default function Prices({models}) {
  const [catalog, setCatalog] = useState(null), [error, setError] = useState('');
  const [rateId, setRateId] = useState(''), [seconds, setSeconds] = useState(''), [takes, setTakes] = useState('1');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/pricing.json', {signal: controller.signal}).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      if (!Array.isArray(data.rates)) throw new Error();
      const first = data.rates.find(r => models.some(m => m.id === r.modelId));
      setCatalog(data); if (first) { setRateId(first.id); setSeconds(String(first.durations[0])); }
    }).catch(e => { if (e.name !== 'AbortError') setError('Price catalog unavailable.'); });
    return () => controller.abort();
  }, [models]);
  if (error) return <div><h3>Video cost estimate</h3><p>{error}</p></div>;
  if (!catalog) return <p>Loading price catalog…</p>;
  const rates = catalog.rates.filter(r => models.some(m => m.id === r.modelId));
  if (!rates.length) return <div><h3>Video cost estimate</h3><p>No verified provider price is available for these models.</p></div>;
  const rate = rates.find(r => r.id === rateId) || rates[0];
  let estimate, message, source;
  try { estimate = estimateRate(catalog, rate.id, Number(seconds), Number(takes)); source = new URL(estimate.source); }
  catch (e) { message = e.message; }
  return <div><h3>Video cost estimate</h3>
    <label>Provider and configuration<select value={rate.id} onChange={e => { const selected = rates.find(r => r.id === e.target.value); setRateId(selected.id); setSeconds(String(selected.durations[0])); }}>{rates.map(r => <option key={r.id} value={r.id}>{r.provider} · {r.model} · {r.resolution} · audio {r.audio}</option>)}</select></label>
    <label>Seconds<select value={seconds} onChange={e => setSeconds(e.target.value)}>{rate.durations.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
    <label>Takes<input type="number" min="1" max="20" value={takes} onChange={e => setTakes(e.target.value)} /></label>
    <p aria-live="polite">{message || `$${estimate.perTake} per take · $${estimate.estimatedTotal} USD estimated total`}</p>
    {estimate && <p>{estimate.stale ? 'Outdated price — ' : ''}Verified {estimate.verifiedAt.slice(0, 10)} · {estimate.catalogRevision}. {source?.protocol === 'https:' && <a href={source.href} target="_blank" rel="noopener">Provider pricing</a>}</p>}
    <p>Catalog estimate, not a charge or availability guarantee. Excludes analysis, first-frame generation, tax, platform markup and upscaling. Changing this estimate does not generate or purchase a video.</p>
  </div>;
}
