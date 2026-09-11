import {test, expect} from '@playwright/test';
import fs from 'node:fs';
const image = fs.readFileSync(new URL('../public/assets/favicon.png', import.meta.url));
const imageFile = {name: 'reference.png', mimeType: 'image/png', buffer: image};
const pricing = JSON.parse(fs.readFileSync(new URL('../public/pricing.json', import.meta.url)));
const modelId = pricing.rates[0].modelId;

test('routing, three names, keyboard tabs and persisted identity', async ({page}) => {
  await page.goto('/');
  await page.getByRole('link', {name: 'Magic Identity', exact: true}).click();
  await page.getByLabel('First name', {exact: true}).fill('Evan');
  await page.getByLabel('Last name', {exact: true}).fill('Hart');
  await expect(page.locator('#sample-name')).toHaveText('Evan');
  await expect(page.locator('#sample-initials')).toHaveText('E.H.');
  await page.locator('#direction-name').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#direction-signature')).toBeFocused();
  await expect(page.locator('#direction-text')).toHaveText('Text to use: E. Hart');
  await page.goto('/#initials');
  await expect(page.locator('#direction-initials')).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByLabel('First name', {exact: true})).toHaveValue('Evan');
  await expect(page).toHaveTitle('Magic Initials · l3v AI tools');
});

