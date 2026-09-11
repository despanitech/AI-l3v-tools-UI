export function validateVideoRequest(body) {
  const r=body.request;
  if(!r || typeof r!=='object' || Array.isArray(r) || Object.keys(r).some(k=>!['frameId','duration','resolution','audio'].includes(k)))throw new Error('Invalid video request.');
  if(typeof r.frameId!=='string'||!/^[a-f0-9]{32}$/.test(r.frameId))throw new Error('Generate a first frame before creating a video.');
  if(!Number.isInteger(r.duration)||r.duration<4||r.duration>30||!['480p','720p','1080p'].includes(r.resolution)||typeof r.audio!=='boolean')throw new Error('Choose a valid duration, resolution and audio setting.');
  return {request:{frameId:r.frameId,duration:r.duration,resolution:r.resolution,audio:r.audio}};
}
export function validateVideoResult(data,baseURL) {
  const base=new URL(baseURL),url=new URL(data.video);
  if(base.protocol!=='https:'||url.protocol!=='https:'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/')||url.username||url.password||!url.pathname.endsWith('.mp4')||data.model!=='seedance2_5')throw new Error('Invalid video result.');
  return {video:url.href,model:data.model};
}
