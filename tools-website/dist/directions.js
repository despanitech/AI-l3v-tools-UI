(() => {
  const first=document.getElementById('first-name'),last=document.getElementById('last-name');
  const buttons=[...document.querySelectorAll('[data-direction]')];
  let direction='name';
  try{const saved=JSON.parse(localStorage.getItem('l3v-logo-names')||'{}');first.value=typeof saved.first==='string'?saved.first:'';last.value=typeof saved.last==='string'?saved.last:'';if(['name','initials','signature'].includes(saved.direction))direction=saved.direction;}catch{}
  const initial = value => [...value][0] || '';
  function update(){
    const f=first.value.trim(),l=last.value.trim(),example=!f&&!l;
    const firstText=example?'Nino':f,lastText=example?'Orbeliani':l;
    const values={name:firstText||'Add your first name',initials:firstText&&lastText?`${initial(firstText).toLocaleUpperCase()}.${initial(lastText).toLocaleUpperCase()}.`:'Add both names',signature:firstText&&lastText?`${initial(firstText).toLocaleUpperCase()}. ${lastText}`:'Add both names'};
    for(const button of buttons){const id=button.dataset.direction,active=id===direction;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;document.getElementById('sample-'+id).textContent=values[id];}
    document.getElementById('direction-preview').setAttribute('aria-labelledby','direction-'+direction);
    document.getElementById('direction-text').textContent=`${example?'Example text':'Text to use'}: ${values[direction]}`;
    try{localStorage.setItem('l3v-logo-names',JSON.stringify({first:first.value,last:last.value,direction}));}catch{}
  }
  first.addEventListener('input',update);last.addEventListener('input',update);
  buttons.forEach((button,index)=>{button.onclick=()=>{direction=button.dataset.direction;update();};button.onkeydown=event=>{let next;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();buttons[next].click();buttons[next].focus();};});
  document.addEventListener('l3v-direction',event=>{if(['name','initials','signature'].includes(event.detail)){direction=event.detail;update();}});
  if(location.hash==='#initials')direction='initials';
  if(location.hash==='#signature')direction='signature';
  update();
})();
