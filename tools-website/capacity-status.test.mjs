import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchCapacityStatus} from './src/lib/capacity-status.mjs';

test('capacity request includes the active invitation credential',async()=>{
 const originalFetch=globalThis.fetch;
 const originalStorage=globalThis.localStorage;
 globalThis.localStorage={getItem:()=>JSON.stringify({credential:'three word secret',accountId:'a'.repeat(64)})};
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'/api/capacity-status');
  assert.equal(options.headers.Accept,'application/json');
  assert.equal(options.headers['X-L3V-Invitation'],'three word secret');
  return {ok:true,json:async()=>({queue:{running:0}})};
 };
 try{assert.deepEqual(await fetchCapacityStatus(),{queue:{running:0}})}finally{
  globalThis.fetch=originalFetch;
  globalThis.localStorage=originalStorage;
 }
});
