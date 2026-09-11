import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const helper=new URL('./provision-name-secrets.mjs',import.meta.url);
function run(input,script){return spawnSync(process.execPath,[helper.pathname.replace(/^\/([A-Za-z]:)/,'$1'),script],{input,encoding:'utf8'});}
test('secret installer rejects missing and unrelated settings without echoing input',()=>{
 for(const input of ['not-json',{NAME_LOGO_TOKEN:'private-marker',TURNSTILE_SECRET:'private-marker'}]){
  const result=run(typeof input==='string'?input:JSON.stringify(input),'unused.mjs');
  assert.notEqual(result.status,0);assert.ok(!(result.stdout+result.stderr).includes('private-marker'));
 }
});
test('secret installer forwards only name secrets and suppresses child output',()=>{
 const dir=mkdtempSync(join(tmpdir(),'name-secret-test-'));
 try{
  const script=join(dir,'fake.mjs');
  writeFileSync(script,`let raw='';for await(const c of process.stdin)raw+=c;const v=JSON.parse(raw);if(process.argv.slice(2).join(' ')!=='secret bulk'||Object.keys(v).sort().join(',')!=='NAME_LOGO_SESSION_SECRET,NAME_LOGO_TOKEN')process.exit(2);console.log(raw);console.error(raw);`);
  const result=run(JSON.stringify({NAME_LOGO_TOKEN:'token-marker'.repeat(4),NAME_LOGO_SESSION_SECRET:'stable-marker'.repeat(4)}),script);
  assert.equal(result.status,0);assert.match(result.stdout,/Generation flags unchanged/);assert.ok(!(result.stdout+result.stderr).includes('marker'));
  writeFileSync(script,`console.error('sensitive-marker');process.exit(1);`);
  const failed=run(JSON.stringify({NAME_LOGO_TOKEN:'a'.repeat(40),NAME_LOGO_SESSION_SECRET:'b'.repeat(40)}),script);
  assert.notEqual(failed.status,0);assert.ok(!failed.stderr.includes('sensitive-marker'));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
