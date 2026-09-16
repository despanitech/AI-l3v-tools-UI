import {useEffect,useState} from 'react';

// The owner's switch between dev, uat and production. It sits beside the
// logo once the owner key has been entered (kept in this browser), or
// whenever the page is opened at #mode.
//
// Switching wipes this browser's working context - the saved name, the
// active set, purchase intents and preview caches - because a set started
// on one lane cannot continue on another. My assets is not touched: that is
// account work and stored bundles on the server, and it stays.
const KEY='l3v-owner-key';
const MODES=['dev','uat','production'];

export function wipeWorkingContext(){
 try{for(const key of Object.keys(localStorage))if(/^l3v-name-logo|^l3v-identity|^l3v\.identity/.test(key))localStorage.removeItem(key)}catch{}
 try{for(const key of Object.keys(sessionStorage))if(/identity|visualization|name-logo/i.test(key))sessionStorage.removeItem(key)}catch{}
}

export default function ModeSwitch({mode,onChange}){
 const [open,setOpen]=useState(()=>location.hash==='#mode');
 const [key,setKey]=useState(()=>{try{return localStorage.getItem(KEY)||''}catch{return ''}});
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{const change=()=>{if(location.hash==='#mode')setOpen(true)};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);
 if(!key&&!open)return null;

 async function choose(next){
  if(busy||next===mode)return;
  setError('');setBusy(next);
  try{
   const response=await fetch('/api/mode',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key.trim()},body:JSON.stringify({mode:next})});
   if(response.status===404){setError('That owner key is not accepted.');return}
   if(!response.ok){setError('The mode could not be changed.');return}
   try{localStorage.setItem(KEY,key.trim())}catch{}
   const data=await response.json();
   onChange?.(data.mode);
   wipeWorkingContext();
   location.hash='logo';location.reload();
  }catch{setError('The mode could not be changed.')}
  finally{setBusy('')}
 }

 return <div className="app-mode-switch" role="group" aria-label="Site mode">
  {!key&&<input type="password" autoComplete="off" placeholder="Owner key" value={key} onChange={event=>setKey(event.target.value)} aria-label="Owner key"/>}
  {MODES.map(item=><button key={item} type="button" className={item===mode?'active':''} aria-pressed={item===mode} disabled={Boolean(busy)||!key.trim()} onClick={()=>choose(item)}>{busy===item?'...':item}</button>)}
  {key&&<button type="button" className="forget" title="Forget the owner key in this browser" onClick={()=>{try{localStorage.removeItem(KEY)}catch{};setKey('');setOpen(false)}}>x</button>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}
