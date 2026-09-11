import {test, expect} from '@playwright/test';

test('sample results keep the example identity separate from user input', async ({page}) => {
  await page.goto('/#logo');
  await page.locator('#first-name').fill('Natia');
  await page.locator('#last-name').fill('Odisharia');
  await page.getByRole('button', {name: 'Explore sample results'}).click();
  const results = page.getByRole('region', {name: 'Sample results'});
  await expect(results.getByRole('heading', {name: 'Evan Hart'})).toBeVisible();
  await expect(results).toContainText('not designs generated from your name');
  await results.getByRole('button', {name: 'Magic Signature', exact: true}).click();
  await expect(results.getByRole('img', {name: 'E. Hart — Bold Autograph sample'})).toBeVisible();
  await expect(results.getByRole('link', {name: 'Download sample'})).toHaveAttribute('download', 'evan-hart-signature-sample.png');
  await results.getByRole('button', {name: 'Back to your name'}).click();
  await expect(page.locator('#first-name')).toHaveValue('Natia');
  await expect(page.locator('#last-name')).toHaveValue('Odisharia');
});

test('results fit a mobile viewport', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#logo');
  await page.getByRole('button', {name:'Explore sample results'}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('link', {name:'Download sample'})).toBeVisible();
});