test('themes and light/dark persist, theme picker closes with Escape', async ({page}) => {
  await page.goto('/');
  await page.locator('#theme-picker summary').click();
  await expect(page.locator('#theme-options button')).toHaveCount(60);
  await page.locator('#theme-options button').filter({hasText: 'Fern'}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#theme-picker')).not.toHaveAttribute('open');
  await page.getByRole('switch', {name: 'Light appearance'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.reload();
  await expect(page.locator('#theme-name')).toHaveText('Fern');
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

test('upload previews stay local, removal and invalid sources', async ({page}) => {
  const calls = [];
  page.on('request', req => { if (req.url().includes('/api/analyze')) calls.push(req); });
  await page.goto('/#video');
  await page.getByLabel('Choose a reference image').setInputFiles(imageFile);
  await expect(page.getByAltText('Your reference image')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Analyze reference'})).toBeDisabled();
  await page.getByRole('button', {name: 'Remove', exact: true}).click();
  await expect(page.locator('#reference')).toHaveCount(0);
  await page.getByLabel('Choose a reference image').setInputFiles({name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('bad')});
  await expect(page.locator('#status')).toContainText('Choose a JPG');
  await page.getByRole('tab', {name: 'Facebook Reel URL'}).click();
  await page.getByRole('textbox', {name: 'Facebook Reel URL', exact: true}).fill('javascript:alert(1)');
  await page.getByRole('button', {name: 'Add link', exact: true}).click();
  await expect(page.locator('#status')).toContainText('Facebook Reel URL');
  expect(calls).toHaveLength(0);
});

test('name text is escaped and small screens do not overflow', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/#logo');
  await page.getByLabel('First name', {exact: true}).fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#sample-name')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#sample-name img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({path: 'test-results/identity-mobile.png', fullPage: true});
});

async function enabledService(page) {
  await page.route('**/integration-config.js', route => route.fulfill({contentType: 'text/javascript', body: 'window.L3V_API={enabled:true};'}));
  await page.route('**/api/analyzer/config', route => route.fulfill({json: {enabled: true, sitekey: 'test-key', newScenePlanner: true, videoGeneration: true, videoMaxCredits: 100}}));
  await page.route('https://challenges.cloudflare.com/**', route => route.fulfill({contentType: 'text/javascript', body: 'window.turnstile={render(el,opts){queueMicrotask(()=>opts.callback("test-token"));return "test";},remove(){}};'}));
}
test('enabled API: analysis, price controls and one first-frame request', async ({page}) => {
  await enabledService(page);
  let analyses = 0, frames = 0;
  await page.route('**/api/analyze', route => { analyses++; return route.fulfill({json: {report: {summary: 'A soft landscape', models: [{id: modelId, reason: 'Camera motion'}], prompt: 'Create a quiet scene', workflow: ['Choose a model']}, frameTicket: 'a'.repeat(32)}}); });
  await page.route('**/api/first-frame', route => { frames++; return route.fulfill({json: {job: {id: 'b'.repeat(32), status: 'succeeded'}, image: 'data:image/png;base64,' + image.toString('base64'), motionPrompt: 'Slow pan'}}); });
  await page.goto('/#video');
  await page.getByLabel('Choose a reference image').setInputFiles(imageFile);
  await page.getByRole('button', {name: 'Analyze reference'}).click();
  await expect(page.getByRole('heading', {name: 'Your video direction'})).toBeVisible();
  await expect(page.locator('.result-stage')).toHaveCount(3);
  await expect(page.getByRole('heading', {name: 'Generate video'})).toBeVisible();
  await page.getByRole('button', {name: 'Review details'}).click();
  await expect(page.getByRole('dialog', {name: 'Review details'})).toBeVisible();
  await expect(page.getByLabel('Provider and configuration')).toBeVisible();
  await page.getByLabel('Takes', {exact: true}).fill('2');
  await expect(page.locator('#analysis-result')).toContainText('USD estimated total');
  await page.getByRole('button', {name: 'Close', exact: true}).click();
  await page.getByRole('button', {name: 'Create a first frame'}).click();
  await expect(page.getByAltText('Generated first frame for a new scene')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Generate video'})).toBeVisible();
  expect(analyses).toBe(1); expect(frames).toBe(1);
  await page.screenshot({path: 'test-results/video-result.png', fullPage: true});
});

test('changing a reference discards a pending analysis', async ({page}) => {
  await enabledService(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/analyze', async route => { await gate; await route.fulfill({json: {report: {summary: 'Stale result', models: [], prompt: 'Old'}}}).catch(() => {}); });
  await page.goto('/#video');
  await page.getByLabel('Choose a reference image').setInputFiles(imageFile);
  await page.getByRole('button', {name: 'Analyze reference'}).click();
  await expect(page.locator('#status')).toContainText('Submitting');
  await page.getByRole('button', {name: 'Remove', exact: true}).click();
  release();
  await expect(page.locator('#analysis-result')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Analyze reference'})).toBeDisabled();
});

test('blocked receipt storage stops analysis before network submission', async ({page}) => {
  await enabledService(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('l3v-video-request-v1:')) throw new Error('Storage blocked');
      return original.call(this, key, value);
    };
  });
  let calls = 0;
  await page.route('**/api/analyze', route => {calls++;return route.abort();});
  await page.goto('/#video');
  await page.getByLabel('Choose a reference image').setInputFiles(imageFile);
  await page.getByRole('button', {name:'Analyze reference'}).click();
  await expect(page.locator('#status')).toContainText('Nothing new was submitted');
  expect(calls).toBe(0);
});

test('lost analysis response retains the receipt for manual recovery', async ({page}) => {
  await enabledService(page);
  const roots=[];
  await page.route('**/api/analyze', route => {
    roots.push(route.request().headers()['x-l3v-request-id']);
    if (roots.length===1) return route.abort();
    return route.fulfill({json:{job:{id:'d'.repeat(32),status:'succeeded'},report:{summary:'Recovered analysis',models:[],prompt:'Pan slowly'}}});
  });
  await page.goto('/#video');
  await page.getByLabel('Choose a reference image').setInputFiles(imageFile);
  await page.getByRole('button', {name:'Analyze reference'}).click();
  await expect(page.getByRole('button', {name:'Analyze reference'})).toBeEnabled();
  expect(roots).toHaveLength(1);
  await page.getByRole('button', {name:'Analyze reference'}).click();
  await expect(page.locator('#analysis-result')).toContainText('Recovered analysis');
  expect(roots).toHaveLength(2);expect(roots[0]).toBe(roots[1]);
});

test('public hostname never connects to local editor and desktop layout renders', async ({page}) => {
  const localCalls = [];
  page.on('request', req => { if (req.url().includes('/api/logo-status') || req.url().includes(':4184')) localCalls.push(req.url()); });
  await page.route('https://tools.test/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({url: 'http://127.0.0.1:4195' + url.pathname});
    await route.fulfill({response});
  });
  await page.goto('https://tools.test/#logo');
  await page.getByLabel('First name', {exact: true}).fill('Evan');
  await page.getByLabel('Last name', {exact: true}).fill('Hart');
  await expect(page.locator('#logo-frame')).toHaveCount(0);
  await expect(page.getByRole('link', {name: 'Open full window'})).toHaveCount(0);
  expect(localCalls).toHaveLength(0);
  await page.getByRole('heading', {name: 'Make it your own.'}).click();
  await page.screenshot({path: 'test-results/identity-desktop.png', fullPage: true});
});
