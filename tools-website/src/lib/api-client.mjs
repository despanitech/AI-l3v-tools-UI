export async function post(path, body, signal, transport = fetch) {
  const response = await transport(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])});
  let data;
  try { data = await response.json(); } catch { throw new Error('The service returned an unreadable response.'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The service could not complete this request.');
  return data;
}
export async function waitForJob(data, update, signal, transport = fetch, delay = ms => new Promise(resolve => setTimeout(resolve,ms))) {
  const started = Date.now();
  while (data.job) {
    const {id,status} = data.job;
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('The service returned an invalid job.');
    if (status === 'succeeded') return data;
    const errors = {failed:'This job failed. No result is available.',expired:'This job expired. Please start a new analysis.',ambiguous:'The provider result is uncertain. Do not resubmit; ask support to check the job.'};
    if (errors[status]) throw new Error(errors[status]);
    if (!['queued','running'].includes(status)) throw new Error('The service returned an unknown job state.');
    update(status === 'queued' ? 'Your request is queued…' : 'Working on your request…');
    if (Date.now() - started > 10 * 60 * 1000) throw new Error('Still waiting for the job. Do not resubmit; it may still be running.');
    await delay(2500); signal.throwIfAborted();
    data = await post('/api/jobs',{id},signal,transport);
  }
  return data;
}
export function estimateRate(catalog,rateId,seconds,takes,now = Date.now()) {
  const rate = catalog.rates.find(r => r.id === rateId);
  if (!rate || !rate.durations.includes(seconds) || !Number.isInteger(takes) || takes < 1 || takes > 20) throw new Error('Choose an available duration and 1–20 takes.');
  const verified = Date.parse(rate.verifiedAt);
  if (!Number.isFinite(verified) || verified > now + 300000) throw new Error('The price verification date is invalid.');
  // Catalog decimal strings, converted to integer millionths before arithmetic.
  const units = value => {
    if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('Invalid catalog price.');
    const [whole,fraction=''] = value.split('.'); return Number(whole)*1000000+Number(fraction.padEnd(6,'0'));
  };
  const amount = Math.max(units(rate.usdPerSecond)*seconds,units(rate.minimumChargeUsd));
  const money = value => (Math.floor((value+5000)/10000)/100).toFixed(2);
  return {...rate,seconds,takes,perTake:money(amount),estimatedTotal:money(amount*takes),stale:now-verified>7*86400000,catalogRevision:catalog.revision};
}
