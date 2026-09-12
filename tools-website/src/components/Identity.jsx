import {useState} from 'react';
import IdentityResults from './IdentityResults.jsx';
import NameLogoGenerator from './NameLogoGenerator.jsx';
import DirectorPromo from './DirectorPromo.jsx';
export default function Identity({tool}) {
 const [first,setFirst]=useState(''),[last,setLast]=useState('');
 if(tool==='demo')return <section id="logo-panel"><IdentityResults onBack={()=>{location.hash='logo'}} /></section>;
 if(!['logo','initials','signature'].includes(tool))return null;
 return <section id="logo-panel" className="simple-name-entry" aria-label="Magic Identity"><NameLogoGenerator intro={<> <div className="entry-samples" aria-label="Design examples">{[["magic-name.png","Name logo",1254,1254],["magic-initials.png","Initials",1254,1254],["magic-signature.png","Signature",1774,887]].map(([file,label,w,h],i)=><figure key={file}><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label} example`}><defs><filter id={`entry-ink-${i}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="luminance"/><feComposite in="luminance" in2="SourceAlpha" operator="in" result="ink"/><feFlood floodColor="currentColor"/><feComposite operator="in" in2="ink"/></filter></defs><image href={`/assets/identity/${file}`} width={w} height={h} filter={`url(#entry-ink-${i})`}/></svg><figcaption>{label} · Sample</figcaption></figure>)}</div><h1>Create your name logo and initials</h1> </>} first={first} last={last} visible={true} onFirst={setFirst} onLast={setLast} /><DirectorPromo variant="identity"/></section>;
}


