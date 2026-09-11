import {test,expect} from '@playwright/test';

test('a mocked response flow preserves submitted name and polls without duplicate generation',async({page})=>{
  let submits=0;
  await page.addInitScript(()=>{window.turnstile={render:(el,options)=>{setTimeout(()=>options.callback('test-token'),0);return 1},remove:()=>{}}});
  await page.route('**/api/name-logo/catalog',route=>route.fulfill({json:{enabled:true,sitekey:'test',styles:[{id:'hard-angular',name:'Diagonal Weave'}]}}));
  await page.route('**/api/name-logo/generate',route=>{submits++;expect(route.request().postDataJSON().first).toBe('Natia');return route.fulfill({json:{id:'a'.repeat(64)}})});
  await page.route('**/api/name-logo/status',route=>route.fulfill({json:{identity:{first:'Natia',last:'Odisharia'},designs:[{id:'b'.repeat(32),styleName:'Diagonal Weave',status:'succeeded',output:{width:1024,height:1024}}]}}));
  await page.route('**/api/name-logo/image?*',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')}));
  await page.goto('/#logo');
  await page.locator('#first-name').fill('Natia');await page.locator('#last-name').fill('Odisharia');
  await page.getByRole('button',{name:'Generate name logo',exact:true}).click();
  await expect(page.getByText('Your design is ready.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Download PNG'})).toHaveAttribute('href',/^blob:/);
  expect(submits).toBe(1);
});

test('lost admission response can replay same saved request after reload',async({page})=>{
 let submitted;
 await page.addInitScript(()=>{window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback('token'),0);return 1},remove:()=>{}}});
 await page.route('**/api/name-logo/catalog',r=>r.fulfill({json:{enabled:true,sitekey:'test',styles:[{id:'hard-angular',name:'Diagonal Weave'}]}}));
 await page.route('**/api/name-logo/generate',r=>{const req=r.request();if(!submitted){submitted={body:req.postDataJSON(),receipt:req.headers()['x-l3v-request-receipt']};return r.abort()}expect(req.headers()['x-l3v-request-receipt']).toBe(submitted.receipt);expect(req.postDataJSON().requestKey).toBe(submitted.body.requestKey);return r.fulfill({json:{id:'a'.repeat(64)}})});
 await page.route('**/api/name-logo/status',r=>r.fulfill({json:{designs:[{id:'b'.repeat(32),status:'ambiguous'}]}}));
 await page.goto('/#logo');await page.locator('#first-name').fill('Natia');await page.locator('#last-name').fill('Odisharia');await page.getByRole('button',{name:'Generate name logo',exact:true}).click();await expect(page.getByText(/Submission could not be confirmed/)).toBeVisible();await page.reload();await page.getByRole('button',{name:'Recover saved request'}).click();await expect(page.getByText(/result is uncertain/)).toBeVisible();
});
