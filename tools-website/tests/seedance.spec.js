import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const image=fs.readFileSync(new URL('../public/assets/favicon.png',import.meta.url));
for (const lostResponse of [false,true,'frame']) test(`Seedance retains one request through reload (lost response: ${lostResponse})`,async({page})=>{
  await page.route('**/integration-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.L3V_API={enabled:true};'}));
  await page.route('**/api/analyzer/config',r=>r.fulfill({json:{enabled:true,sitekey:'test',newScenePlanner:true,videoGeneration:true,videoMaxCredits:100}}));
  await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.turnstile={render(e,o){queueMicrotask(()=>o.callback("token"));return "widget";},remove(){}}'}));
  const receipts=[];page.on('request',r=>{if(/\/api\/(analyze|first-frame|image-to-video|jobs)$/.test(r.url()))receipts.push(r.headers());});
  await page.route('**/api/analyze',r=>r.fulfill({json:{job:{id:'a'.repeat(32),status:'succeeded'},report:{summary:'A quiet scene',models:[],prompt:'Pan slowly'},frameTicket:'a'.repeat(32)}}));
  let frameCalls=0;
  await page.route('**/api/first-frame',r=>{frameCalls++;if(lostResponse==='frame'&&frameCalls===1)return r.abort();return r.fulfill({json:{job:{id:'b'.repeat(32),status:'succeeded'},image:'data:image/png;base64,'+image.toString('base64'),motionPrompt:'Pan slowly'}});});
  let calls=0,body;
  await page.route('**/api/image-to-video',r=>{calls++;body=r.request().postDataJSON();if(lostResponse===true&&calls===1)return r.abort();return r.fulfill({json:{job:{id:'c'.repeat(32),status:'queued'}}});});
  await page.route('**/api/jobs',r=>{const id=r.request().postDataJSON().id;return r.fulfill({json:id==='a'.repeat(32)?{job:{id,status:'succeeded'},report:{summary:'A quiet scene',models:[],prompt:'Pan slowly'},frameTicket:id}:id==='b'.repeat(32)?{job:{id,status:'succeeded'},image:'data:image/png;base64,'+image.toString('base64'),motionPrompt:'Pan slowly'}:{job:{id,status:'succeeded'},video:'https://media.example/videos/test.mp4',model:'seedance2_5'}});});
  await page.route('https://media.example/**',r=>r.fulfill({status:200,contentType:'video/mp4',body:''}));
  await page.goto('/#video');
  await page.getByLabel('Choose a reference image').setInputFiles({name:'image.png',mimeType:'image/png',buffer:image});
  await page.getByRole('button',{name:'Get video suggestions'}).click();
  await page.getByRole('button',{name:'Create a first frame'}).click();
  if(lostResponse==='frame'){
    await expect(page.locator('#status')).toContainText('not be retried automatically');
    await page.reload();
    await page.getByRole('button',{name:'Check saved request',exact:true}).click();
    await page.getByRole('button',{name:'Recover first frame',exact:true}).click();
  }
  await expect(page.getByLabel('Duration (seconds)')).toHaveValue('5');
  await expect(page.getByRole('combobox', {name:'Resolution',exact:true})).toHaveValue('480p');
  await expect(page.getByLabel('Generate audio')).not.toBeChecked();
  await page.getByRole('button',{name:'Generate video',exact:true}).click();
  if(lostResponse===true){
    await expect(page.getByRole('button',{name:'Recover video request',exact:true})).toBeEnabled();
    await page.reload();
    await page.getByRole('button',{name:'Check saved request',exact:true}).click();
    await page.getByRole('button',{name:'Recover video request',exact:true}).click();
  }
  await expect(page.getByLabel('Generated Seedance video')).toHaveAttribute('src','https://media.example/videos/test.mp4');
  await expect(page.getByRole('button',{name:'Generate video',exact:true})).toBeDisabled();
  await page.reload();
  await page.getByRole('button',{name:'Check saved request',exact:true}).click();
  await page.getByRole('button',{name:'Check video status',exact:true}).click();
  await expect(page.getByLabel('Generated Seedance video')).toHaveAttribute('src','https://media.example/videos/test.mp4');
  expect(new Set(receipts.map(h=>h['x-l3v-request-id'])).size).toBe(1);
  expect(new Set(receipts.map(h=>h['x-l3v-request-receipt'])).size).toBe(1);
  expect(receipts[0]['x-l3v-request-receipt']).toMatch(/^[a-f0-9]{64}$/);
  expect(calls).toBe(lostResponse===true?2:1);expect(body.request.duration).toBe(5);expect(body.request.resolution).toBe('480p');expect(body.request.audio).toBe(false);expect(body.request.frameId).toBe('b'.repeat(32));
});
