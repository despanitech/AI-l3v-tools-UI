import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequest,savedRequest,headers} from './src/lib/name-logo-request.mjs';
test('save before admission and recover identical access after reload',async()=>{const values=new Map();globalThis.sessionStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};const current=await createRequest('Natia','Odisharia','hard-angular');assert.deepEqual(savedRequest(),current);assert.equal(headers(current)['X-L3V-Request-Receipt'],current.access.receipt);assert.match(current.access.receipt,/^[a-f0-9]{64}$/)});
test('storage failure blocks creation',async()=>{globalThis.sessionStorage={setItem:()=>{throw Error('blocked')}};await assert.rejects(createRequest('Natia','Odisharia','hard-angular'));});
