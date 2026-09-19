// Pure data about the real-world application templates: which exist, how
// they are grouped, and where their demo images live. No React,
// no images imported, so the Worker's dev/uat simulator can use it too.

export const applicationGroups = [
  'Personal & accessories',
  'Apparel',
  'Stationery & office',
  'Packaging & products',
  'Spaces & signage',
  'Outdoor & large format',
];

export const applicationSubjects = [
  {id:'upper-arm-tattoo',name:'Upper-arm tattoo',group:'Personal & accessories'},
  {id:'canvas-tote',name:'Canvas tote',group:'Personal & accessories'},
  {id:'backpack',name:'Backpack',group:'Personal & accessories'},
  {id:'baseball-cap',name:'Baseball cap',group:'Personal & accessories'},
  {id:'beanie',name:'Beanie',group:'Personal & accessories'},
  {id:'leather-wallet',name:'Leather wallet',group:'Personal & accessories'},
  {id:'phone-case',name:'Phone case',group:'Personal & accessories'},
  {id:'keychain',name:'Keychain',group:'Personal & accessories'},
  {id:'luggage-tag',name:'Luggage tag',group:'Personal & accessories'},
  {id:'travel-luggage',name:'Travel luggage',group:'Personal & accessories'},
  {id:'t-shirt',name:'T-shirt',group:'Apparel'},
  {id:'hoodie',name:'Hoodie',group:'Apparel'},
  {id:'polo-shirt',name:'Polo shirt',group:'Apparel'},
  {id:'denim-jacket',name:'Denim jacket',group:'Apparel'},
  {id:'sports-jersey',name:'Sports jersey',group:'Apparel'},
  {id:'apron',name:'Apron',group:'Apparel'},
  {id:'socks',name:'Socks',group:'Apparel'},
  {id:'sneakers',name:'Sneakers',group:'Apparel'},
  {id:'scarf',name:'Scarf',group:'Apparel'},
  {id:'workwear-patch',name:'Workwear patch',group:'Apparel'},
  {id:'business-card',name:'Business card',group:'Stationery & office'},
  {id:'letterhead',name:'Letterhead',group:'Stationery & office'},
  {id:'envelope',name:'Envelope',group:'Stationery & office'},
  {id:'notebook',name:'Notebook',group:'Stationery & office'},
  {id:'fountain-pen',name:'Fountain pen',group:'Stationery & office'},
  {id:'presentation-folder',name:'Presentation folder',group:'Stationery & office'},
  {id:'desk-nameplate',name:'Desk nameplate',group:'Stationery & office'},
  {id:'wax-seal',name:'Wax seal',group:'Stationery & office'},
  {id:'rubber-stamp',name:'Rubber stamp',group:'Stationery & office'},
  {id:'shipping-label',name:'Shipping label',group:'Stationery & office'},
  {id:'perfume-bottle',name:'Perfume bottle',group:'Packaging & products'},
  {id:'candle-jar',name:'Candle jar',group:'Packaging & products'},
  {id:'coffee-cup',name:'Coffee cup',group:'Packaging & products'},
  {id:'wine-bottle',name:'Wine bottle',group:'Packaging & products'},
  {id:'skincare-bottle',name:'Skincare bottle',group:'Packaging & products'},
  {id:'soap-box',name:'Soap box',group:'Packaging & products'},
  {id:'jewelry-box',name:'Jewelry box',group:'Packaging & products'},
  {id:'shopping-bag',name:'Shopping bag',group:'Packaging & products'},
  {id:'product-box',name:'Product box',group:'Packaging & products'},
  {id:'mailing-box',name:'Mailing box',group:'Packaging & products'},
  {id:'storefront-sign',name:'Storefront sign',group:'Spaces & signage'},
  {id:'office-wall',name:'Office wall',group:'Spaces & signage'},
  {id:'reception-desk',name:'Reception desk',group:'Spaces & signage'},
  {id:'cafe-menu',name:'Cafe menu',group:'Spaces & signage'},
  {id:'restaurant-awning',name:'Restaurant awning',group:'Spaces & signage'},
  {id:'vehicle-door',name:'Vehicle door',group:'Spaces & signage'},
  {id:'delivery-van',name:'Delivery van',group:'Spaces & signage'},
  {id:'event-banner',name:'Event banner',group:'Spaces & signage'},
  {id:'hotel-room-key',name:'Hotel room key',group:'Spaces & signage'},
  {id:'book-cover',name:'Book cover',group:'Spaces & signage'},
  {id:'hot-air-balloon',name:'Hot-air balloon',group:'Outdoor & large format'},
  {id:'building-facade',name:'Building facade',group:'Outdoor & large format'},
  {id:'rooftop-sign',name:'Rooftop sign',group:'Outdoor & large format'},
  {id:'storefront-lettering',name:'Storefront name',group:'Outdoor & large format'},
  {id:'shop-window-decal',name:'Shop-window decal',group:'Outdoor & large format'},
  {id:'street-banner',name:'Street banner',group:'Outdoor & large format'},
  {id:'lamp-post-banner',name:'Lamp-post banner',group:'Outdoor & large format'},
  {id:'event-backdrop',name:'Event backdrop',group:'Outdoor & large format'},
  {id:'festival-stage',name:'Festival stage',group:'Outdoor & large format'},
  {id:'event-tent',name:'Event tent',group:'Outdoor & large format'},
  {id:'trade-show-booth',name:'Trade-show booth',group:'Outdoor & large format'},
  {id:'market-stall',name:'Market stall',group:'Outdoor & large format'},
  {id:'sidewalk-sign',name:'Sidewalk sign',group:'Outdoor & large format'},
  {id:'wayfinding-sign',name:'Wayfinding sign',group:'Outdoor & large format'},
  {id:'park-kiosk',name:'Park kiosk',group:'Outdoor & large format'},
  {id:'beach-flag',name:'Beach flag',group:'Outdoor & large format'},
  {id:'cafe-umbrella',name:'Cafe umbrella',group:'Outdoor & large format'},
  {id:'stadium-screen',name:'Stadium screen',group:'Outdoor & large format'},
  {id:'sports-field-banner',name:'Sports-field banner',group:'Outdoor & large format'},
  {id:'construction-hoarding',name:'Construction hoarding',group:'Outdoor & large format'},
  {id:'city-bus',name:'City bus',group:'Outdoor & large format'},
  {id:'tram',name:'Modern tram',group:'Outdoor & large format'},
  {id:'food-truck',name:'Food truck',group:'Outdoor & large format'},
  {id:'boat-sail',name:'Boat sail',group:'Outdoor & large format'},
  {id:'bicycle-delivery-box',name:'Bicycle delivery box',group:'Outdoor & large format'},
];

