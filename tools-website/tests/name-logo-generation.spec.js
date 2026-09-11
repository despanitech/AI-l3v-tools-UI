import {test,expect} from '@playwright/test';

test('a real-response flow preserves submitted name and polls without duplicate generation',async({page})=>{
  let submits=0;
  await page.addInitScript(()=>{window.turnstile={render:(el,options)=>{setTimeout(()=>options.callback('test-token'),0);return 1},remove:()=>{}}});
  await page.route('**/api/name-logo/catalog',route=>route.fulfill({json:{enabled:true,sitekey:'test',styles:[{id:'hard-angular',name:'Diagonal Weave'}]}}));
  await page.route('**/api/name-logo/generate',route=>{submits++;expect(route.request().postDataJSON().first).toBe('Natia');return route.fulfill({json:{id:'a'.repeat(64)}})});
  await page.route('**/api/name-logo/status',route=>route.fulfill({json:{identity:{first:'Natia',last:'Odisharia'},designs:[{id:'b'.repeat(32),styleName:'Diagonal Weave',status:'succeeded',output:{width:1024,height:1024}}]}}));
  await page.route('**/api/name-logo/image?*',route=>route.abort());
  await page.goto('/#logo');
  await page.locator('#first-name').fill('Natia');await page.locator('#last-name').fill('Odisharia');
  await page.getByRole('button',{name:'Generate name logo',exact:true}).click();
  await expect(page.getByText('Your design is ready.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Download PNG'})).toHaveAttribute('href',/download=1/);
  expect(submits).toBe(1);
});
