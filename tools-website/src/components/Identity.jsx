import {useState} from 'react';
import IdentityResults from './IdentityResults.jsx';
import NameLogoGenerator from './NameLogoGenerator.jsx';
export default function Identity({tool}) {
 const [first,setFirst]=useState(''),[last,setLast]=useState('');
 if(tool==='demo')return <section id="logo-panel"><IdentityResults onBack={()=>{location.hash='logo'}} /></section>;
 if(!['logo','initials','signature'].includes(tool))return null;
 return <section id="logo-panel" className="simple-name-entry" aria-label="Magic Identity"><h1>Create your name logo</h1><NameLogoGenerator first={first} last={last} visible={true} onFirst={setFirst} onLast={setLast} /></section>;
}
