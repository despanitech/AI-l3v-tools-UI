import {useEffect, useRef, useState} from 'react';
import {receiptForReference, receiptTransport, lastReceipt} from '../lib/video-receipt.mjs';
import {post, waitForJob} from '../lib/api-client.mjs';
import {prepareReference} from '../lib/prepare-reference.js';
import SecurityCheck from './SecurityCheck.jsx';
import AnalysisResult from './AnalysisResult.jsx';
import {facebookReelUrl} from '../lib/facebook-reel.mjs';

export default function Video({hidden}) {
  const [source, setSource] = useState('upload'), [url, setUrl] = useState('');
  const [reference, setReference] = useState(null), [status, setStatus] = useState(''), [dragging, setDragging] = useState(false);
  const [config, setConfig] = useState(null), [configError, setConfigError] = useState('');
  const [token, setToken] = useState(''), [securityVersion, setSecurityVersion] = useState(0);
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [frame, setFrame] = useState(null), [frameUsed, setFrameUsed] = useState(false);
  const file = useRef(null), media = useRef(null), tabs = useRef([]), objectUrl = useRef(''), run = useRef(null), generation = useRef(0), requestAccess = useRef(null), locked = useRef(false), frameAttempted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/analyzer/config', {signal: controller.signal}).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(value => { if (!value.enabled || !value.sitekey) throw new Error(); setConfig(value); }).catch(error => { if (error.name !== 'AbortError') setConfigError('The analysis service is unavailable. You can still preview a reference.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => () => { run.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  function clear() {
    generation.current++; run.current?.abort(); locked.current = false; frameAttempted.current = false;
    if (media.current?.tagName === 'VIDEO') { media.current.pause(); media.current.removeAttribute('src'); media.current.load(); }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = ''; if (file.current) file.current.value = '';
    setReference(null); setStatus(''); setBusy(false); setResult(null); setFrame(null); setFrameUsed(false); setToken(''); setSecurityVersion(v => v + 1); requestAccess.current = null;
  }
  function useFile(value) {
    clear(); if (!value) return;
    const video = false;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) { setStatus('Choose a JPG, PNG or WebP image.'); return; }
    if (!value.size || value.size > 8 * 1024 * 1024) { setStatus('Choose an image up to 8 MB.'); return; }
    objectUrl.current = URL.createObjectURL(value);
    setReference({src: objectUrl.current, video, label: value.name, revision: generation.current});
  }
  function loadLink() {
    clear();
    const value = facebookReelUrl(url);
    if (!value) { setStatus('Enter a Facebook Reel URL such as https://www.facebook.com/reel/123456789.'); return; }
    setReference({src: value, reel: true, label: value, revision: generation.current});
    setStatus('Reel link added. Analysis uses sampled visual frames; it does not listen to the audio.');
  }
  function choose(next) { setSource(next); clear(); }
  function navigate(event, i) { const next = {ArrowLeft: 1 - i, ArrowRight: 1 - i, Home: 0, End: 1}[event.key]; if (next === undefined) return; event.preventDefault(); choose(next ? 'link' : 'upload'); tabs.current[next].focus(); }
  const localVideo = reference?.video && reference.src.startsWith('blob:');
  const enabled = config?.enabled && token && reference && (!reference.reel || config.reelAnalysis) && !busy && !localVideo;
  const note = configError || (reference?.reel ? config?.reelAnalysis?'Public Reels only, up to 90 seconds and 30 MB. Visual samples only; no audio analysis.':'Reel analysis is not available yet. You can upload an image.' : config?.enabled ? 'Get model recommendations and a suggested creation plan.' : 'Suggestions are being connected. You can preview your reference here.');
  async function analyze() {
    if (!enabled || locked.current) return;
    locked.current = true; setBusy(true); setResult(null); setFrame(null); setFrameUsed(false); frameAttempted.current = false;
    const version = generation.current, controller = new AbortController(); run.current = controller;
    const say = value => { if (version === generation.current) setStatus(value); };
    try {
      say('Preparing your reference…'); const body = reference.reel ? {kind:'facebook-reel',sourceUrl:reference.src} : await prepareReference(media.current); controller.signal.throwIfAborted();
      const access = await receiptForReference(body); controller.signal.throwIfAborted();
      requestAccess.current = access;
      const transport = receiptTransport(access);
      setFrameUsed(Boolean(access.stages['/api/first-frame']?.jobId));
      say('Submitting your reference…'); let data = await post('/api/analyze', {...body, token}, controller.signal, transport);
      data = await waitForJob(data, say, controller.signal, transport);
      if (version !== generation.current) return;
      if (!data.report || typeof data.report.summary !== 'string' || !Array.isArray(data.report.models) || typeof data.report.prompt !== 'string' || data.report.models.some(m => !m || typeof m.id !== 'string' || typeof m.reason !== 'string')) throw new Error('The service returned an incomplete result.');
      setResult(data); say('Analysis ready. Review the suggested scene before generating anything.');
    } catch (error) { if (error.name !== 'AbortError') say(error.message); }
    finally { if (version === generation.current) { locked.current = false; setBusy(false); setToken(''); setSecurityVersion(v => v + 1); } }
  }
  async function generateFrame(frameToken) {
    if (locked.current || frameAttempted.current || !frameToken || !result) return;
    frameAttempted.current = true; locked.current = true; setFrameUsed(true); setBusy(true);
    const version = generation.current, controller = new AbortController(); run.current = controller;
    const say = value => { if (version === generation.current) setStatus(value); };
    try {
      const transport = receiptTransport(requestAccess.current);
      say('Requesting the first frame…'); let data = await post('/api/first-frame', {ticket: result.frameTicket, token: frameToken}, controller.signal, transport);
      data = await waitForJob(data, say, controller.signal, transport);
      if (version !== generation.current) return;
      if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(data.image) || typeof data.motionPrompt !== 'string') throw new Error('The frame result is incomplete.');
      setFrame(data); say('First frame ready. No video has been generated.');
    } catch (error) { if (error.name !== 'AbortError') say(error.message + ' This request will not be retried automatically.'); }
    finally { if (version === generation.current) { locked.current = false; setBusy(false); } }
  }
  async function restore() {
    if (locked.current) return;
    clear();
    locked.current = true; setBusy(true);
    const version = generation.current, controller = new AbortController(); run.current = controller;
    const say = value => { if (version === generation.current) setStatus(value); };
    try {
      const access = lastReceipt();
      if (!access) throw new Error('There is no saved request in this tab yet.');
      requestAccess.current = access;
      const transport = receiptTransport(access), analysisId = access.stages['/api/analyze']?.jobId;
      if (!analysisId) throw new Error('The first response was not saved. Add the same image or Reel link again to recover the existing analysis.');
      let data = await post('/api/jobs', {id: analysisId}, controller.signal, transport);
      data = await waitForJob(data, say, controller.signal, transport);
      if (version !== generation.current) return;
      if (!data.report) throw new Error('The analysis result is not available.');
      setResult(data);
      const frameStage = access.stages['/api/first-frame'];
      setFrameUsed(Boolean(frameStage?.jobId)); frameAttempted.current = Boolean(frameStage?.jobId);
      if (frameStage?.jobId) {
        let frameData = await post('/api/jobs', {id: frameStage.jobId}, controller.signal, transport);
        frameData = await waitForJob(frameData, say, controller.signal, transport);
        if (version !== generation.current) return;
        setFrame(frameData);
      }
      say(frameStage && !frameStage.jobId ? 'The first-frame response was not saved. Use Recover first frame to check the same request.' : 'Saved request restored.');
    } catch (error) { if (error.name !== 'AbortError') say(error.message); }
    finally { if (version === generation.current) { locked.current = false; setBusy(false); } }
  }
  function mediaError() { if (reference?.revision !== generation.current) return; clear(); setStatus('This reference could not load. Try another file or a direct video link.'); }
  return <section id="video-panel" aria-labelledby="video-title" hidden={hidden}>
    <div className="intro"><p className="eyebrow">AI VIDEO SUGGESTION</p><h1 id="video-title">Start with a reference.</h1><p>Share a Facebook Reel or an image. Get a step-by-step creation plan, recommended AI models, and estimated costs.</p></div>
    <div className="input-tabs" role="tablist" aria-label="Reference source">{[['upload', 'Image'], ['link', 'Facebook Reel URL']].map(([id, label], i) => <button key={id} role="tab" id={id + '-tab'} aria-selected={source === id} aria-controls={id + '-pane'} tabIndex={source === id ? 0 : -1} ref={el => { tabs.current[i] = el; }} onClick={() => choose(id)} onKeyDown={event => navigate(event, i)}>{label}</button>)}</div>
    <div id="upload-pane" role="tabpanel" aria-labelledby="upload-tab" hidden={source !== 'upload'}><label className={'dropzone' + (dragging ? ' dragging' : '')} id="dropzone" onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); useFile(e.dataTransfer.files[0]); }}><input id="file" ref={file} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a reference image" onChange={e => useFile(e.target.files[0])} /><span className="upload-icon" aria-hidden="true">＋</span><strong>Drop an image here</strong><span>or <u>choose a file</u></span><small>JPG, PNG, WebP · up to 8 MB</small></label></div>
    <div id="link-pane" role="tabpanel" aria-labelledby="link-tab" hidden={source !== 'link'}><label htmlFor="video-url">Facebook Reel URL</label><div className="url-row"><input id="video-url" type="url" placeholder="https://www.facebook.com/reel/…" autoComplete="off" value={url} onChange={e => {setUrl(e.target.value); if (reference) clear();}} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); loadLink(); } }} /><button id="load-link" className="secondary" onClick={loadLink}>Add link</button></div><p className="hint">Facebook Reels only for now. Paste the full Reel URL; shortened share links are not supported yet.</p></div>
    {reference && <div id="reference" className="reference">{!reference.reel && <div id="media"><img key={reference.revision} ref={media} src={reference.src} alt="Your reference image" onError={mediaError} /></div>}<div className="file-row"><span id="filename">{reference.label}</span><button id="remove" className="text-button" onClick={clear}>Remove</button></div></div>}
    <p id="status" role="status" aria-live="polite">{status}</p>
    <div id="analysis-security">{config && <SecurityCheck key={securityVersion} config={config} action="reference_analyze" onToken={setToken} onError={setConfigError} />}</div>
    <div className="submit-row"><button className="primary" disabled={!enabled} aria-describedby="service-note" onClick={analyze}>Analyze reference <span aria-hidden="true">↗</span></button><p id="service-note">{note}</p></div>
    {config?.enabled && <button className="text-button" disabled={busy} onClick={restore}>Check saved request</button>}
    <p className="privacy">{config ? 'On submission, your image or sampled frames are sent to the analysis service.' : 'Your files stay on this device in this preview.'}</p>
    {result && <AnalysisResult key={generation.current + ':' + requestAccess.current?.access.requestId} data={result} requestAccess={requestAccess.current} config={config} onFrame={generateFrame} frameUsed={frameUsed} frame={frame} busy={busy} onError={setStatus} />}
  </section>;
}
