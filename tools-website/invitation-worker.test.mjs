import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {invitationAccount,normalizeInvitationPhrase} from './invitation-worker.mjs';
test('valid token resolves only through private hash configuration',async()=>{const token='a'.repeat(43),hash=createHash('sha256').update(token).digest('hex'),request=new Request('https://tools.l3v.ai/api/invitation/validate',{headers:{'X-L3V-Invitation':token}});assert.equal(await invitationAccount(request,{INVITATION_HASHES:hash}),hash);assert.equal(await invitationAccount(request,{}),null)});
test('missing and malformed invitation tokens are rejected',async()=>{assert.equal(await invitationAccount(new Request('https://tools.l3v.ai/api/invitation/validate')),null);assert.equal(await invitationAccount(new Request('https://tools.l3v.ai/api/invitation/validate',{headers:{'X-L3V-Invitation':'not-a-token'}})),null)});
test('sentence and token resolve to the same account',async()=>{const token='b'.repeat(43),account=createHash('sha256').update(token).digest('hex'),phrase='The purple llama edits movies at midnight.',alias=createHash('sha256').update(normalizeInvitationPhrase(phrase)).digest('hex'),env={INVITATION_HASHES:account,INVITATION_ALIASES:`${alias}=${account}`},request=value=>new Request('https://tools.l3v.ai/api/invitation/validate',{headers:{'X-L3V-Invitation':value}});assert.equal(await invitationAccount(request(token),env),account);assert.equal(await invitationAccount(request('  THE purple llama edits   movies at midnight!  '),env),account)});
test('KV resolves tokens and normalized phrases without plaintext credentials',async()=>{
 const token='c'.repeat(43),phrase='cleft reactor headlock',account=createHash('sha256').update(token).digest('hex');
 const records=new Map([[`token:${account}`,account],[`phrase:${createHash('sha256').update(phrase).digest('hex')}`,account]]),env={INVITATIONS:{get:key=>records.get(key)??null}};
 const request=value=>new Request('https://tools.l3v.ai/api/invitation/validate',{headers:{'X-L3V-Invitation':value}});
 assert.equal(await invitationAccount(request(token),env),account);
 assert.equal(await invitationAccount(request(' CLEFT   reactor headlock! '),env),account);
 assert.equal(await invitationAccount(request('wrong three words'),env),null);
});
