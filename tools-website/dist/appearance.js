(() => {
  const themes = window.L3V_THEMES;
  let selected = 'gold', mode = 'light';
  try {
    selected = localStorage.getItem('l3v-tools-theme') || selected;
    mode = localStorage.getItem('l3v-tools-mode') === 'dark' ? 'dark' : 'light';
  } catch {}
  const root = document.documentElement;
  const picker = document.getElementById('theme-picker');
  const options = document.getElementById('theme-options');
  function apply() {
    const theme = themes.find(t => t.id === selected) || themes.find(t => t.id === 'gold');
    selected = theme.id;
    const light = mode === 'light';
    const accent = light ? '#' + theme.accent.slice(1).match(/../g).map(x => Math.round(parseInt(x,16) * .46).toString(16).padStart(2,'0')).join('') : theme.accent;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    const values = {
      '--accent':accent, '--swatch':theme.accent,
      '--background':`hsl(${theme.hue} ${light ? '24% 97%' : '28% 5%'})`,
      '--panel':light ? '#fff' : `hsl(${theme.hue} 23% 9%)`,
      '--surface':`hsl(${theme.hue} ${light ? '20% 94%' : '20% 12%'})`,
      '--hover':`hsl(${theme.hue} ${light ? '23% 90%' : '23% 16%'})`,
      '--foreground':light ? '#1c2633' : '#f3eee4',
      '--muted':light ? '#516070' : '#a5a6ab',
      '--border':light ? '#20304026' : '#ffffff26'
    };
    for (const [key,value] of Object.entries(values)) root.style.setProperty(key,value);
    document.getElementById('theme-name').textContent = theme.name;
    document.getElementById('mode-toggle').setAttribute('aria-checked',String(light));
    options.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.theme === selected)));
    try { localStorage.setItem('l3v-tools-theme',selected); localStorage.setItem('l3v-tools-mode',mode); } catch {}
  }
  for (const theme of themes) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.theme = theme.id;
    button.setAttribute('aria-label',theme.name);
    const dot = document.createElement('span'); dot.style.background = theme.accent; dot.className = 'palette-dot'; dot.setAttribute('aria-hidden','true');
    button.append(dot,document.createTextNode(theme.name));
    button.addEventListener('click',() => { selected = theme.id; apply(); });
    options.append(button);
  }
  document.getElementById('mode-toggle').onclick = () => { mode = mode === 'light' ? 'dark' : 'light'; apply(); };
  document.addEventListener('click',event => { if (!picker.contains(event.target)) picker.open = false; });
  document.addEventListener('keydown',event => { if (event.key === 'Escape' && picker.open) { picker.open = false; picker.querySelector('summary').focus(); } });
  apply();
})();
