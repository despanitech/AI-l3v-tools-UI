export const applicationGroups = [
  'Personal & accessories',
  'Apparel',
  'Stationery & office',
  'Packaging & products',
  'Spaces & signage',
  'Outdoor & large format',
];

export const applicationPreviewSheets = {
  'Personal & accessories':'/assets/identity-subjects/branded/personal-john-smith.png',
  'Apparel':'/assets/identity-subjects/branded/apparel-john-smith.png',
  'Stationery & office':'/assets/identity-subjects/branded/office-john-smith.png',
  'Packaging & products':'/assets/identity-subjects/branded/products-john-smith.png',
  'Spaces & signage':'/assets/identity-subjects/branded/spaces-john-smith.png',
  'Outdoor & large format':'/assets/identity-subjects/branded/outdoor-john-smith.png',
};

export function applicationPreviewStyle(subject){
  return {backgroundImage:`url(${applicationPreviewImage(subject)})`,backgroundPosition:'center',backgroundSize:'cover'};
}

export function applicationPreviewImage(subject){
  const group=applicationSubjects.filter(item=>item.group===subject.group);
  const index=group.findIndex(item=>item.id===subject.id);
  const stem=applicationPreviewSheets[subject.group].split('/').pop().replace('.png','');
  return `/assets/identity-subjects/branded/${stem}-${(index%5)+1}.png`;
}

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

export const selectionSubjects=applicationGroups.flatMap(group=>applicationSubjects.filter(item=>item.group===group).slice(0,5));

const compactInitials=new Set(['upper-arm-tattoo','baseball-cap','beanie','leather-wallet','phone-case','keychain','luggage-tag','socks','sneakers','workwear-patch','fountain-pen','wax-seal','rubber-stamp','hotel-room-key','bicycle-delivery-box']);
const personalSignature=new Set(['travel-luggage','business-card','letterhead','envelope','notebook','presentation-folder','desk-nameplate','perfume-bottle','wine-bottle','jewelry-box','book-cover','storefront-lettering']);
export function applicationArtwork(subject){
 const category=compactInitials.has(subject.id)?'initials':personalSignature.has(subject.id)?'signature':'logo';
 const choices=exampleLibrary.filter(item=>item.category===category);
 const artwork=choices[stableNumber(`${subject.id}:${category}:john-smith-example`)%choices.length];
 return {mode:category,label:`${artwork.styleName} ${category==='logo'?'John name logo':category==='initials'?'JS initials':'John Smith signature'}`,src:artwork.src,styleId:artwork.styleId};
}

export const recommendedApplications = {
  free: ['upper-arm-tattoo','perfume-bottle'],
  creator: ['upper-arm-tattoo','canvas-tote','t-shirt','hoodie','business-card','letterhead','perfume-bottle','candle-jar','storefront-sign','office-wall'],
  studio: ['upper-arm-tattoo','canvas-tote','backpack','baseball-cap','beanie','t-shirt','hoodie','polo-shirt','denim-jacket','sports-jersey','business-card','letterhead','envelope','notebook','fountain-pen','perfume-bottle','candle-jar','coffee-cup','wine-bottle','skincare-bottle','storefront-sign','office-wall','reception-desk','cafe-menu','restaurant-awning'],
};

const stableNumber=value=>Array.from(value).reduce((hash,char)=>((hash*33)^char.charCodeAt(0))>>>0,5381);

export function automaticApplicationPicks(designs=[]){
  return designs.flatMap((design,designIndex)=>{
    if(!/^[a-f0-9]{32}$/.test(design?.id))return [];
    const groups=[...applicationGroups]
      .sort((left,right)=>stableNumber(`${design.id}:${left}`)-stableNumber(`${design.id}:${right}`))
      .slice(0,3);
    return groups.map(group=>{
      const options=applicationSubjects.filter(item=>item.group===group);
      const subject=options[stableNumber(`${design.id}:${group}:subject`)%options.length];
      return {...subject,designId:design.id,designIndex};
    });
  });
}
import exampleLibrary from '../lib/identity-example-library.json';
