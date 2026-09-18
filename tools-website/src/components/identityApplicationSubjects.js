import {applicationGroups,applicationThumbnailStems,applicationSubjects,applicationPreviewImage,demoPreviewImage} from '../lib/application-templates.mjs';
export {applicationGroups,applicationThumbnailStems,applicationSubjects,applicationPreviewImage,demoPreviewImage};

// Category sheets. Nothing renders these yet -- they were previously read
// only to derive thumbnail filenames, which is what applicationThumbnailStems
// now does. The six sheet images ship but are currently unreferenced.
export const applicationPreviewSheets = {
  'Personal & accessories':'/assets/identity-subjects/branded/personal-john-smith.png',
  'Apparel':'/assets/identity-subjects/branded/apparel-john-smith.png',
  'Stationery & office':'/assets/identity-subjects/branded/office-john-smith.png',
  'Packaging & products':'/assets/identity-subjects/branded/products-john-smith.png',
  'Spaces & signage':'/assets/identity-subjects/branded/spaces-john-smith.png',
  'Outdoor & large format':'/assets/identity-subjects/branded/outdoor-john-smith.png',
};

export function applicationPreviewStyle(subject,mode){
  return {backgroundImage:`url(${applicationPreviewImage(subject,mode)})`,backgroundPosition:'center',backgroundSize:'cover'};
}

// Declared explicitly rather than derived from the sheet filename: two
// categories ship thumbnails under a different stem than their sheet
// ('Stationery & office' has an office sheet but stationery thumbnails,
// 'Packaging & products' a products sheet but packaging thumbnails).

export const selectionSubjects=applicationGroups.flatMap(group=>applicationSubjects.filter(item=>item.group===group).slice(0,5));

const compactInitials=new Set(['upper-arm-tattoo','baseball-cap','beanie','leather-wallet','phone-case','keychain','luggage-tag','socks','sneakers','workwear-patch','fountain-pen','wax-seal','rubber-stamp','hotel-room-key','bicycle-delivery-box']);
const personalSignature=new Set(['travel-luggage','business-card','letterhead','envelope','notebook','presentation-folder','desk-nameplate','perfume-bottle','wine-bottle','jewelry-box','book-cover','storefront-lettering']);
// `mode` overrides the subject's natural artwork so the demo label follows the
// artwork the buyer has chosen to apply.
export function applicationArtwork(subject,mode){
 const category=['logo','initials','signature'].includes(mode)?mode:compactInitials.has(subject.id)?'initials':personalSignature.has(subject.id)?'signature':'logo';
 const choices=exampleLibrary.filter(item=>item.category===category);
 const artwork=choices[stableNumber(`${subject.id}:${category}:john-smith-example`)%choices.length];
 return {mode:category,label:`${artwork.styleName} ${category==='logo'?'John name logo':category==='initials'?'JS initials':'John Smith signature'}`,src:artwork.src,styleId:artwork.styleId};
}

export const recommendedApplications = {
  free: ['upper-arm-tattoo','perfume-bottle'],
  creator: ['upper-arm-tattoo','canvas-tote','t-shirt','hoodie','business-card','letterhead','perfume-bottle','candle-jar','storefront-sign','office-wall'],
  // Fifteen across every group: the package is 15 images (2026-09-18).
  studio:['upper-arm-tattoo','canvas-tote','baseball-cap','t-shirt','hoodie','denim-jacket','business-card','letterhead','notebook','perfume-bottle','candle-jar','coffee-cup','storefront-sign','delivery-van','hot-air-balloon'],
};

const stableNumber=value=>Array.from(value).reduce((hash,char)=>((hash*33)^char.charCodeAt(0))>>>0,5381);

export function automaticApplicationPicks(designs=[]){
  return designs.flatMap((design,designIndex)=>{
    if(!/^[a-f0-9]{32}$/.test(design?.id))return [];
    // Five included previews: two for the first two designs, one for the third.
    const groups=[...applicationGroups]
      .sort((left,right)=>stableNumber(`${design.id}:${left}`)-stableNumber(`${design.id}:${right}`))
      .slice(0,designIndex>=2?1:2);
    return groups.map(group=>{
      const options=applicationSubjects.filter(item=>item.group===group);
      const subject=options[stableNumber(`${design.id}:${group}:subject`)%options.length];
      return {...subject,designId:design.id,designIndex};
    });
  });
}
import exampleLibrary from '../lib/identity-example-library.json';
