const slugPattern=/^[A-Za-z0-9_-]{43}$/;
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const headers={
  'Cache-Control':'no-store, private',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
};

export async function invitationShare(request,env={}){
  const url=new URL(request.url),match=url.pathname.match(/^\/invite\/([A-Za-z0-9_-]{43})(\/certificate\.svg)?$/);
  if(request.method!=='GET'||!match||!slugPattern.test(match[1])||!env.INVITATIONS)return new Response('Not found',{status:404,headers});
  const svg=await env.INVITATIONS.get(`share:${match[1]}`);
  if(typeof svg!=='string'||!svg.startsWith('<svg'))return new Response('Not found',{status:404,headers});
  if(match[2])return new Response(svg,{headers:{...headers,'Content-Type':'image/svg+xml; charset=utf-8',...(url.searchParams.has('download')?{'Content-Disposition':'attachment; filename="l3v-private-invitation.svg"'}:{})}});
  const account=await env.INVITATIONS.get(`token:${await digest(match[1])}`);
  if(!/^[a-f0-9]{64}$/.test(account||''))return new Response('Not found',{status:404,headers});
  const access=JSON.stringify({credential:match[1],accountId:account}).replaceAll('<','\\u003c');
  const certificate=`${url.pathname}/certificate.svg`;
  const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your private l3v invitation</title><style>body{margin:0;padding:18px;background:#181915;color:#fff;font:14px system-ui;text-align:center}.actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-bottom:14px}button,a{border:1px solid #d8cc86;border-radius:7px;background:#f8f6ed;color:#171713;padding:10px 15px;font:inherit;cursor:pointer;text-decoration:none}.enter{background:#d8cc86;font-weight:700}img{display:block;width:min(1180px,100%);height:auto;margin:auto;border-radius:12px;background:#f8f6ed}#status{min-height:20px;margin:8px 0;color:#d8cc86}</style></head><body><div class="actions"><a class="enter" href="/">Enter private tools</a><button id="copy" type="button">Copy invitation link</button></div><div id="status" role="status">Your private invitation is active.</div><img src="${certificate}" alt="Private l3v invitation certificate"><script>localStorage.setItem('l3v-master-access-v1',JSON.stringify(${access}));document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);document.getElementById('status').textContent='Invitation link copied.'}catch{document.getElementById('status').textContent='Copy the address from your browser.'}}</script></body></html>`;
  return new Response(page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
}
