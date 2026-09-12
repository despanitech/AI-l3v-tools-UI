import {accessHeaders,requestReceipt} from './master-access.mjs';
const key='l3v-name-logo-request-v2';
const stores=()=>[globalThis.localStorage,globalThis.sessionStorage].filter(Boolean);
export function remember(value){const raw=value?JSON.stringify(value):null;for(const storage of stores())try{if(raw){storage.setItem(key,raw);if(storage.getItem(key)!==raw)continue}else storage.removeItem(key);return}catch{}throw Error('browser-storage-unavailable')}
export function savedRequest(){for(const storage of stores())try{const value=JSON.parse(storage.getItem(key));if(value&&/^[a-f0-9]{32}$/.test(value.access?.requestId)&&/^[a-f0-9]{64}$/.test(value.access?.receipt))return value}catch{}return null}
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
export async function createRequest(first,last,styleId){const requestId=random(16),access={requestId,receipt:await requestReceipt(requestId)};const value={access,requestKey:access.requestId,first:first.trim(),last:last.trim(),...(Array.isArray(styleId)?{styles:styleId}:{styleId})};remember(value);return value;}
export function headers(current){return accessHeaders({'X-L3V-Request-Id':current.access.requestId,'X-L3V-Request-Receipt':current.access.receipt});}
export async function call(action,current,body,signal){const response=await fetch('/api/name-logo/'+action,{method:'POST',headers:{'Content-Type':'application/json',...headers(current)},body:JSON.stringify(body),signal});if(!response.ok)throw new Error('Request unavailable ('+response.status+')');return response.json();}
export async function imageUrl(current,id,signal){const response=await fetch('/api/name-logo/image?id='+id,{headers:headers(current),signal});if(!response.ok)throw new Error('Image unavailable');return URL.createObjectURL(await response.blob());}
