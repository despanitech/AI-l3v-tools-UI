'use client';
import {useEffect,useState} from 'react';
import {Switch} from '../components/ui/switch';
export default function ModeSwitch({standalone=false}:{standalone?:boolean}){
 const [light,setLight]=useState(false);
 useEffect(()=>{setLight(document.documentElement.dataset.mode==='light');const update=(e:Event)=>setLight((e as CustomEvent).detail==='light');document.addEventListener('modelpedia-mode-applied',update);return()=>document.removeEventListener('modelpedia-mode-applied',update)},[]);
 return <div className="mode-control"><span>Dark</span>{standalone?<button type="button" role="switch" aria-label="Light appearance" aria-checked="false" data-mode-toggle><span/></button>:<Switch aria-label="Light appearance" checked={light} onCheckedChange={v=>{setLight(v);document.dispatchEvent(new CustomEvent('modelpedia-mode-change',{detail:v?'light':'dark'}))}}/>}<span>Light</span></div>
}
