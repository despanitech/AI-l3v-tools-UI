import {useEffect,useRef,useState} from 'react';
const masks=new Map();
async function maskFor(src){
 if(masks.has(src))return masks.get(src);
 const task=(async()=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');const scale=Math.min(1,720/image.naturalWidth);c.width=Math.round(image.naturalWidth*scale);c.height=Math.round(image.naturalHeight*scale);const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height,edge=[];
 for(let n=0;n<50;n++){const xx=Math.floor(n*w/50),yy=Math.floor(n*h/50);edge.push((xx+Math.floor(h*.02)*w)*4,(xx+Math.floor(h*.98)*w)*4,(Math.floor(w*.02)+yy*w)*4,(Math.floor(w*.98)+yy*w)*4)}
 const bg=[0,1,2].map(k=>edge.map(i=>d[i+k]).sort((a,b)=>a-b)[100]);const distances=new Float32Array(w*h);let max=0;
 for(let k=0;k<distances.length;k++){const i=k*4;distances[k]=Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);max=Math.max(max,distances[k])}
 const alpha=new Uint8ClampedArray(w*h);for(let k=0;k<alpha.length;k++)alpha[k]=Math.min(1,Math.max(0,(distances[k]-18)/Math.max(1,max-18)))*d[k*4+3];return {w,h,alpha};})();masks.set(src,task);try{return await task}catch(e){masks.delete(src);throw e}
}
export default function InkPreview({src,color,label}){const ref=useRef(null),[failed,setFailed]=useState(false);useEffect(()=>{let cancelled=false;setFailed(false);if(!src){setFailed(true);return}maskFor(src).then(m=>{if(cancelled)return;const c=ref.current;c.width=m.w;c.height=m.h;const x=c.getContext('2d'),out=x.createImageData(m.w,m.h),rgb=[1,3,5].map(n=>parseInt(color.slice(n,n+2),16));for(let k=0;k<m.alpha.length;k++){out.data.set([...rgb,m.alpha[k]],k*4)}x.putImageData(out,0,0)}).catch(()=>{if(!cancelled)setFailed(true)});return()=>{cancelled=true}},[src,color]);return failed?<p>Preview unavailable</p>:<canvas ref={ref} role="img" aria-label={label}/>}
