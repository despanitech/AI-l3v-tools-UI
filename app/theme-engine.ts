import themes from './themes.json';
export function initializeThemes(){
 const root=document.documentElement;let selected='fern';let mode='dark';
 try{selected=localStorage.getItem('modelpedia-theme')||selected;mode=localStorage.getItem('modelpedia-mode')==='light'?'light':'dark'}catch{}
 function apply(){
  const theme=themes.find(t=>t.id===selected)||themes.find(t=>t.id==='fern')!;selected=theme.id;
  const accent=mode==='light'?'#'+theme.accent.slice(1).match(/../g)!.map(x=>Math.round(parseInt(x,16)*.46).toString(16).padStart(2,'0')).join(''):theme.accent;
  root.dataset.mode=mode;root.style.colorScheme=mode;
  root.style.setProperty('--accent',accent);
  root.style.setProperty('--background',mode==='light'?`hsl(${theme.hue} 24% 97%)`:`hsl(${theme.hue} 28% 5%)`);
  root.style.setProperty('--panel',mode==='light'?'#ffffff':`hsl(${theme.hue} 23% 9%)`);
  root.style.setProperty('--foreground',mode==='light'?'#1c2633':'#f3eee4');
  root.style.setProperty('--muted',mode==='light'?'#516070':'#a5a6ab');
  root.style.setProperty('--border',mode==='light'?'#20304026':'#ffffff16');
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme.id)));
  document.querySelectorAll('[data-theme-name]').forEach(el=>el.textContent=theme.name);
  document.querySelectorAll('[data-mode-toggle]').forEach(el=>el.setAttribute('aria-checked',String(mode==='light')));
  document.dispatchEvent(new CustomEvent('modelpedia-mode-applied',{detail:mode}));
 }
 apply();
 function choose(event:Event){
  const target=event.target as Element;
  if(target.closest('[data-mode-toggle]')){mode=mode==='light'?'dark':'light'}
  else{const button=target.closest<HTMLButtonElement>('[data-theme-choice]');if(!button)return;selected=button.dataset.themeChoice!}
  apply();try{localStorage.setItem('modelpedia-theme',selected);localStorage.setItem('modelpedia-mode',mode)}catch{}
 }
 function change(event:Event){mode=(event as CustomEvent).detail==='light'?'light':'dark';apply();try{localStorage.setItem('modelpedia-mode',mode)}catch{}}
 document.addEventListener('click',choose);document.addEventListener('modelpedia-mode-change',change);
 return ()=>{document.removeEventListener('click',choose);document.removeEventListener('modelpedia-mode-change',change)};
}
