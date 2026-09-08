import {copyFileSync,mkdirSync} from 'node:fs';
import './export-html.mjs';
mkdirSync('production/site',{recursive:true});
copyFileSync('public/ai-video-model-guide.html','production/site/index.html');
copyFileSync('public/ai-video-model-guide.html','production/site/ai-video-model-guide.html');
copyFileSync('public/favicon.svg','production/site/favicon.svg');
console.log('Prepared production static guide.');
