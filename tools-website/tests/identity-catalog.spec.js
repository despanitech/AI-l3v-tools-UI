import {test,expect} from '@playwright/test';
import previews from '../src/lib/style-previews.json' with {type:'json'};
test('individual gallery samples, carousel, defaults and ink',async({page})=>{
 await page.route('**/api/name-logo/catalog',r=>r.fulfill({json:{enabled:true,styles:previews.map(p=>({...p,name:p.id}))}}));
 await page.goto('/#logo');await page.locator('#first-name').fill('Evan');await page.locator('#last-name').fill('Hart');await page.getByRole('button',{name:'Continue →'}).click();
 for(const [mode,n] of [['Name logo',5],['Initials',37],['Signature',35]]){
  await page.locator('.workspace-rail button').filter({hasText:mode}).click();
  await page.getByRole('button',{name:'Change style',exact:true}).click();
  await expect(page.locator('.style-gallery-items button')).toHaveCount(n);
  await page.locator('.style-gallery-items button').last().click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Next style',exact:true}).click();
  await expect(page.locator('.gallery-dots button').first()).toHaveAttribute('aria-pressed','true');
 }
 await page.getByLabel('Preview ink color').fill('#a02030');
 await expect.poll(()=>page.locator('.workspace-art canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(d[i+3]>200)return [d[i],d[i+1],d[i+2]].join(',');return ''})).toBe('160,32,48');
 await page.getByRole('button',{name:'Edit name'}).click();await expect(page.locator('#first-name')).toHaveValue('Evan');
});
