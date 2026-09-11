import {useEffect, useRef, useState} from 'react';
import SecurityCheck from './SecurityCheck.jsx';
import {savedRequest,remember,createRequest,call,imageUrl} from '../lib/name-logo-request.mjs';

export default function NameLogoGenerator({first, last, visible, onFirst, onLast}) {
  const [config, setConfig] = useState(null), [style, setStyle] = useState('');
  const [request, setRequest] = useState(savedRequest), [result, setResult] = useState(null);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [token, setToken] = useState('');
  const active = useRef(null);
  const [image,setImage]=useState(null);
  useEffect(()=>()=>{if(image)URL.revokeObjectURL(image)},[image]);
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
        const data = await call('status',current,{id:current.id},controller.signal);
        const design = data.designs?.[0];
        if (!design || !/^[a-f0-9]{32}$/.test(design.id)) throw new Error('Could not read the design status.');
        if (design.status === 'succeeded') {
          const url=await imageUrl(current,design.id,controller.signal);setImage(url);
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
    if (busy || request?.id || !token) return;
    let current;
    try {current=request || createRequest(first,last,style)} catch {setMessage('Allow browser storage before generating so your request can be recovered.');return;}
    remember(current); setRequest(current); setBusy(true); setMessage('Submitting your design…');
    const controller = new AbortController(); active.current = controller;
    try {
      const data = await call('generate',current,{first:current.first,last:current.last,styleId:current.styleId,requestKey:current.requestKey,token},controller.signal);
      if (!/^[a-f0-9]{64}$/.test(data.id)) throw new Error('Invalid request receipt');
      const accepted = {...current, id:data.id}; remember(accepted); setRequest(accepted); await poll(accepted);
    } catch (error) { if (error.name !== 'AbortError') setMessage('Submission could not be confirmed. Do not submit again; keep the request reference below for support.'); }
    finally { setBusy(false); setToken(''); }
  }
  if (!visible) return null;

  return <section className="live-logo-generator" aria-label="Generate your name logo">
    {!request && <div className="shared-name"><label>Enter your first name<input id="first-name" autoComplete="given-name" value={first} maxLength={80} onChange={e=>onFirst(e.target.value)} /></label><label>Enter your last name<input id="last-name" autoComplete="family-name" value={last} maxLength={80} onChange={e=>onLast(e.target.value)} /></label></div>}
    {busy && <progress aria-label="Creating your name logo" />}
    {!config?.enabled && <p role="status">{config ? 'Generation is not available yet.' : 'Checking availability…'}</p>}
    {!request && <>{config?.enabled && <SecurityCheck config={config} action="name_logo" onToken={setToken} onError={setMessage} />}<button className="identity-try-button" disabled={!config?.enabled || !first.trim() || !last.trim() || !token || busy} onClick={generate}>Generate</button></>}
    <p role="status">{message}</p>
    {request && !request.id && !busy && config?.enabled && <><SecurityCheck config={config} action="name_logo" onToken={setToken} onError={setMessage} /><button disabled={busy||!token} onClick={generate}>Recover saved request</button></>}
    {request && !busy && <><p>{request.first} {request.last} · Request <small>{request.requestKey}</small></p>{request.id && !result && <button className="text-button" disabled={busy} onClick={() => poll(request)}>Check progress</button>}</>}
    {result && <div className="results-main"><div className="results-art"><img src={image} alt={`${result.identity.first} — generated name logo`} /></div><div className="results-caption"><div><strong>{result.design.styleName}</strong><span>{result.design.output.width} × {result.design.output.height} · Original image</span></div><a className="identity-try-button" href={image} download="name-logo.png">Download PNG ↓</a></div><button className="text-button" onClick={() => {remember(null); setRequest(null); setResult(null); setMessage('');}}>Create another variation</button></div>}
  </section>;
}


