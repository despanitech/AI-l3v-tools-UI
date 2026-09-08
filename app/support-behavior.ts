export function initializeSupport(){
 const button=document.querySelector<HTMLButtonElement>('[data-share-guide]');
 if(!button)return ()=>{};
 const status=document.querySelector<HTMLElement>('[data-share-status]');
 const fallback=document.querySelector<HTMLInputElement>('[data-share-link]');
 const url='https://video.l3v.ai/';
 const share=async()=>{
  button.disabled=true;if(status)status.textContent='';
  try{
   if(navigator.share){await navigator.share({title:'AI Video Modelpedia',text:'A free guide to AI video models: compare strengths, explore genres, and find the right model for your next video.',url});if(status)status.textContent='Thanks for helping the guide reach more creators.';return}
   if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(url);if(status)status.textContent='Link copied. Send it to a friend who creates.';return}
   throw new Error('Manual copy required');
  }catch(error){
   if(error instanceof Error&&error.name==='AbortError')return;
   if(fallback){fallback.hidden=false;fallback.focus();fallback.select()}
   if(status)status.textContent='Copy the link below and share it with a friend.';
  }finally{button.disabled=false}
 };
 button.addEventListener('click',share);
 return()=>button.removeEventListener('click',share);
}
