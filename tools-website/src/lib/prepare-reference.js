function waitMedia(el,event) {
  return new Promise((resolve,reject) => {
    const timer=setTimeout(()=>finish(new Error('The reference could not be read. Try an uploaded image.')),15000);
    const ok=()=>finish(),error=()=>finish(new Error('The reference could not be read.'));
    function finish(err){clearTimeout(timer);el.removeEventListener(event,ok);el.removeEventListener('error',error);err?reject(err):resolve();}
    el.addEventListener(event,ok,{once:true});el.addEventListener('error',error,{once:true});
  });
}
export async function prepareReference(reference) {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(reference.tagName==='IMG') {
    await reference.decode();
    const scale=Math.min(1,1200/Math.max(reference.naturalWidth,reference.naturalHeight));
    canvas.width=Math.max(1,Math.round(reference.naturalWidth*scale));canvas.height=Math.max(1,Math.round(reference.naturalHeight*scale));
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(reference,0,0,canvas.width,canvas.height);
  } else {
    if (!reference.src.startsWith('https:')) throw new Error('Upload a still image or use a public video link for analysis.');
    const video=document.createElement('video'); video.crossOrigin='anonymous';video.muted=true;video.preload='auto';
    try {
      const ready=waitMedia(video,'loadeddata');video.src=reference.src;await ready;
      if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>60)throw new Error('Choose a video up to 60 seconds.');
      canvas.width=1200;canvas.height=400;ctx.fillStyle='#111';ctx.fillRect(0,0,1200,400);
      for(let i=0;i<3;i++) {
        const sought=waitMedia(video,'seeked');video.currentTime=video.duration*[.15,.5,.85][i];await sought;
        const scale=Math.min(400/video.videoWidth,400/video.videoHeight);
        ctx.drawImage(video,i*400+(400-video.videoWidth*scale)/2,(400-video.videoHeight*scale)/2,video.videoWidth*scale,video.videoHeight*scale);
      }
    } finally {video.removeAttribute('src');video.load();}
  }
  let image;
  try { image=canvas.toDataURL('image/jpeg',.8); } catch {throw new Error('This video host blocks frame access. Upload a reference image instead.');}
  if(image.length>1400000)throw new Error('The reference is too detailed to send. Try a smaller image.');
  return {kind:reference.tagName==='IMG'?'image':'video',image,...(reference.tagName==='VIDEO'?{sourceUrl:reference.src}:{})};
}
