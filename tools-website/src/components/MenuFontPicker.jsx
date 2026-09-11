import {useEffect,useState} from 'react';
import {readStored,writeStored} from '../lib/storage.js';
export const menuFonts=['Exo 2','Rajdhani','Chakra Petch','Oxanium','Electrolize','Jura','Tomorrow','Tektur','Orbitron','Righteous','Audiowide'];
export default function MenuFontPicker(){
 const [font,setFont]=useState(()=>{const saved=readStored('menu-font','Exo 2');return menuFonts.includes(saved)?saved:'Exo 2'});
 useEffect(()=>{document.documentElement.style.setProperty('--menu-font',`"${font}",sans-serif`);writeStored('menu-font',font)},[font]);
 return <div className="font-trial"><label htmlFor="menu-font">Menu font</label><button aria-label="Previous menu font" onClick={()=>setFont(menuFonts[(menuFonts.indexOf(font)+menuFonts.length-1)%menuFonts.length])}>←</button><select id="menu-font" value={font} onChange={e=>setFont(e.target.value)}>{menuFonts.map((f,i)=><option key={f} value={f}>{i+1}. {f}</option>)}</select><button aria-label="Next menu font" onClick={()=>setFont(menuFonts[(menuFonts.indexOf(font)+1)%menuFonts.length])}>→</button></div>
}
