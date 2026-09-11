import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';

const out=path.resolve(process.argv[2]||'private-invitations');
const records=JSON.parse(await readFile(path.join(out,'PRIVATE-invitations.json'),'utf8'));
if(!Array.isArray(records)||!records.length)throw Error('PRIVATE-invitations.json is missing or empty');

for(const record of records){
  const {id,token,phrase}=record;
  if(!/^\d{3}$/.test(id)||typeof token!=='string'||typeof phrase!=='string')throw Error(`Invitation ${id||'?'} is invalid`);
  const base=`l3v-invitation-${id}`,qrName=`${base}-qr.png`,svgName=`${base}.svg`;
  const certificate=await readFile(path.join(out,svgName),'utf8');
  const payload=JSON.stringify({type:'l3v-access',version:1,token,phrase});
  await QRCode.toFile(path.join(out,qrName),payload,{errorCorrectionLevel:'H',margin:2,width:900,color:{dark:'#171712',light:'#faf9f3'}});
  await writeFile(path.join(out,`${base}.html`),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>L3V private invitation ${id}</title><style>html{background:#e9e8df}body{max-width:1200px;margin:32px auto;padding:0 20px;font-family:Arial,sans-serif;color:#171712}.certificate{background:#faf9f3;box-shadow:0 12px 40px #0002}.certificate svg{display:block;width:100%;height:auto}.actions{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.actions a{padding:11px 16px;border:1px solid #726b39;border-radius:7px;background:#faf9f3;color:#171712;text-decoration:none}@media print{html{background:white}body{margin:0;max-width:none;padding:0}.actions{display:none}.certificate{box-shadow:none}}</style></head><body><div class="actions"><a href="${qrName}" download>Download QR image</a><a href="${svgName}" download>Download printable certificate</a></div><main class="certificate">${certificate}</main></body></html>`);
}

console.log(`Added HTML cards and PNG QR images for ${records.length} invitations in ${out}`);
