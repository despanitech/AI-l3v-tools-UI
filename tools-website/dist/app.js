const $ = id => document.getElementById(id);
let logoLoaded = false, objectUrl = '', revision = 0;
const localPreview = ['127.0.0.1','localhost'].includes(location.hostname);
document.querySelectorAll('[data-local-only]').forEach(element => element.hidden = !localPreview);
function openTool(tool) {
  const logo = ['logo','initials','signature'].includes(tool);
  $('home-panel').hidden = tool !== 'home';
  $('logo-panel').hidden = !logo; $('video-panel').hidden = tool !== 'video';
  for (const name of ['home','logo', 'video']) {
    const link = $('nav-' + name);
    if (name === (logo ? 'logo' : tool)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = tool === 'home' ? 'l3v AI tools' : `${({logo:'Magic Identity',initials:'Magic Initials',signature:'Magic Signature',video:'AI Video Suggestion'})[tool]} · l3v AI tools`;
  if(logo)document.dispatchEvent(new CustomEvent('l3v-direction',{detail:tool==='logo'?'name':tool}));
  if (logo && localPreview && !logoLoaded) {
    logoLoaded = true;
    $('logo-status').textContent = 'Opening the local editor…';
    fetch('/api/logo-status').then(r => r.json()).then(data => {
      if (!data.available) throw new Error();
      $('logo-frame').src = 'http://127.0.0.1:4184/';
      $('logo-frame').hidden = false;
      $('logo-status').textContent = '';
    }).catch(() => { logoLoaded = false; $('logo-status').textContent = 'The local logo editor is not running. Start it, then select Magic Name again.'; });
  }
}
function route() { const tool=location.hash.slice(1);openTool(['logo','initials','signature','video'].includes(tool)?tool:'home'); }
window.addEventListener('hashchange', route);
$('nav-logo').addEventListener('click', () => { if (location.hash === '#logo') openTool('logo'); });
route();
function chooseSource(source) {
  for (const name of ['upload', 'link']) {
    const active = source === name;
    $(name + '-tab').setAttribute('aria-selected', String(active));
    $(name + '-tab').tabIndex = active ? 0 : -1;
    $(name + '-pane').hidden = !active;
  }
  clearReference();
}
for (const name of ['upload', 'link']) {
  $(name + '-tab').onclick = () => chooseSource(name);
  $(name + '-tab').onkeydown = event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 'upload' : event.key === 'End' ? 'link' : name === 'upload' ? 'link' : 'upload';
      chooseSource(next); $(next + '-tab').focus();
    }
  };
}
function clearReference() {
  revision++;
  const video = $('media').querySelector('video');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  $('media').replaceChildren();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = ''; $('reference').hidden = true; $('file').value = ''; $('status').textContent = '';
}
function showMedia(src, video, label) {
  const current = revision;
  const media = document.createElement(video ? 'video' : 'img');
  if (video) { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
  else media.alt = 'Your reference image';
  media.onerror = () => { if (current === revision) { clearReference(); $('status').textContent = 'This reference could not load. Try another file or a direct video link.'; } };
  if (video) media.onloadedmetadata = () => {
    if (current === revision && (!Number.isFinite(media.duration) || media.duration > 60)) {
      clearReference(); $('status').textContent = 'Choose a video up to 60 seconds long.';
    }
  };
  media.src = src; $('media').replaceChildren(media); $('filename').textContent = label; $('reference').hidden = false;
}
function useFile(file) {
  clearReference(); if (!file) return;
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/webm'];
  const video = videoTypes.includes(file.type);
  if (!video && !imageTypes.includes(file.type)) { $('status').textContent = 'Choose a JPG, PNG, WebP, MP4 or WebM file.'; return; }
  if (!file.size || file.size > (video ? 100 : 8) * 1024 * 1024) { $('status').textContent = `Choose a ${video ? 'video up to 100' : 'picture up to 8'} MB.`; return; }
  objectUrl = URL.createObjectURL(file); showMedia(objectUrl, video, file.name);
}
$('file').onchange = event => useFile(event.target.files[0]);
for (const event of ['dragover', 'dragenter']) $('dropzone').addEventListener(event, e => { e.preventDefault(); $('dropzone').classList.add('dragging'); });
$('dropzone').ondragleave = () => $('dropzone').classList.remove('dragging');
$('dropzone').ondrop = e => { e.preventDefault(); $('dropzone').classList.remove('dragging'); useFile(e.dataTransfer.files[0]); };
$('remove').onclick = clearReference;
$('load-link').onclick = () => {
  clearReference();
  try {
    const url = new URL($('video-url').value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || !/\.(mp4|webm)$/i.test(url.pathname)) throw new Error();
    showMedia(url.href, true, url.hostname + url.pathname);
  } catch { $('status').textContent = 'Enter a direct HTTPS link ending in .mp4 or .webm, or upload your reference.'; }
};
$('video-url').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('load-link').click(); } };
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  Promise.resolve(context.registerTool({
    name: 'open_l3v_tool', title: 'Open an l3v AI tool',
    description: 'Show Magic Name or AI Video Suggestion in the workspace. Does not run analysis or upload files.',
    inputSchema: {type:'object', properties:{tool:{type:'string',enum:['logo','video']}}, required:['tool'], additionalProperties:false},
    annotations: {readOnlyHint:false,untrustedContentHint:false},
    execute(input) {
      if (!input || !['logo','video'].includes(input.tool)) throw new Error('Choose logo or video.');
      location.hash = input.tool; openTool(input.tool); return {tool:input.tool,opened:true};
    }
  }, {signal:lifecycle.signal})).catch(() => {});
  window.addEventListener('pagehide', () => lifecycle.abort(), {once:true});
}


