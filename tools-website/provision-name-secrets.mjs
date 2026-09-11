// Accept private configuration on stdin; never write it to disk or logs.
// Run from tools-website. Does not enable generation or change Video secrets.
import {spawn} from 'node:child_process';

const [wrangler]=process.argv.slice(2);
if(!wrangler)throw Error('Wrangler JavaScript path required');
let raw='';
for await(const chunk of process.stdin){raw+=chunk;if(raw.length>16384)throw Error('Configuration too large')}
let values;
try{values=JSON.parse(raw)}catch{throw Error('Private configuration must be JSON')}
const allowed=['NAME_LOGO_TOKEN','NAME_LOGO_SESSION_SECRET'];
if(!values || Array.isArray(values) || Object.keys(values).some(key=>!allowed.includes(key)) ||
 !allowed.every(key=>typeof values[key]==='string' && values[key].length>=32 && values[key].length<4096))
 throw Error('Supply only NAME_LOGO_TOKEN and the stable NAME_LOGO_SESSION_SECRET (at least 32 characters each)');
const child=spawn(process.execPath,[wrangler,'secret','bulk'],{stdio:['pipe','pipe','pipe']});
child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(values));
child.stdout.resume();child.stderr.resume();
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});
if(code!==0)throw Error('Secret provisioning failed; private output suppressed');
console.log('Name gateway and quota secrets installed. Generation flags unchanged.');

