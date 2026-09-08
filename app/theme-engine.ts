import themes from './themes.json';
export function initializeThemes(){
 const root=document.documentElement;
 function apply(id:string){
  const theme=themes.find(t=>t.id===id)||themes[0];
  root.style.setProperty('--accent',theme.accent);
  root.style.setProperty('--background',`hsl(${theme.hue} 28% 5%)`);
  root.style.setProperty('--panel',`hsl(${theme.hue} 23% 9%)`);
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme.id)));
  document.querySelectorAll('[data-theme-name]').forEach(el=>el.textContent=theme.name);
 }
 try{apply(localStorage.getItem('modelpedia-theme')||'arctic')}catch{apply('arctic')}
 function choose(event:Event){
  const button=(event.target as Element)?.closest<HTMLButtonElement>('[data-theme-choice]');
  if(!button)return;
  apply(button.dataset.themeChoice!);
  try{localStorage.setItem('modelpedia-theme',button.dataset.themeChoice!)}catch{}
 }
 document.addEventListener('click',choose);
 return ()=>document.removeEventListener('click',choose);
}
