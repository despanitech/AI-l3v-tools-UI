'use client';
import {useEffect,useState} from 'react';
import genres from './genres.json';
import models from './guide.json';
import assets from './genre-frames.json';
import FrameCarousel from './frame-carousel';
import {Carousel,CarouselContent,CarouselItem,CarouselNext,CarouselPrevious,type CarouselApi} from '../components/ui/carousel';
const name=(id:string)=>models.find(m=>m.id===id)?.name||id;
function GenreDetails({index,standalone=false}:{index:number;standalone?:boolean}){
 const g=genres[index];
 return <div className="selected-genre" id={'genre-'+g.id}>
 <div className="selected-genre-heading"><div><p className="eyebrow">GENRE {String(index+1).padStart(2,'0')} / 20</p><h2>{g.name}</h2></div><a className="button ghost" href="#genre-comparison">Compare all models ↓</a></div>
 <div className="selected-genre-body"><FrameCarousel key={g.id} genre={g.id} name={g.name} standalone={standalone}/><div className="genre-playbook"><div className="genre-picks"><p className="eyebrow">YOUR STARTING SHORTLIST</p><a className="primary-pick" href={'#'+g.first}>★ {name(g.first)} ↗</a><p>Also test</p><div>{g.alternatives.map(id=><a className="alternative-pick" key={id} href={'#'+id}>{name(id)} ↗</a>)}</div></div><h3>Why these models</h3><p>{g.why}</p><h3>How to make it</h3><p>{g.workflow}</p><h3>What can go wrong</h3><p>{g.risk}</p><details className="genre-source-notes"><summary>Research & sources</summary><p>{g.popularity}. This is not a current view-count ranking.</p>{g.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</details></div></div></div>;
}
export default function GenreExplorer({standalone=false}:{standalone?:boolean}){
 const [active,setActive]=useState(0);const [api,setApi]=useState<CarouselApi>();
 useEffect(()=>{if(!api)return;const select=()=>setActive(api.selectedScrollSnap());api.on('select',select);return()=>{api.off('select',select)}},[api]);
 useEffect(()=>{if(standalone)return;const route=()=>{const id=location.hash.replace(/^#(?:genre-|frames-)/,'');const i=genres.findIndex(g=>g.id===id);if(i>=0){setActive(i);api?.scrollTo(i,true);document.getElementById('genre-explorer')?.scrollIntoView({block:'start'})}};window.addEventListener('hashchange',route);route();return()=>window.removeEventListener('hashchange',route)},[api,standalone]);
 const cards=genres.map((g,i)=><button key={g.id} type="button" className="genre-choice" data-genre-choice={i} aria-pressed={active===i} aria-label={'Explore '+g.name} onClick={()=>{setActive(i);api?.scrollTo(i)}}><img src={assets.find(a=>a.genre===g.id)?.frames[0]?.url} alt="" loading={i<4?'eager':'lazy'}/><span className="genre-choice-label"><small>{String(i+1).padStart(2,'0')}</small><strong>{g.name}</strong></span></button>);
 return <div id="genre-explorer" className="genre-explorer"><p className="matrix-intro">Browse the images and choose a genre. Its recommended models, sample frames and practical workflow appear below.</p>{standalone?<div data-native-genres><div className="native-genre-track">{cards}</div><div className="frame-controls"><button type="button" data-genre-step="-1" aria-label="Previous genre">←</button><span data-genre-count>1 / 20 · Choose a genre</span><button type="button" data-genre-step="1" aria-label="Next genre">→</button></div></div>:<Carousel className="genre-selector" opts={{align:'center',containScroll:false}} setApi={setApi}><CarouselContent>{cards.map((card,i)=><CarouselItem key={i}>{card}</CarouselItem>)}</CarouselContent><div className="frame-controls"><CarouselPrevious aria-label="Previous genre"/><span>{active+1} / {genres.length} · Swipe or choose a genre</span><CarouselNext aria-label="Next genre"/></div></Carousel>}{standalone?genres.map((g,i)=><div key={g.id} data-genre-panel={i} hidden={i!==0}><GenreDetails index={i} standalone/></div>):<GenreDetails index={active}/>}</div>;
}
