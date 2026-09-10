import {useEffect, useState} from 'react';
import Prices from './Prices.jsx';
import SecurityCheck from './SecurityCheck.jsx';
import SeedanceVideo from './SeedanceVideo.jsx';

export default function AnalysisResult({data, config, onFrame, frameUsed, frame, busy, onError}) {
  const [names, setNames] = useState([]), [token, setToken] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/model-catalog.json', {signal: controller.signal}).then(r => r.json()).then(value => { if (Array.isArray(value)) setNames(value); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const report = data.report;
  const canPlan = config.newScenePlanner && /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/.test(data.frameTicket || '');
  return <section id="analysis-result" aria-label="Video suggestions"><h2>Your video direction</h2><p>{report.summary}</p><p>Creative goal: a different scene with the reference’s style, colors, light and mood. Social overlays are not part of the scene; sideways artwork should be read in its intended orientation.</p>
    <h3>Recommended models</h3>{report.models.map((model, i) => <div key={i}><h4>{names.find(m => m.id === model.id)?.name || model.id}</h4><p>{model.reason}</p></div>)}
    {[['observations', 'Reference details'], ['workflow', 'Suggested workflow'], ['limitations', 'What to check']].map(([key, title]) => Array.isArray(report[key]) && <div key={key}><h3>{title}</h3><ul>{report[key].map((value, i) => <li key={i}>{String(value)}</li>)}</ul></div>)}
    <h3>Suggested prompt</h3><p>{report.prompt}</p><Prices models={report.models} />
    <h3>Optional first frame</h3>{canPlan ? <><p>Create a still image of a different scene with the same visual mood. This does not generate a video.</p><button className="secondary" disabled={!token || frameUsed || busy} onClick={() => onFrame(token)}>Create a first frame</button>{!frameUsed && <SecurityCheck config={config} action="reference_frame" onToken={setToken} onError={onError} />}</> : <p>Automatic planning for a different scene is not connected. First-frame generation is unavailable.</p>}
    {frame && <><img src={frame.image} alt="Generated first frame for a new scene" className="generated-frame" /><a href={frame.image} download={'l3v-first-frame.' + (frame.image.startsWith('data:image/png') ? 'png' : 'jpg')}>Download first frame</a><h3>Motion prompt</h3><p>{frame.motionPrompt}</p></>}
    {frame&&config.videoGeneration&&/^[a-f0-9]{32}$/.test(frame.job?.id||'')&&<SeedanceVideo key={frame.job.id} frameId={frame.job.id} config={config}/>}
  </section>;
}
