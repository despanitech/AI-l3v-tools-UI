document.querySelectorAll<HTMLVideoElement>('[data-frame-fraction]').forEach(video=>{
 const seek=()=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=video.duration*Number(video.dataset.frameFraction)};
 video.addEventListener('loadedmetadata',seek);if(video.readyState>=1)seek();
});
document.addEventListener('click',event=>{
 const button=(event.target as Element).closest<HTMLElement>('[data-frame-direction]');
 if(!button)return;const track=button.closest('[data-native-frames]')?.querySelector('.native-frame-track');
 if(track)track.scrollBy({left:track.clientWidth*Number(button.dataset.frameDirection),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});
