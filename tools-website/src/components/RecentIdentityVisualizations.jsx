import {useMemo} from 'react';

const sheets={
 gothic:'/assets/identity/showcase/gothic-roundel-placements.png',
 angular:'/assets/identity/showcase/angular-ribbon-placements.png',
 serif:'/assets/identity/showcase/serif-spine-placements.png',
 scale:'/assets/identity/showcase/angular-large-scale-placements.png'
};
const samples=[
 ['Hats and clothing','gothic',0],['Jewelry','gothic',1],['Perfume and packaging','gothic',2],['Tattoo','gothic',3],
 ['Backpacks and leather bags','angular',0],['Canvas totes','angular',1],['Mugs and tumblers','angular',2],['Transit advertising','angular',3],
 ['Notebooks and pens','serif',0],['Hang tags and keychains','serif',1],['Street posters and light boxes','serif',2],['Facades and billboards','serif',3],
 ['Storefront signs','scale',0],['Fabric banners','scale',1],['Cafe signs','scale',2],['Hot-air balloon','scale',3]
].map(([label,sheet,panel])=>({label,image:sheets[sheet],position:`${panel%2?100:0}% ${panel>1?100:0}%`}));

export default function RecentIdentityVisualizations(){
 const shown=useMemo(()=>samples.map((item,index)=>({item,order:crypto.getRandomValues(new Uint32Array(1))[0]+index})).sort((a,b)=>a.order-b.order).slice(0,8).map(x=>x.item),[]);
 return <aside className="identity-showcase" aria-label="Recent visualizations"><p className="eyebrow">RECENT VISUALIZATIONS</p><div className="identity-showcase-strip"><div className="identity-showcase-track">{[...shown,...shown].map((item,index)=><figure key={`${item.label}-${index}`}><div role="img" aria-label={`Generated initials on ${item.label.toLowerCase()}`} style={{backgroundImage:`url(${item.image})`,backgroundPosition:item.position}}/></figure>)}</div></div></aside>;
}
