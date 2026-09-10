import {useEffect,useRef,useState} from 'react';
import {post,waitForJob} from '../lib/api-client.mjs';
import SecurityCheck from './SecurityCheck.jsx';

export default function SeedanceVideo({frameId,config}) {
  const [duration,setDuration]=useState(5),[resolution,setResolution]=useState('720p'),[audio,setAudio]=useState(true);
  const [token,setToken]=useState(''),[status,setStatus]=useState(''),[submitted,setSubmitted]=useState(false);
  const [jobId,setJobId]=useState(''),[video,setVideo]=useState(''),[checking,setChecking]=useState(false);
  const locked=useRef(false),run=useRef(null);
  useEffect(()=>()=>run.current?.abort(),[]);
  const credits=duration*({'480p':20,'720p':30,'1080p':68}[resolution]);
  const valid=Number.isInteger(duration)&&duration>=4&&duration<=30&&credits<=Number(config.videoMaxCredits||450);
  async function receive(data,signal){
    if(data.job)setJobId(data.job.id);
    data=await waitForJob(data,setStatus,signal,undefined,undefined,25*60*1000);
    const url=new URL(data.video);if(url.protocol!=='https:')throw new Error('Invalid video result.');
    setVideo(url.href);setStatus('Your video is ready.');
  }
  async function generate(){
    if(locked.current||!token||!valid)return;
    locked.current=true;setSubmitted(true);setChecking(true);setStatus('Submitting video…');
    const controller=new AbortController();run.current=controller;
    try{await receive(await post('/api/image-to-video',{request:{frameId,duration,resolution,audio},token},controller.signal),controller.signal);}
    catch(error){if(error.name!=='AbortError')setStatus(error.message+' No new generation will be submitted automatically.');}
    finally{setChecking(false);}
  }
  async function check(){
    if(checking||!jobId)return;setChecking(true);
    const controller=new AbortController();run.current=controller;
    try{await receive(await post('/api/jobs',{id:jobId},controller.signal),controller.signal);}
    catch(error){if(error.name!=='AbortError')setStatus(error.message);}
    finally{setChecking(false);}
  }
  return <section aria-label="Seedance video generation"><h3>Animate with Seedance 2.5</h3>
    <label>Duration (seconds) <input type="number" min="4" max="30" step="1" value={duration} disabled={submitted} onChange={e=>setDuration(Number(e.target.value))}/></label>
    <label>Resolution <select value={resolution} disabled={submitted} onChange={e=>setResolution(e.target.value)}>{['480p','720p','1080p'].map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Generate audio <input type="checkbox" checked={audio} disabled={submitted} onChange={e=>setAudio(e.target.checked)}/></label>
    <p>{valid?`Estimated ${credits} Runway credits. One video per first frame. Pricing verified September 10, 2026.`:'Choose settings within the configured credit limit.'}</p>
    {!submitted&&<SecurityCheck config={config} action="reference_video" onToken={setToken} onError={setStatus}/>}
    <button className="secondary" disabled={submitted||!token||!valid} onClick={generate}>Generate video</button>
    {jobId&&!video&&<button className="secondary" disabled={checking} onClick={check}>Check video status</button>}
    <p role="status">{status}</p>
    {video&&<><video src={video} controls preload="metadata" style={{maxWidth:'100%'}} aria-label="Generated Seedance video"/><a href={video} download="seedance-video.mp4">Download video</a></>}
  </section>;
}
