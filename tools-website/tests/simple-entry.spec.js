import {test,expect} from '@playwright/test';
test('Try Now opens only entry; demo is a separate route',async({page})=>{
 await page.route('**/api/name-logo/catalog',r=>r.fulfill({json:{enabled:false,styles:[]}}));
 await page.goto('/');await page.getByRole('link',{name:'Try Now'}).click();
 await expect(page.getByLabel('Enter your first name')).toBeVisible();await expect(page.getByLabel('Enter your last name')).toBeVisible();await expect(page.getByRole('region',{name:'Sample results'})).toHaveCount(0);await expect(page.getByText('Style example')).toHaveCount(0);
 await page.goto('/#demo');await expect(page.getByRole('region',{name:'Sample results'})).toBeVisible();await expect(page.getByLabel('Enter your first name')).toHaveCount(0);
});
