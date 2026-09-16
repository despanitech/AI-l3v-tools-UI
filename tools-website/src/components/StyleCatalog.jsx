import {useEffect,useRef,useState} from 'react';
import previews from '../lib/style-previews.json';
import InkPreview from './InkPreview.jsx';

const modes=[['logo','Name logo'],['initials','Initials'],['signature','Signature']];

export default function StyleCatalog({styles,selected,onChange,first,last,onEdit,security,footer}){
 const [active,setActive]=useState('logo'),[gallery,setGallery]=useState('logo'),[ink,setInk]=useState('#202720'),[open,setOpen]=useState(false),[galleryReady,setGalleryReady]=useState(false),[compact,setCompact]=useState(false);const dialog=useRef(null),dock=useRef(null),expandedDockHeight=useRef(0);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open]);
 useEffect(()=>{if(!open){setGalleryReady(false);return}const timer=setTimeout(()=>setGalleryReady(true),40);return()=>clearTimeout(timer)},[open,gallery]);
 useEffect(()=>{const update=()=>{if(window.matchMedia('(max-width: 760px)').matches){setCompact(false);return}if(dock.current&&!dock.current.classList.contains('is-compact'))expandedDockHeight.current=dock.current.getBoundingClientRect().height;const remaining=document.documentElement.scrollHeight-window.innerHeight-window.scrollY;setCompact(window.scrollY>4&&remaining<(expandedDockHeight.current||170)+16)};requestAnimationFrame(update);window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update)}},[]);
 const available=styles.length?styles:previews.map(({id,mode})=>({id,mode,name:id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')}));
 function stylesFor(mode){return available.filter(s=>s.mode===mode)}
 function currentFor(mode){const shown=stylesFor(mode),chosen=selected.find(s=>s.mode===mode)?.id,index=Math.max(0,shown.findIndex(s=>s.id===chosen));return {shown,index,current:shown[index]}}
 function choose(mode,id){onChange(selected.map(s=>s.mode===mode?{mode,id}:s))}
 function cycle(mode,direction){const {shown,index}=currentFor(mode);if(shown.length)choose(mode,shown[(index+direction+shown.length)%shown.length].id)}
 function showGallery(mode){setGallery(mode);setOpen(true)}
 function artwork(style){return style?<InkPreview src={previews.find(p=>p.mode===style.mode&&p.id===style.id)?.src} color={ink} label={`${style.name} style example`}/>:null}
 function carousel(mode,compact=false){const label=modes.find(m=>m[0]===mode)?.[1],{current}=currentFor(mode);return <article className={compact?'identity-carousel compact':'identity-carousel'} key={mode}><div className="carousel-heading"><strong>{label}</strong><button type="button" onClick={()=>showGallery(mode)}>View all styles</button></div><div className="carousel-canvas"><button type="button" aria-label={`Previous ${label} style`} onClick={()=>cycle(mode,-1)}>←</button><div className="carousel-art">{artwork(current)}</div><button type="button" aria-label={`Next ${label} style`} onClick={()=>cycle(mode,1)}>→</button></div><small>{current?.name}</small></article>}
 const galleryMode=gallery,{shown,current}=currentFor(galleryMode);
 return <>
 {footer&&<div className="identity-generate-footer identity-generate-top"><span>All 3 included</span>{footer}</div>}
 <section className="identity-workspace" aria-label="Choose styles">
  <div ref={dock} className={`identity-control-dock${compact?' is-compact':''}`}>
  <aside className="identity-controls-panel">
   <div className="workspace-person"><div><small>Your name</small><strong>{first} {last}</strong></div><button type="button" onClick={onEdit}>Edit</button></div>
   <div className="identity-selection-summary"><small>Your collection</small><div>{modes.map(([mode,label],index)=>{const choice=selected.find(item=>item.mode===mode),style=available.find(item=>item.mode===mode&&item.id===choice?.id);return <article key={mode}><b>{String(index+1).padStart(2,'0')}</b><span><small>{label}</small><strong>{style?.name||'Choose a style'}</strong></span><i aria-hidden="true">✓</i></article>})}</div><p>Each design uses the same name and preview ink.</p></div>
   <label className="ink-control"><span>Preview ink</span><input aria-label="Preview ink color" type="color" value={ink} onChange={e=>setInk(e.target.value)}/><b>{ink.toUpperCase()}</b></label>
   {security&&<div className="identity-security">{security}</div>}
  </aside>
  <div className="identity-generate-footer"><span>All 3 included</span>{footer}</div>
  </div>
  <div className="identity-preview-stage">
   <div className="preview-mode-heading"><span>Cycle through to visualise</span><div className="preview-mode-tabs">{[...modes,['all-horizontal','All 3 horizontal'],['all-vertical','All 3 vertical']].map(([mode,label])=><button key={mode} type="button" aria-pressed={active===mode} onClick={()=>setActive(mode)}>{label}</button>)}</div></div>
   <div className={active.startsWith('all-')?`all-three-preview ${active}`:'single-preview'}>{active.startsWith('all-')?modes.map(([mode])=>carousel(mode,true)):carousel(active)}</div>
  </div>
  <dialog className="style-gallery-dialog" ref={dialog} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}><div className="workspace-style-heading"><h2>Select {modes.find(m=>m[0]===galleryMode)?.[1].toLowerCase()} style</h2><button type="button" onClick={()=>setOpen(false)}>Close</button></div><p>{shown.length} styles</p>{open&&(galleryReady?<div className="style-gallery-items">{shown.map(s=><button key={s.id} type="button" aria-pressed={s.id===current?.id} onClick={()=>{choose(galleryMode,s.id);setOpen(false)}}>{artwork(s)}<strong>{s.name}</strong><small>{s.id===current?.id?'Current style':'Select style'}</small></button>)}</div>:<div className="style-gallery-loading" role="status"><span className="style-spinner" aria-hidden="true"/>Loading styles...</div>)}</dialog>
 </section>
 </>
}
