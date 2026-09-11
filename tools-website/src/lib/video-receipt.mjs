import {accessHeaders,requestReceipt} from './master-access.mjs';
const prefix = 'l3v-video-request-v1:';
const latest = prefix + 'latest';
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const error = () => new Error('This browser could not retain access to your request. Nothing new was submitted. Check browser storage.');
// Keep recovery across tabs without storing the uploaded image or provider keys.
// Copy older tab-only receipts on read, before any request can be sent.
const browserStorage = {
  getItem(key) {
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved;
    const legacy = sessionStorage.getItem(key);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      if (localStorage.getItem(key) !== legacy) throw error();
    }
    return legacy;
  },
  setItem(key, value) { localStorage.setItem(key, value); }
};
const stages = new Set(['/api/analyze', '/api/first-frame', '/api/image-to-video']);
const valid = record => record && /^[a-f0-9]{64}$/.test(record.fingerprint) &&
  /^[a-f0-9]{32}$/.test(record.access?.requestId) && /^[a-f0-9]{64}$/.test(record.access?.receipt) &&
  record.stages && typeof record.stages === 'object';

async function digest(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))));
}
function save(record, storage) {
  const key = prefix + record.fingerprint, value = JSON.stringify(record);
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) throw error();
  storage.setItem(latest, key);
  if (storage.getItem(latest) !== key) throw error();
}
export async function importAccountWork(rows,storage=browserStorage){const root=rows[0],record={fingerprint:root.fingerprint,access:{requestId:root.request_id,receipt:await requestReceipt(root.request_id)},stages:{}};for(const row of rows)if(row.stage_key&&row.resource_id)record.stages['/api/'+({'analysis':'analyze'}[row.stage_key]||row.stage_key.replace(/^frame_.*/,'first-frame').replace(/^video_.*/,'image-to-video'))]={fingerprint:row.fingerprint,jobId:row.resource_id};save(record,storage);return record}
export async function receiptForReference(reference, storage = browserStorage) {
  try {
    const fingerprint = await digest(reference.kind === 'facebook-reel' ? {kind: reference.kind, sourceUrl: reference.sourceUrl} : {kind: reference.kind, image: reference.image});
    const raw = storage.getItem(prefix + fingerprint);
    const requestId=hex(crypto.getRandomValues(new Uint8Array(16)));
    const record = raw === null ? {fingerprint, access: {requestId,receipt:await requestReceipt(requestId)}, stages: {}} : JSON.parse(raw);
    if (!valid(record) || record.fingerprint !== fingerprint) throw error();
    save(record, storage);
    return record;
  } catch { throw error(); }
}
export function lastReceipt(storage = browserStorage) {
  try {
    const key = storage.getItem(latest);
    if (!key) return null;
    const record = JSON.parse(storage.getItem(key));
    if (!valid(record) || key !== prefix + record.fingerprint) throw error();
    return record;
  } catch { throw error(); }
}
export function receiptTransport(record, transport = fetch, storage = browserStorage) {
  return async (path, options) => {
    if (!valid(record) || !(stages.has(path) || path === '/api/jobs')) throw error();
    try {
      const stored = JSON.parse(storage.getItem(prefix + record.fingerprint));
      if (!valid(stored) || stored.access.requestId !== record.access.requestId ||
          stored.access.receipt !== record.access.receipt) throw error();
      record.stages = stored.stages;
      if (stages.has(path)) {
        const {token, ...input} = JSON.parse(options.body);
        const fingerprint = await digest(input), previous = record.stages[path];
        if (previous && previous.fingerprint !== fingerprint)
          throw new Error('This request already used different settings. Check its saved status.');
        record.stages[path] = previous || {fingerprint, ...(path === '/api/image-to-video' ? {settings: input.request} : {})};
      }
      save(record, storage);
    } catch { throw error(); }
    const headers = new Headers(accessHeaders(options.headers));
    headers.set('X-L3V-Request-Id', record.access.requestId);
    headers.set('X-L3V-Request-Receipt', record.access.receipt);
    const response = await transport(path, {...options, headers});
    if (response.ok && stages.has(path)) {
      const data = await response.clone().json();
      if (/^[a-f0-9]{32}$/.test(data.job?.id)) {
        record.stages[path].jobId = data.job.id;
        try { save(record, storage); }
        catch { throw new Error('The request may be running, but its status could not be saved. Do not start another generation.'); }
      }
    }
    return response;
  };
}
