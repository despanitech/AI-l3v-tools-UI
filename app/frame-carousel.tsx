'use client';
import {useEffect,useState} from 'react';
import {Carousel,CarouselContent,CarouselItem,CarouselNext,CarouselPrevious,type CarouselApi} from '../components/ui/carousel';
import manifest from './genre-frames.json';
type Asset={genre:string;url:string;type:string;source:string;model:string;scene:string;credit?:string;license?:string;caveat?:string};
function Frame({asset,fraction}:{asset:Asset;fraction:number}){
 const [failed,setFailed]=useState(false);
 return <figure className="genre-frame">{asset.type==='video'&&!failed?<video muted playsInline preload="metadata" src={asset.url} data-frame-fraction={fraction} aria-label={asset.scene+' — frame sample'} onLoadedMetadata={e=>{const v=e.currentTarget;if(Number.isFinite(v.duration)&&v.duration>0)v.currentTime=v.duration*fraction}} onError={()=>setFailed(true)}/>:asset.type==='image'&&!failed?<img src={asset.url} alt={asset.scene} loading="lazy" onError={()=>setFailed(true)}/>:<div className="frame-unavailable">This preview could not load. <a href={asset.source} target="_blank" rel="noreferrer">View it at the source ↗</a></div>}<figcaption><strong>{asset.scene}</strong><span>{asset.model} · {asset.type==='video'?'Frame at '+Math.round(fraction*100)+'% of clip':'Product illustration'}</span><a href={asset.source} target="_blank" rel="noreferrer">Original example ↗</a>{asset.credit&&<span>{asset.credit} · <a href={asset.license} target="_blank" rel="noreferrer">License ↗</a></span>}{asset.caveat&&<span>{asset.caveat}</span>}</figcaption></figure>
}
export default function FrameCarousel({genre,name,standalone=false,compact=false}:{genre:string;name:string;standalone?:boolean;compact?:boolean}){
 const assets=(manifest as Asset[]).filter(a=>a.genre===genre);
 const slides=assets.flatMap(asset=>asset.type==='video'?[{asset,fraction:.2},{asset,fraction:.7}]:[{asset,fraction:0}]).slice(0,4);
 const [api,setApi]=useState<CarouselApi>();const [active,setActive]=useState(0);
 useEffect(()=>{if(!api)return;const update=()=>setActive(api.selectedScrollSnap());update();api.on('select',update);return()=>{api.off('select',update)}},[api]);
 if(!slides.length)return <p className="media-gap">A genre-specific video example has not yet been verified.</p>;
 const heading=<div className="frame-heading"><span>{compact?"SAMPLE FRAMES":"FRAME STUDY / "+name}</span><span>{standalone?slides.length+' frames':(active+1)+' / '+slides.length}</span></div>;
 return <div className={"frame-study"+(compact?" compact-frames":"")}>{standalone?<div data-native-frames>{heading}<div className="native-frame-track">{slides.map((s,i)=><div className="native-frame-slide" key={i}><Frame {...s}/></div>)}</div><div className="frame-controls"><button type="button" data-frame-direction="-1" aria-label="Previous frame">←</button><span>Swipe or use the arrows</span><button type="button" data-frame-direction="1" aria-label="Next frame">→</button></div></div>:<Carousel opts={{loop:true}} setApi={setApi} aria-label={name+' sample frames'}>{heading}<CarouselContent>{slides.map((s,i)=><CarouselItem key={i}><Frame {...s}/></CarouselItem>)}</CarouselContent><div className="frame-controls"><CarouselPrevious/><span>← Browse frames →</span><CarouselNext/></div></Carousel>}<p className="frame-note">Illustrative source example; may use a different model or version from the recommendation. Filmed references and presenter product illustrations are explicitly labeled. Frames show appearance, not a motion-quality benchmark.</p></div>
}
