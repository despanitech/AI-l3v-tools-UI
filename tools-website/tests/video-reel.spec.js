import {test,expect} from '@playwright/test';

test('Reel lost response reuses canonical reference receipt after reload',async({page})=>{
  await page.route('**/api/analyzer/config',r=>r.fulfill({json:{enabled:true,sitekey:'test',reelAnalysis:true,newScenePlanner:false}}));
  await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.turnstile={render(e,o){queueMicrotask(()=>o.callback("token"));return "widget"},remove(){}}'}));
  let calls=0,receipt;
  await page.route('**/api/analyze',r=>{
    calls++;
    expect(r.request().postDataJSON()).toEqual({kind:'facebook-reel',sourceUrl:'https://www.facebook.com/reel/123',token:'token'});
    const current=r.request().headers()['x-l3v-request-receipt'];
    if(calls===1){receipt=current;return r.abort()}
    expect(current).toBe(receipt);
    return r.fulfill({json:{job:{id:'a'.repeat(32),status:'succeeded'},report:{summary:'Sampled visual frames',models:[],prompt:'A new scene'}}});
  });
  await page.goto('/#video');
  await page.getByRole('tab',{name:'Facebook Reel URL'}).click();
  await page.getByRole('textbox',{name:'Facebook Reel URL',exact:true}).fill('https://m.facebook.com/reels/123/?tracking=one');
  await page.getByRole('button',{name:'Add link'}).click();
  await page.getByRole('button',{name:'Analyze reference'}).click();
  await expect(page.locator('#status')).not.toHaveText('Submitting your reference…');
  await page.reload();
  expect(calls).toBe(1);
  await page.getByRole('tab',{name:'Facebook Reel URL'}).click();
  await page.getByRole('textbox',{name:'Facebook Reel URL',exact:true}).fill('https://www.facebook.com/reel/123');
  await page.getByRole('button',{name:'Add link'}).click();
  await page.getByRole('button',{name:'Analyze reference'}).click();
  await expect(page.getByText('Sampled visual frames')).toBeVisible();
  expect(calls).toBe(2);
});

test('disabled Reel gate cannot submit even with a valid link',async({page})=>{
  await page.route('**/api/analyzer/config',r=>r.fulfill({json:{enabled:true,sitekey:'test',reelAnalysis:false}}));
  await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.turnstile={render(e,o){o.callback("token");return 1},remove(){}}'}));
  await page.goto('/#video');await page.getByRole('tab',{name:'Facebook Reel URL'}).click();
  await page.getByRole('textbox',{name:'Facebook Reel URL',exact:true}).fill('https://facebook.com/reel/123');
  await page.getByRole('button',{name:'Add link'}).click();
  await expect(page.getByRole('button',{name:'Analyze reference'})).toBeDisabled();
});

