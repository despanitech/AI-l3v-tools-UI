import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {waitForJob,estimateRate,post} from './dist/api-client.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./dist/pricing.json',import.meta.url)));
test('catalog estimate respects provider duration, takes, and stale verification',()=>{
  const value=estimateRate(catalog,'runway-gen45-720-standard',5,3,Date.parse('2026-09-09T12:00Z'));
  assert.equal(value.perTake,'0.60');assert.equal(value.estimatedTotal,'1.80');assert.equal(value.stale,false);
  assert.equal(estimateRate(catalog,value.id,5,3,Date.parse('2026-09-20T12:00Z')).stale,true);
  assert.throws(()=>estimateRate(catalog,value.id,60,1));assert.throws(()=>estimateRate(catalog,value.id,5,0));
});
test('queued and running jobs return successful report with same job id',async()=>{
  const id='a'.repeat(32),states=[],responses=[{job:{id,status:'running'}},{job:{id,status:'succeeded'},report:{summary:'Result'}}];
  const transport=async(path,options)=>{assert.equal(path,'/api/jobs');assert.equal(JSON.parse(options.body).id,id);return Response.json(responses.shift());};
  const result=await waitForJob({job:{id,status:'queued'}},s=>states.push(s),new AbortController().signal,transport,async()=>{});
  assert.equal(states.length,2);assert.equal(result.report.summary,'Result');
});
test('ambiguous jobs stop without retrying the provider',async()=>{
  await assert.rejects(waitForJob({job:{id:'a'.repeat(32),status:'ambiguous'}},()=>{},new AbortController().signal,()=>{throw new Error('must not poll');}),/Do not resubmit/);
});
test('failed and expired jobs do not claim success',async()=>{
  for(const status of ['failed','expired','unknown']) await assert.rejects(waitForJob({job:{id:'a'.repeat(32),status}},()=>{},new AbortController().signal));
});
test('non-JSON or rejected service responses surface an error',async()=>{
  const signal=new AbortController().signal;
  await assert.rejects(post('/api/analyze',{},signal,async()=>new Response('<html>')),/unreadable/);
  await assert.rejects(post('/api/analyze',{},signal,async()=>Response.json({error:'Unavailable'},{status:503})),/Unavailable/);
});
