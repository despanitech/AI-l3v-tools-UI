import {test,expect} from '@playwright/test';

// One delivered Studio identity as the account endpoint reports it: three
// designs, thirty previews, three clips. Images come from the demo set.
const REQUEST='a'.repeat(32),ACCOUNT='b'.repeat(64);
const templates=['apron','backpack','baseball-cap','beanie','business-card','candle-jar','coffee-cup','denim-jacket','hoodie','keychain','letterhead','luggage-tag','notebook','phone-case','polo-shirt','shopping-bag','sneakers','socks','storefront-sign','t-shirt','tram','wax-seal','wine-bottle','envelope','fountain-pen','city-bus','boat-sail','beach-flag','cafe-menu','food-truck'];
const base={request_id:REQUEST,scope:'name-logo',first:'John',last:'Smith',created:'2026-09-17T13:26:58Z',expires:'2026-09-24T13:26:58Z',job_status:'succeeded'};
const work=[
 ...['logo','initials','signature'].map((mode,i)=>({...base,resource_kind:'name-logo-job',resource_id:`d${i}`.padEnd(32,'0'),mode})),
 ...templates.map((template,i)=>({...base,resource_kind:'name-logo-visualization',resource_id:`p${i}x`.padEnd(32,'0'),template})),
 ...[0,1,2].map(i=>({...base,resource_kind:'identity-video',resource_id:`v${i}`.padEnd(32,'0')})),
];
const logos={d0:'public/review/john-smith-34/logo-04-hard-angular.png',d1:'public/review/john-smith-34/initials-01-heritage-ornament.png',d2:'public/review/john-smith-34/signature-01-executive-edge.png'};

test('my assets shows a card with a tile grid, then everything on open',async({page})=>{
 await page.addInitScript(([key,value])=>localStorage.setItem(key,value),['l3v-master-access-v1',JSON.stringify({credential:'test-invitation',accountId:ACCOUNT})]);
 await page.route('**/api/invitation/validate',r=>r.fulfill({json:{ok:true,accountId:ACCOUNT}}));
 await page.route('**/api/account/claim',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/api/account/work',r=>r.fulfill({json:{work}}));
 await page.route('**/api/name-logo/bundle-list',r=>r.fulfill({json:{bundles:[{requestId:REQUEST,count:33}]}}));
 await page.route(/\/api\/name-logo\/image\?id=/,r=>{const id=new URL(r.request().url()).searchParams.get('id').slice(0,2);r.fulfill({path:logos[id],contentType:'image/png'})});
 await page.route(/\/api\/name-logo\/visualization-image\?id=/,r=>{const id=new URL(r.request().url()).searchParams.get('id');const index=Number(id.match(/^p(\d+)x/)[1]);r.fulfill({path:`public/assets/identity-subjects/demo/logo/${templates[index]}.jpg`,contentType:'image/jpeg'})});
 await page.route('**/api/name-logo/visualization-video-status',r=>r.fulfill({json:{status:'succeeded',video:'/assets/identity-subjects/demo/clips/logo.mp4'}}));
 await page.route(/\/api\/(?!name-logo\/(image|visualization-image|visualization-video-status|bundle-list)|account\/|invitation\/)/,r=>r.fulfill({status:404,json:{error:'not mocked'}}));
 await page.setViewportSize({width:1200,height:900});
 await page.goto('/#assets');
 const card=page.locator('.asset-card').first();
 await expect(card.getByRole('heading',{name:'John Smith'})).toBeVisible();
 await expect(card).toContainText('3 designs · 30 real-world previews · 3 videos');
 await expect(card.getByRole('button',{name:'Download bundle (33)'})).toBeVisible();
 const tiles=card.locator('.asset-tile');
 await expect(tiles).toHaveCount(3+6+2+1);
 await expect(card.getByRole('button',{name:'Show all 36 items'})).toContainText('+25');
 await page.screenshot({path:'test-results/my-assets-card.png',fullPage:true});
 await card.getByRole('button',{name:'Show all 36 items'}).click();
 await expect(card.locator('.asset-grid.is-all .asset-tile')).toHaveCount(36);
 await expect(card.getByRole('button',{name:'Show less'})).toBeVisible();
 await page.screenshot({path:'test-results/my-assets-open.png',fullPage:true});
 await card.locator('.asset-tile.is-design button').first().click();
 await expect(page.getByRole('dialog',{name:'Name logo'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await page.keyboard.press('Escape');
 await page.screenshot({path:'test-results/my-assets-phone.png',fullPage:true});
});
