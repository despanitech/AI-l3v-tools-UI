import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequest,savedRequest,headers} from './src/lib/name-logo-request.mjs';
const storage=()=>{const values=new Map();return {setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k)}};
test('save before admission and recover identical access after reload',async()=>{globalThis.localStorage=storage();globalThis.sessionStorage=storage();const current=await createRequest('Natia','Odisharia','hard-angular');assert.deepEqual(savedRequest(),current);assert.equal(headers(current)['X-L3V-Request-Receipt'],current.access.receipt);assert.match(current.access.receipt,/^[a-f0-9]{64}$/)});
test('blocked mobile persistent storage falls back to session storage',async()=>{globalThis.localStorage={setItem:()=>{throw Error('blocked')},getItem:()=>null};globalThis.sessionStorage=storage();const current=await createRequest('Natia','Odisharia','hard-angular');assert.deepEqual(savedRequest(),current)});
test('storage failure blocks creation',async()=>{globalThis.localStorage={setItem:()=>{throw Error('blocked')},getItem:()=>null};globalThis.sessionStorage={setItem:()=>{throw Error('blocked')},getItem:()=>null};await assert.rejects(createRequest('Natia','Odisharia','hard-angular'),/browser-storage-unavailable/)});

test('the ink colour rides with the request when it is a valid hex',async()=>{globalThis.localStorage=storage();globalThis.sessionStorage=storage();const green=await createRequest('Natia','Odisharia',[{mode:'logo',id:'hard-angular'}],'#3AA14A');assert.equal(green.ink,'#3aa14a');const none=await createRequest('Natia','Odisharia','hard-angular','green');assert.equal(none.ink,undefined)});
