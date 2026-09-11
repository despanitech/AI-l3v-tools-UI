const key='l3v-name-logo-request-v2';
export function remember(value){if(value)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key);}
export function savedRequest(){try{const value=JSON.parse(sessionStorage.getItem(key));return value&&/^[a-f0-9]{32}$/.test(value.access?.requestId)&&/^[a-f0-9]{64}$/.test(value.access?.receipt)?value:null}catch{return null}}
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
export function createRequest(first,last,styleId){const access={requestId:random(16),receipt:random(32)};const value={access,requestKey:access.requestId,first:first.trim(),last:last.trim(),styleId};remember(value);return value;}
export function headers(current){return {'X-L3V-Request-Id':current.access.requestId,'X-L3V-Request-Receipt':current.access.receipt};}
export async function call(action,current,body,signal){const response=await fetch('/api/name-logo/'+action,{method:'POST',headers:{'Content-Type':'application/json',...headers(current)},body:JSON.stringify(body),signal});if(!response.ok)throw new Error('Request unavailable ('+response.status+')');return response.json();}
export async function imageUrl(current,id,signal){const response=await fetch('/api/name-logo/image?id='+id,{headers:headers(current),signal});if(!response.ok)throw new Error('Image unavailable');return URL.createObjectURL(await response.blob());}
