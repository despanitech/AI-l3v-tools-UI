export function validateReference(body) {
  if (!body || typeof body !== 'object') throw new Error('Choose an image or a video URL.');
  if (body.kind !== 'image' && body.kind !== 'video') throw new Error('Unsupported reference type.');
  if (typeof body.image !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image) || body.image.length > 1400000) throw new Error('Use a JPEG reference smaller than 1 MB after resizing.');
  const bytes = Uint8Array.from(atob(body.image.split(',')[1]), c => c.charCodeAt(0));
  if (bytes.length < 100 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('The reference is not a valid JPEG.');
  if (body.kind === 'video') {
    if (typeof body.sourceUrl !== 'string' || body.sourceUrl.length > 2048) throw new Error('Enter a public HTTPS video URL.');
    const u = new URL(body.sourceUrl);
    if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Enter a public HTTPS video URL.');
  }
  return {kind: body.kind, image: body.image};
}
export function validateReport(report, ids) {
  const text = v => typeof v === 'string' && v.length > 0 && v.length <= 4000;
  if (!report || !text(report.summary) || !Array.isArray(report.models) || report.models.length < 1 || report.models.length > 3) throw new Error('Invalid analysis result.');
  if (!report.models.every(m => ids.has(m.id) && text(m.reason))) throw new Error('Unknown model in analysis result.');
  for (const key of ['observations','workflow','limitations']) if (!Array.isArray(report[key]) || report[key].length < 1 || report[key].length > 8 || !report[key].every(text)) throw new Error('Incomplete analysis result.');
  if (!text(report.prompt)) throw new Error('Missing suggested prompt.');
  return {summary:report.summary,models:report.models.map(m=>({id:m.id,reason:m.reason})),observations:report.observations,workflow:report.workflow,limitations:report.limitations,prompt:report.prompt};
}
