document.addEventListener('click',event=>{
 const button=(event.target as Element).closest<HTMLElement>('[data-frame-direction]');
 if(!button)return;const track=button.closest('[data-native-frames]')?.querySelector('.native-frame-track');
 if(track)track.scrollBy({left:track.clientWidth*Number(button.dataset.frameDirection),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});

const genreButtons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-genre-choice]'));
const genreTrack=document.querySelector<HTMLElement>('.native-genre-track');
let selectedGenre=0;
function selectGenre(index:number,scroll=true){
 selectedGenre=Math.max(0,Math.min(genreButtons.length-1,index));
 genreButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selectedGenre)));
 document.querySelectorAll<HTMLElement>('[data-genre-panel]').forEach(p=>p.hidden=Number(p.dataset.genrePanel)!==selectedGenre);
 const count=document.querySelector('[data-genre-count]');if(count)count.textContent=(selectedGenre+1)+' / '+genreButtons.length+' · Choose a genre';
 if(scroll&&genreTrack){const button=genreButtons[selectedGenre];genreTrack.scrollTo({left:button.offsetLeft-genreTrack.offsetLeft-(genreTrack.clientWidth-button.clientWidth)/2,behavior:'smooth'})}
}
document.addEventListener('click',event=>{
 const choice=(event.target as Element).closest<HTMLElement>('[data-genre-choice]');if(choice)selectGenre(Number(choice.dataset.genreChoice));
 const step=(event.target as Element).closest<HTMLElement>('[data-genre-step]');if(step)selectGenre(selectedGenre+Number(step.dataset.genreStep));
});
let scrollTimer:ReturnType<typeof setTimeout>;
genreTrack?.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{const center=genreTrack.getBoundingClientRect().left+genreTrack.clientWidth/2;let index=0,distance=Infinity;genreButtons.forEach((b,i)=>{const r=b.getBoundingClientRect();const d=Math.abs(r.left+r.width/2-center);if(d<distance){distance=d;index=i}});selectGenre(index,false)},160)});
function routeGenre(){const id=location.hash.replace(/^#(?:genre-|frames-)/,'');const panel=document.getElementById('genre-'+id)?.closest<HTMLElement>('[data-genre-panel]');if(panel){selectGenre(Number(panel.dataset.genrePanel));document.getElementById('genre-explorer')?.scrollIntoView({block:'start'})}}
window.addEventListener('hashchange',routeGenre);routeGenre();