import demoManifest from './demo-manifest.json' with {type: 'json'};

// The demo identity every visitor sees before generating: its name is in the
// manifest, so every "demo" label on the site follows the data.
export const demoIdentityName = demoManifest.name || 'Demo';

// A demo of one product carrying one artwork type, generated with the real
// pipeline. When the library holds that product in the chosen style, that
// image is used; otherwise the mode's default style.
const DEMO_MODES = ['logo', 'initials', 'signature'];
export function demoPreviewImage(subject, mode, styleId) {
  if (!subject?.id) return null;
  // With no mode (a placeholder tile before the artwork is known) try each, so
  // a pending or failed tile still shows a sample of that product.
  for (const m of (mode ? [mode] : DEMO_MODES)) {
    const styled = styleId && demoManifest.byStyle?.[m]?.[styleId];
    if (Array.isArray(styled) && styled.includes(subject.id)) return `/assets/identity-subjects/demo/${m}/${styleId}/${subject.id}.jpg`;
    const list = demoManifest[m];
    if (Array.isArray(list) && list.includes(subject.id)) return `/assets/identity-subjects/demo/${m}/${subject.id}.jpg`;
  }
  return null;
}

// Falls back to another product of the same group in the same artwork, so a
// product added before its demo exists never leaves a tile blank.
export function applicationPreviewImage(subject, mode, styleId){
  const demo = demoPreviewImage(subject, mode, styleId);
  if (demo) return demo;
  const sibling = applicationSubjects.find(item => item.group === subject.group && demoPreviewImage(item, mode));
  return sibling ? demoPreviewImage(sibling, mode) : null;
}

// The l3v Dvalo sample clips, if the manifest carries any, each with the
// product's display name. Empty until a video run has been imported.
export function demoClips() {
  return (Array.isArray(demoManifest.clips) ? demoManifest.clips : []).map(clip => ({
    ...clip,
    name: applicationSubjects.find(subject => subject.id === clip.template)?.name || clip.template.replace(/-/g, ' '),
  }));
}
