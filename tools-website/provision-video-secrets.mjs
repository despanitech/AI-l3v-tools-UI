// Pipe a private JSON object to stdin. Never print or persist its contents.
// Does not deploy, enable generation, or change name-logo settings.
import {spawn} from 'node:child_process';
const [wrangler]=process.argv.slice(2);
if(!wrangler)throw Error('Wrangler JS path required');
let raw='';
for await(const chunk of process.stdin){raw+=chunk;if(raw.length>16384)throw Error('Configuration too large')}
let values;
try{values=JSON.parse(raw)}catch{throw Error('Private configuration must be JSON')}
const allowed=['HERMES_TOKEN','TURNSTILE_SECRET','VIDEO_TEST_IPS'];
if(!values||Array.isArray(values)||Object.keys(values).some(key=>!allowed.includes(key))||
 !allowed.every(key=>typeof values[key]==='string'&&values[key].trim().length>0&&values[key].length<4096))
 throw Error('Supply only HERMES_TOKEN, TURNSTILE_SECRET and VIDEO_TEST_IPS');
const child=spawn(process.execPath,[wrangler,'secret','bulk'],{stdio:['pipe','pipe','pipe']});
child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(values));
child.stdout.resume();child.stderr.resume();
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});
if(code!==0)throw Error('Secret provisioning failed; private output suppressed');
console.log('Private gateway, challenge and test-network settings provisioned. Generation flags unchanged.');
