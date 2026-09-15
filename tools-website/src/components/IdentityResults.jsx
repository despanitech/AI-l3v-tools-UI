import IdentityGenerationStage from './IdentityGenerationStage.jsx';

const designs=[
 {id:'sample-name',mode:'logo',styleName:'Diagonal Weave',styleId:'diagonal-weave',status:'succeeded',output:{}},
 {id:'sample-initials',mode:'initials',styleName:'Airy Ribbon',styleId:'airy-ribbon',status:'succeeded',output:{}},
 {id:'sample-signature',mode:'signature',styleName:'Bold Autograph',styleId:'bold-autograph',status:'succeeded',output:{}},
];
const assets={
 'sample-name':{png:'/assets/identity/magic-name.png'},
 'sample-initials':{png:'/assets/identity/magic-initials.png'},
 'sample-signature':{png:'/assets/identity/magic-signature.png'},
};

export default function IdentityResults({onBack,generating=false}){
 const buildStep=generating?Number(new URLSearchParams(location.search).get('buildStep'))||3:4;
 const previewingGeneration=generating&&buildStep===3;
 const shownDesigns=previewingGeneration?designs.map(design=>({...design,status:'running'})):designs;
 const shownAssets=previewingGeneration?{}:assets;
 return <section className={`identity-results${generating?'':' identity-results-demo'}`} aria-label={generating?'Generated identity results':'Example demo results'}>{!generating&&<div className="demo-alert-banner">EXAMPLE DEMO · SAMPLE ARTWORK</div>}<IdentityGenerationStage sample={!generating} request={{first:'Evan',last:'Hart',requestKey:'sample-preview'}} result={{designs:shownDesigns}} assets={shownAssets} busy={previewingGeneration} message={previewingGeneration?'All 3 jobs are running in parallel':'3 of 3 designs finished'} onReset={onBack}/>{!generating&&<div className="demo-alert-footer">EXAMPLE DEMO · THESE ARE NOT YOUR GENERATED DESIGNS</div>}</section>;
}
