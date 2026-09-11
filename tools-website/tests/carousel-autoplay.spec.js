import {test,expect} from '@playwright/test';
test('autoplay survives hover and focus; pause and play work',async({page})=>{
 await page.goto('/');
 const card=page.locator('.identity-carousel').first();
 await card.hover();
 await card.locator('.concept-viewport').focus();
 await expect(card.locator('.concept-count')).toHaveText('2 / 20',{timeout:7500});
 await card.getByRole('button',{name:'Pause slideshow'}).click();
 const count=await card.locator('.concept-count').textContent();
 await page.waitForTimeout(5300);
 await expect(card.locator('.concept-count')).toHaveText(count);
 await card.getByRole('button',{name:'Play slideshow'}).click();
 await expect(card.locator('.concept-count')).not.toHaveText(count,{timeout:7500});
});
