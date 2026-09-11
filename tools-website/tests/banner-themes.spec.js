import {test,expect} from '@playwright/test';
import {themes} from '../src/themes.js';

test('corrected banners inherit every theme in light and dark mode',async({page})=>{
  await page.setViewportSize({width:1280,height:850});
  await page.goto('/');
  const card=page.getByRole('article',{name:'Magic Identity design showcase'});
  await card.getByRole('button',{name:'Pause slideshow'}).click();
  for(let i=0;i<20;i++){
    await page.getByLabel('Choose a design').selectOption(String(i));
    await expect(card.locator('.concept-slide.is-active image')).toHaveAttribute('href',`/assets/identity-concepts/names-sheet-${Math.floor(i/5)+1}.png`);
  }
  for(const mode of ['light','dark']){
    if(mode==='dark')await page.locator('#mode-toggle').click();
    await page.locator('#theme-picker summary').click();
    for(const theme of themes){
      await page.getByRole('button',{name:theme.name,exact:true}).click();
      const colors=await card.locator('.concept-slide.is-active').evaluate(el=>({ink:getComputedStyle(el.querySelector('feFlood')).floodColor,foreground:getComputedStyle(el).color}));
      expect(colors.ink).toBe(colors.foreground);
      await expect(card.locator('.concept-viewport')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    }
    await page.locator('#theme-picker summary').click();
    await page.getByLabel('Choose a design').selectOption('14');
    await page.waitForTimeout(700);
    await page.screenshot({path:`../review/mixed-banners-${mode}.png`});
  }
});
