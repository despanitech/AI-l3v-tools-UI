import {test} from 'node:test';import assert from 'node:assert/strict';import {issueInvitation} from './invitation-issuer.mjs';
const request=secret=>new Request('https://tools.l3v.ai/api/admin/invitations',{method:'POST',headers:secret?{Authorization:`Bearer ${secret}`}:{}});
test('issuer hides itself without its private bearer secret',async()=>{
 const kv={get:async()=>null,put:async()=>assert.fail('must not write')};
 assert.equal((await issueInvitation(request(),{INVITATIONS:kv,INVITATION_ISSUER_SECRET:'private'})).status,404);
 assert.equal((await issueInvitation(request('wrong'),{INVITATIONS:kv,INVITATION_ISSUER_SECRET:'private'})).status,404);
});
test('issuer returns one-time card data and stores only hashed lookups',async()=>{
 const records=new Map(),kv={get:async key=>records.get(key)??null,put:async(key,value)=>records.set(key,value)};
 const response=await issueInvitation(request('private'),{INVITATIONS:kv,INVITATION_ISSUER_SECRET:'private'}),data=await response.json();
 assert.equal(response.status,200);assert.match(data.token,/^[A-Za-z0-9_-]{43}$/);assert.equal(data.phrase.split(' ').length,3);assert.match(data.accountId,/^[a-f0-9]{64}$/);
 assert.equal(records.get(`token:${data.accountId}`),data.accountId);assert.equal([...records.keys()].some(key=>key.includes(data.token)||key.includes(data.phrase)),false);
 assert.deepEqual(JSON.parse(data.qrPayload),{type:'l3v-access',version:1,token:data.token,phrase:data.phrase});
});
