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
  const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening l3v AI tools</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f6ed;color:#171713;font:16px system-ui}p{padding:24px}</style></head><body><p>Opening your private invitation…</p><script>localStorage.setItem('l3v-master-access-v1',JSON.stringify(${access}));location.replace('/');</script></body></html>`;
  return new Response(page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
}
