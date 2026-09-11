const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export const normalizeInvitationPhrase=value=>value.trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ');
export async function invitationAccount(request,env={}){
  const credential=(request.headers.get('X-L3V-Invitation')||'').trim();
  if(credential.length<3||credential.length>180)return null;
  const tokenHash=await digest(credential);
  const allowed=new Set((env.INVITATION_HASHES||'').split(',').filter(x=>/^[a-f0-9]{64}$/.test(x)));
  if(/^[A-Za-z0-9_-]{43}$/.test(credential)&&allowed.has(tokenHash))return tokenHash;
  const aliases=new Map((env.INVITATION_ALIASES||'').split(',').map(x=>x.split('=')).filter(([alias,account])=>/^[a-f0-9]{64}$/.test(alias||'')&&/^[a-f0-9]{64}$/.test(account||'')));
  return aliases.get(await digest(normalizeInvitationPhrase(credential)))||null;
}
