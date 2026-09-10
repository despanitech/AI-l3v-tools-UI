import {useEffect, useRef, useState} from 'react';
import {themes} from '../themes.js';
import {readStored, writeStored} from '../lib/storage.js';

export default function Appearance() {
  const [selected, setSelected] = useState(() => readStored('l3v-tools-theme', 'gold'));
  const [mode, setMode] = useState(() => readStored('l3v-tools-mode', 'light') === 'dark' ? 'dark' : 'light');
  const picker = useRef(null);
  const theme = themes.find(item => item.id === selected) || themes.find(item => item.id === 'gold');
  useEffect(() => {
    const light = mode === 'light';
    const accent = light ? '#' + theme.accent.slice(1).match(/../g).map(x => Math.round(parseInt(x,16) * .46).toString(16).padStart(2,'0')).join('') : theme.accent;
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    const values = {
      '--accent': accent, '--swatch': theme.accent,
      '--background': `hsl(${theme.hue} ${light ? '24% 97%' : '28% 5%'})`,
      '--panel': light ? '#fff' : `hsl(${theme.hue} 23% 9%)`,
      '--surface': `hsl(${theme.hue} ${light ? '20% 94%' : '20% 12%'})`,
      '--hover': `hsl(${theme.hue} ${light ? '23% 90%' : '23% 16%'})`,
      '--foreground': light ? '#1c2633' : '#f3eee4', '--muted': light ? '#516070' : '#a5a6ab',
      '--border': light ? '#20304026' : '#ffffff26',
    };
    for (const [key, value] of Object.entries(values)) root.style.setProperty(key, value);
    writeStored('l3v-tools-theme', theme.id); writeStored('l3v-tools-mode', mode);
  }, [theme, mode]);
  useEffect(() => {
    const click = event => { if (picker.current && !picker.current.contains(event.target)) picker.current.open = false; };
    const escape = event => { if (event.key === 'Escape' && picker.current?.open) { picker.current.open = false; picker.current.querySelector('summary').focus(); } };
    document.addEventListener('click', click); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', escape); };
  }, []);
  return <div className="appearance">
    <details id="theme-picker" ref={picker}><summary><span className="theme-dot" aria-hidden="true" /><span id="theme-name">{theme.name}</span></summary>
      <div className="theme-menu"><p>Color theme</p><div id="theme-options" aria-label="Color themes">{themes.map(item => <button key={item.id} type="button" aria-label={item.name} aria-pressed={item.id === theme.id} onClick={() => setSelected(item.id)}><span className="palette-dot" aria-hidden="true" style={{background: item.accent}} />{item.name}</button>)}</div></div>
    </details>
    <div className="mode-control"><span>Dark</span><button id="mode-toggle" type="button" role="switch" aria-label="Light appearance" aria-checked={mode === 'light'} onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}><span /></button><span>Light</span></div>
  </div>;
}
