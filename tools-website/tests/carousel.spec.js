import {test, expect} from '@playwright/test';

test('carousel autoplays, pauses and keeps stable themed slides', async ({page}) => {
  await page.clock.install();
  await page.goto('/');
  const select = page.getByLabel('Choose a design');
  await expect(select).toHaveValue('0');
  await page.clock.fastForward(5100);
  await expect(select).toHaveValue('1');
  await page.getByRole('button', {name: 'Pause slideshow'}).click();
  await page.clock.fastForward(10000);
  await expect(select).toHaveValue('1');
  const viewport = page.locator('.concept-viewport');
  const initial = await viewport.boundingBox();
  for (let i = 0; i < 20; i++) {
    await select.selectOption(String(i));
    expect((await viewport.boundingBox()).height).toBe(initial.height);
  }
  await expect(viewport).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.concept-slide.is-active')).toHaveCSS('transition-duration', '0.65s');
  await page.locator('#mode-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(viewport).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('reduced motion disables automatic advancement', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.clock.install();
  await page.goto('/');
  await page.clock.fastForward(10000);
  await expect(page.getByLabel('Choose a design')).toHaveValue('0');
  await expect(page.locator('.concept-slide.is-active')).toHaveCSS('transition-duration', '0s');
});
