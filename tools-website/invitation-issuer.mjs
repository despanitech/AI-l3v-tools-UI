import {invitationWords} from './invitation-words.mjs';

const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const token=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const phrase=()=>{const words=new Set();while(words.size<3)words.add(invitationWords[crypto.getRandomValues(new Uint32Array(1))[0]%invitationWords.length]);return [...words].join(' ')};
const authorized=async(request,secret)=>{
  const supplied=request.headers.get('Authorization')||'';
  if(!secret||!supplied.startsWith('Bearer '))return false;
  return await digest(supplied.slice(7))===await digest(secret);
};

export async function issueInvitation(request,env){
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
  if(!env.INVITATIONS||!await authorized(request,env.INVITATION_ISSUER_SECRET))return Response.json({error:'Not found'},{status:404});
  for(let attempt=0;attempt<12;attempt++){
    const credential=token(),accountId=await digest(credential),words=phrase(),phraseHash=await digest(words);
    if(await env.INVITATIONS.get(`phrase:${phraseHash}`)!==null)continue;
    const metadata=JSON.stringify({accountId,issuedAt:new Date().toISOString(),version:1});
    await Promise.all([
      env.INVITATIONS.put(`token:${accountId}`,accountId,{metadata:{kind:'token'}}),
      env.INVITATIONS.put(`phrase:${phraseHash}`,accountId,{metadata:{kind:'phrase'}}),
      env.INVITATIONS.put(`account:${accountId}`,metadata,{metadata:{kind:'account'}})
    ]);
    return Response.json({accountId,token:credential,phrase:words,qrPayload:JSON.stringify({type:'l3v-access',version:1,token:credential,phrase:words})},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  return Response.json({error:'Could not issue invitation'},{status:503});
}
