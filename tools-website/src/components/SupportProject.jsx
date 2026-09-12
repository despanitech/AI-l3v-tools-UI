function destinations(){
  const configured=window.L3V_SUPPORT||{};
  return {kofi:configured.kofi||'',github:configured.github||''};
}

function Actions({compact=false}){
  const links=destinations();
  return <div className={`support-actions${compact?' compact':''}`}>
    <a className="support-primary" href={links.kofi||undefined} aria-disabled={!links.kofi} target="_blank" rel="noreferrer">☕ Buy me a coffee</a>
    <a className="support-secondary" href={links.github||undefined} aria-disabled={!links.github} target="_blank" rel="noreferrer">Sponsor on GitHub</a>
  </div>;
}

export default function SupportProject({variant}){
  if(variant==='home')return <aside className="support-project support-home" aria-labelledby="support-home-title"><p className="eyebrow">SUPPORT THE PROJECT</p><h2 id="support-home-title">Made by one developer, kept alive by you.</h2><p>These tools are free. The servers and AI are not. A coffee helps me keep building, fixing and supporting them.</p><Actions /></aside>;
  if(variant==='assets')return <aside className="support-project support-assets" aria-labelledby="support-assets-title"><span className="support-cup" aria-hidden="true">☕</span><h2 id="support-assets-title">Fuel the next tool.</h2><p>I build and support L3V independently. Your support helps pay for experiments, fixes and server time.</p><Actions /></aside>;
  return <aside className="support-project support-footer"><span className="support-cup" aria-hidden="true">☕</span><div><h2>Free tools, real server bills.</h2><p>If L3V saved you time, help keep it running.</p></div><Actions compact /></aside>;
}
