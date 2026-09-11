import {test,expect} from '@playwright/test';

test('all twenty artwork-only carousel designs render and adapt to the theme',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/');
  const card=page.getByRole('article',{name:'Magic Identity design showcase'});
  await expect(card.locator('.concept-slide')).toHaveCount(20);
  for(let i=0;i<20;i++){
    await page.getByLabel('Choose a design').selectOption(String(i));
    await expect(card.locator('.concept-slide.is-active image')).toHaveAttribute('href','/assets/identity-concepts/artwork-only-20.png');
  }
  await page.getByLabel('Choose a design').selectOption('0');
  await page.screenshot({path:'../review/artwork-carousel-home.png'});
  await page.locator('#mode-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-mode','dark');
  await page.screenshot({path:'../review/artwork-carousel-dark.png'});
  // Review gallery uses the actual SVG slide viewports and filters, not new artwork.
  await page.evaluate(()=>{
    const slides=[...document.querySelectorAll('[aria-label="Magic Identity design showcase"] .concept-slide')];
    const labels=[...document.querySelectorAll('select[aria-label="Choose a design"] option')].map(o=>o.textContent);
    const gallery=document.createElement('main');gallery.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px;background:#fff;color:#171717';
    slides.forEach((slide,i)=>{const tile=document.createElement('section');tile.style.cssText='border:1px solid #ddd;border-radius:8px;padding:12px';const svg=slide.cloneNode(true);svg.removeAttribute('class');svg.removeAttribute('aria-hidden');svg.style.cssText='display:block;width:100%;height:210px;color:#171717';tile.append(svg);const label=document.createElement('p');label.textContent=String(i+1).padStart(2,'0')+' · '+labels[i];label.style.cssText='margin:10px 0 0;font:14px Arial;text-align:center';tile.append(label);gallery.append(tile)});
    document.body.replaceChildren(gallery);
  });
  await page.screenshot({path:'../review/artwork-carousel-all-20.png',fullPage:true});
});
