import {useEffect, useRef, useState} from 'react';
import Prices from './Prices.jsx';
import SecurityCheck from './SecurityCheck.jsx';
import SeedanceVideo from './SeedanceVideo.jsx';

const detailSections = [['observations', 'Reference details'], ['workflow', 'Suggested workflow'], ['limitations', 'What to check']];

export default function AnalysisResult({data, requestAccess, config, onFrame, frameUsed, frame, busy, onError}) {
  const [names, setNames] = useState([]), [token, setToken] = useState('');
  const details = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/model-catalog.json', {signal: controller.signal}).then(r => r.json()).then(value => { if (Array.isArray(value)) setNames(value); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const report = data.report;
  const canPlan = config.newScenePlanner && /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/.test(data.frameTicket || '');
  const frameStage = requestAccess?.stages['/api/first-frame'];
  const frameAction = !frame && frameStage && !frameStage.jobId ? 'Recover first frame' : 'Create a first frame';
  const frameId = frame?.job?.id || frameStage?.jobId || '';
  const videoReady = Boolean(frame && config.videoGeneration && /^[a-f0-9]{32}$/.test(frameId));

  return <section id="analysis-result" aria-label="Video creation plan">
    <header className="result-heading"><div><p className="eyebrow">VIDEO CREATION PLAN</p><h2>Your video direction</h2><p>Analysis complete. Continue through the three stages below.</p></div><span className="result-state">Analysis ready</span></header>
    <div className="result-stage-grid">
      <article className="result-stage"><div className="stage-top"><span className="stage-number">01</span><span className="stage-state complete">Complete</span></div><h3>Analysis</h3><p>{report.summary}</p><button className="text-button" type="button" onClick={() => details.current?.showModal()}>Review details</button></article>
      <article className="result-stage"><div className="stage-top"><span className="stage-number">02</span><span className={'stage-state ' + (frame ? 'complete' : 'active')}>{frame ? 'Ready' : 'Next'}</span></div><h3>First frame</h3>
        {frame ? <><img src={frame.image} alt="Generated first frame for a new scene" className="generated-frame"/><div className="stage-actions"><a href={frame.image} download={'l3v-first-frame.' + (frame.image.startsWith('data:image/png') ? 'png' : 'jpg')}>Download frame</a></div></> : canPlan ? <><p>Create a still image of the proposed scene and approve it before video generation.</p><button className="secondary" disabled={!token || frameUsed || busy} onClick={() => onFrame(token)}>{frameAction}</button>{!frameUsed && <SecurityCheck config={config} action="reference_frame" onToken={setToken} onError={onError}/>}</> : <p>First-frame generation is unavailable for this analysis.</p>}
      </article>
      <article className={'result-stage video-stage' + (videoReady ? ' active' : '')}><div className="stage-top"><span className="stage-number">03</span><span className={'stage-state ' + (videoReady ? 'active' : '')}>{videoReady ? 'Ready' : 'Waiting'}</span></div><h3>Generate video</h3>
        {videoReady ? <SeedanceVideo key={frameId} frameId={frameId} requestAccess={requestAccess} config={config}/> : <p>Generate and approve the first frame to unlock video settings and the final generation button.</p>}
      </article>
    </div>
    {frame && <section className="motion-summary"><div><p className="eyebrow">MOTION DIRECTION</p><h3>What will move</h3></div><p>{frame.motionPrompt}</p></section>}
    <dialog className="analysis-dialog" ref={details} aria-labelledby="analysis-dialog-title" onClick={event => { if (event.target === details.current) details.current.close(); }}><div className="dialog-heading"><div><p className="eyebrow">FULL ANALYSIS</p><h2 id="analysis-dialog-title">Review details</h2></div><button className="secondary" type="button" onClick={() => details.current?.close()}>Close</button></div><div className="dialog-body"><section><h3>Direction summary</h3><p>{report.summary}</p><p>Creative goal: a different scene with the reference’s style, colors, light and mood. Social overlays are not part of the scene; sideways artwork should be read in its intended orientation.</p></section><section><h3>Recommended models</h3>{report.models.map((model, i) => <div className="model-detail" key={i}><h4>{names.find(m => m.id === model.id)?.name || model.id}</h4><p>{model.reason}</p></div>)}</section>{detailSections.map(([key, title]) => Array.isArray(report[key]) && <section key={key}><h3>{title}</h3><ul>{report[key].map((value, i) => <li key={i}>{String(value)}</li>)}</ul></section>)}<section><h3>Suggested prompt</h3><div className="prompt-detail">{report.prompt}</div></section><section className="analysis-price"><Prices models={report.models}/></section></div></dialog>
  </section>;
}
