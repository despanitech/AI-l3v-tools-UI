import MenuFontPicker from './components/MenuFontPicker.jsx';
import {useEffect, useState} from 'react';
import Appearance from './components/Appearance.jsx';
import Home from './components/Home.jsx';
import Identity from './components/Identity.jsx';
import Video from './components/Video.jsx';
import InvitationGate from './components/InvitationGate.jsx';
import MyWork from './components/MyWork.jsx';

const route = () => ['logo', 'initials', 'signature', 'video', 'demo', 'assets', 'work'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
export default function App() {
  const [tool, setTool] = useState(route);
  const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname);
  const identity = ['logo', 'initials', 'signature', 'demo'].includes(tool);
  useEffect(() => { const change = () => setTool(route()); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { document.title = tool === 'home' ? 'l3v AI tools' : `${({logo: 'Magic Identity', initials: 'Magic Initials', signature: 'Magic Signature', video: 'AI Video Suggestion', demo:'Magic Identity Demo', assets:'My assets', work:'My assets'})[tool]} · l3v AI tools`; }, [tool]);
  useEffect(() => {
    if (!document.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(document.modelContext.registerTool({name: 'open_l3v_tool', title: 'Open an l3v AI tool', description: 'Show Magic Identity or AI Video Suggestion. Does not run analysis or upload files.', inputSchema: {type: 'object', properties: {tool: {type: 'string', enum: ['logo', 'video']}}, required: ['tool'], additionalProperties: false}, annotations: {readOnlyHint: false, untrustedContentHint: false}, execute(input) { if (!['logo', 'video'].includes(input?.tool)) throw new Error('Choose logo or video.'); location.hash = input.tool; setTool(input.tool); return {tool: input.tool, opened: true}; }}, {signal: lifecycle.signal})).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  return <InvitationGate><a className="skip" href="#workspace">Skip to tool</a><header className="topbar"><a className="brand" href="#home" aria-label="l3v AI tools home"><img src="/assets/l3v-mark.png" alt="" width="54" height="36" /><span>AI tools</span></a><nav aria-label="Tools"><a href="#home" id="nav-home" aria-current={tool === 'home' ? 'page' : undefined}>All tools</a><a href="#logo" id="nav-logo" aria-current={identity ? 'page' : undefined}>Magic Identity</a><a href="#video" id="nav-video" aria-current={tool === 'video' ? 'page' : undefined}>AI Video Suggestion</a><a href="#assets" aria-current={['assets','work'].includes(tool) ? 'page' : undefined}>My assets</a></nav><Appearance /></header><MenuFontPicker /><main id="workspace" tabIndex={-1}><Home hidden={tool !== 'home'} /><Video hidden={tool !== 'video'} /><MyWork hidden={!['assets','work'].includes(tool)} /><Identity tool={tool} localPreview={localPreview} /></main><footer><span>l3v AI tools</span><span>A little less friction. A little more creating.</span></footer></InvitationGate>;
}


