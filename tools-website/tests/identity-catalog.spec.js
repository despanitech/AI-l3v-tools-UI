import {test,expect} from '@playwright/test';
test('catalog selection and vector editor',async({page})=>{
 await page.addInitScript(()=>window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback('token'),0);return 1},remove(){}});
 await page.route('**/api/name-logo/catalog',r=>r.fulfill({json:{enabled:true,sitekey:'test',styles:[{mode:'logo',id:'hard-angular',name:'Diagonal Weave'}]}}));
 let calls=0;await page.route('**/api/name-logo/generate',r=>{calls++;expect(r.request().postDataJSON().styles).toEqual([{mode:'logo',id:'hard-angular'}]);return r.fulfill({json:{id:'a'.repeat(64)}})});
 await page.route('**/api/name-logo/status',r=>r.fulfill({json:{designs:[{id:'b'.repeat(32),styleName:'Diagonal Weave',styleId:'hard-angular',status:'succeeded',output:{svg:true}}]}}));
 await page.route('**/api/name-logo/image?*',r=>r.fulfill({body:r.request().url().includes('format=svg')?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 L90 10 L50 90 Z"/></svg>':'image'}));
 await page.goto('/#logo');await page.locator('#first-name').fill('Natia');await page.locator('#last-name').fill('Odisharia');await page.getByRole('button',{name:/Diagonal Weave/}).click();await page.getByRole('button',{name:'Generate',exact:true}).click();await expect(page.getByText('1 of 1 designs finished')).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Check progress'}).click();await page.getByRole('button',{name:'Edit design'}).click();await expect(page.getByRole('region',{name:'SVG editor'})).toBeVisible();expect(calls).toBe(1);
 await page.getByLabel('Weight').fill('3');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByLabel('Weight')).toHaveValue('0');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download edited SVG'}).click();expect((await download).suggestedFilename()).toBe('edited-design.svg');
});
