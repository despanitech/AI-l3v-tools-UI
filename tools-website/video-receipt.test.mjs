import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptForReference,receiptTransport,lastReceipt} from './src/lib/video-receipt.mjs';
const storage = () => {const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),map};};
const reference={kind:'image',image:'private-reference'};
const options=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('receipt persists before sending and same reference recovers the same root',async()=>{
  const store=storage(),record=await receiptForReference(reference,store);
  assert.match(record.access.requestId,/^[a-f0-9]{32}$/);assert.match(record.access.receipt,/^[a-f0-9]{64}$/);
  assert.deepEqual((await receiptForReference(reference,store)).access,record.access);
  assert.notEqual((await receiptForReference({...reference,image:'different'},store)).access.requestId,record.access.requestId);
  assert.ok(!JSON.stringify([...store.map.values()]).includes(reference.image));
});
test('blocked or silently failed persistence stops submission',async()=>{
  for(const store of [{getItem(){throw Error();},setItem(){}},{getItem(){return null;},setItem(){}}])
    await assert.rejects(receiptForReference(reference,store),/Nothing new was submitted/);
});
test('all followups use headers, never receipt in the body or URL',async()=>{
  const store=storage(),record=await receiptForReference(reference,store);
  for(const path of ['/api/analyze','/api/first-frame','/api/image-to-video','/api/jobs']) {
    const transport=receiptTransport(record,async(url,opts)=>{
      assert.equal(url,path);assert.equal(opts.headers.get('X-L3V-Request-Receipt'),record.access.receipt);
      assert.equal(opts.headers.get('X-L3V-Request-Id'),record.access.requestId);
      assert.ok(!opts.body.includes(record.access.receipt));
      return Response.json({job:{id:'c'.repeat(32),status:'queued'}});
    },store);
    await transport(path,options({token:'challenge',id:'c'.repeat(32)}));
  }
  assert.equal(lastReceipt(store).stages['/api/analyze'].jobId,'c'.repeat(32));
});
test('lost response retains admission and never automatically retries',async()=>{
  const store=storage(),record=await receiptForReference(reference,store);let calls=0;
  const transport=receiptTransport(record,async()=>{calls++;throw Error('network');},store);
  await assert.rejects(transport('/api/analyze',options({...reference,token:'one'})));
  assert.equal(calls,1);assert.ok(lastReceipt(store).stages['/api/analyze']);
  assert.deepEqual((await receiptForReference(reference,store)).access,record.access);
  await assert.rejects(transport('/api/analyze',options({...reference,token:'new'})));
  assert.equal(calls,2);
});
test('changed paid settings cannot silently become another submission',async()=>{
  const store=storage(),record=await receiptForReference(reference,store);let calls=0;
  const transport=receiptTransport(record,async()=>{calls++;return Response.json({job:{id:'c'.repeat(32),status:'queued'}});},store);
  await transport('/api/image-to-video',options({request:{duration:5,audio:false},token:'one'}));
  await assert.rejects(transport('/api/image-to-video',options({request:{duration:6,audio:false},token:'two'})));
  assert.equal(calls,1);assert.equal(lastReceipt(store).stages['/api/image-to-video'].settings.duration,5);
});
test('missing saved receipt and foreign destinations fail closed',async()=>{
  const store=storage(),record=await receiptForReference(reference,store);
  const transport=receiptTransport(record,()=>{throw Error('must not send');},store);
  await assert.rejects(transport('https://other.test/api/jobs',options({})));
  store.map.clear();await assert.rejects(transport('/api/jobs',options({id:'c'.repeat(32)})),/Nothing new was submitted/);
});
