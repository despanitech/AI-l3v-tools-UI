import {useEffect, useRef, useState} from 'react';
import SecurityCheck from './SecurityCheck.jsx';
import {post} from '../lib/api-client.mjs';

const storageKey = 'l3v-name-logo-request';
function savedRequest() { try { return JSON.parse(sessionStorage.getItem(storageKey)) || null; } catch { return null; } }
function remember(value) { try { value ? sessionStorage.setItem(storageKey, JSON.stringify(value)) : sessionStorage.removeItem(storageKey); } catch {} }

export default function NameLogoGenerator({first, last, visible}) {
  const [config, setConfig] = useState(null), [style, setStyle] = useState('');
  const [request, setRequest] = useState(savedRequest), [result, setResult] = useState(null);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [token, setToken] = useState('');
  const active = useRef(null);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    fetch('/api/name-logo/catalog', {signal:controller.signal}).then(r => r.ok ? r.json() : null).then(data => {
      if (!data || !Array.isArray(data.styles)) return;
      setConfig(data); setStyle(old => old || data.styles[0]?.id || '');
    }).catch(() => {});
    return () => controller.abort();
  }, [visible]);
  useEffect(() => () => active.current?.abort(), []);

  async function poll(current) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setMessage('Checking your design…');
    try {
      const deadline = Date.now() + 15 * 60 * 1000;
      while (Date.now() < deadline) {
        const data = await post('/api/name-logo/status', {id:current.id}, controller.signal);
        const design = data.designs?.[0];
        if (!design || !/^[a-f0-9]{32}$/.test(design.id)) throw new Error('Could not read the design status.');
        if (design.status === 'succeeded') {
          setResult({...data, design}); setMessage('Your design is ready.'); return;
        }
        if (!['queued','running'].includes(design.status)) {
          setMessage(design.status === 'ambiguous' ? 'The result is uncertain. Keep this request for support; it has not been repeated.' : `This design is ${design.status}. No image is available.`); return;
        }
        setMessage(design.status === 'queued' ? 'Your design is queued…' : 'Creating your name logo…');
        await new Promise(resolve => setTimeout(resolve, 2500)); controller.signal.throwIfAborted();
      }
      setMessage('Still working. Check progress again; your request will not be repeated.');
    } catch (error) { if (error.name !== 'AbortError') setMessage('Could not check progress. Your request is saved; check again shortly.'); }
    finally { if (active.current === controller) setBusy(false); }
  }

  async function generate() {
    if (busy || request || !first.trim() || !last.trim() || !style || !token) return;
    const current = {requestKey:crypto.randomUUID(), first:first.trim(), last:last.trim(), styleId:style};
    remember(current); setRequest(current); setBusy(true); setMessage('Submitting your design…');
    const controller = new AbortController(); active.current = controller;
    try {
      const data = await post('/api/name-logo/generate', {...current, token}, controller.signal);
      if (!/^[a-f0-9]{64}$/.test(data.id)) throw new Error('Invalid request receipt');
      const accepted = {...current, id:data.id}; remember(accepted); setRequest(accepted); await poll(accepted);
    } catch (error) { if (error.name !== 'AbortError') setMessage('Submission could not be confirmed. Do not submit again; keep the request reference below for support.'); }
    finally { setBusy(false); setToken(''); }
  }
  if (!visible || !config?.enabled) return null;
  const image = result && '/api/name-logo/image?id=' + result.design.id;
  return <section className="live-logo-generator" aria-label="Generate your name logo">
    <h2>Create your name logo</h2>
    {!request && <><label>Style <select aria-label="Name logo style" value={style} onChange={e => setStyle(e.target.value)}>{config.styles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><SecurityCheck config={config} action="name_logo" onToken={setToken} onError={setMessage} /><button className="identity-try-button" disabled={!first.trim() || !last.trim() || !token || busy} onClick={generate}>Generate name logo</button></>}
    <p role="status">{message}</p>
    {request && <><p>{request.first} {request.last} · Request <small>{request.requestKey}</small></p>{request.id && !result && <button className="text-button" disabled={busy} onClick={() => poll(request)}>Check progress</button>}</>}
    {result && <div className="results-main"><div className="results-art"><img src={image} alt={`${result.identity.first} — generated name logo`} /></div><div className="results-caption"><div><strong>{result.design.styleName}</strong><span>{result.design.output.width} × {result.design.output.height} · Original image</span></div><a className="identity-try-button" href={image + '&download=1'} download>Download PNG ↓</a></div><button className="text-button" onClick={() => {remember(null); setRequest(null); setResult(null); setMessage('');}}>Create another variation</button></div>}
  </section>;
}
