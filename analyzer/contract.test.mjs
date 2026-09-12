import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReference,validateReport} from './contract.mjs';
test('reject chat text, SVG, oversized images and credential URLs',()=>{
 for(const input of [{message:'hello'},{kind:'image',image:'data:image/svg+xml;base64,abc'},{kind:'image',image:'x'.repeat(1500000)}])assert.throws(()=>validateReference(input));
 const jpeg='data:image/jpeg;base64,'+Buffer.from([255,216,255,...Array(110).fill(0)]).toString('base64');
 assert.throws(()=>validateReference({kind:'video',image:jpeg,sourceUrl:'https://user:pass@example.com/v.mp4'}));
 assert.equal(validateReference({kind:'image',image:jpeg}).kind,'image');
 assert.equal(validateReference({kind:'video',image:jpeg}).kind,'video');
});
test('reject invented models and malformed report fields',()=>{
 const report={summary:'A scene',models:[{id:'veo',reason:'Suitable'}],observations:['Daylight'],workflow:['Start from a still'],limitations:['Motion is unknown'],prompt:'Animate the scene'};
 assert.equal(validateReport(report,new Set(['veo'])).models[0].id,'veo');
 assert.throws(()=>validateReport(report,new Set(['kling3'])));
 assert.throws(()=>validateReport({...report,workflow:[]},new Set(['veo'])));
});
