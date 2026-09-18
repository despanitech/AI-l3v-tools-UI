// One sentence for a failed job: what the backend recorded, then a short
// reference the buyer can quote. Never a raw provider message.
export const CONTENT_REJECTED = 'content-rejected';
export const CONTENT_REJECTED_TEXT = 'Blocked by the content filter: the name or artwork was judged profane or explicit. Choose a different name or spelling.';
export const isContentRejected = value => (value && typeof value === 'object' ? value.code === CONTENT_REJECTED : false)
  || (typeof value === 'string' && value.startsWith('Blocked by the content filter'));

export function failureText(diagnostic, fallback = 'Not completed.') {
  const d = diagnostic && typeof diagnostic === 'object' ? diagnostic : {};
  // A content rejection is said plainly and without a reference: it is not a bug to report.
  if (d.code === CONTENT_REJECTED) return CONTENT_REJECTED_TEXT;
  const reason = typeof d.reason === 'string' && d.reason ? d.reason : '';
  const code = typeof d.code === 'string' && d.code ? d.code : '';
  const ref = typeof d.traceId === 'string' && d.traceId ? d.traceId.slice(0, 8) : '';
  let text = reason || (code ? `Not completed (${code}).` : fallback);
  if (!/[.!?]$/.test(text)) text += '.';
  if (code && reason && !text.includes(code)) text += ` Code ${code}.`;
  if (ref) text += ` Ref ${ref}.`;
  return text;
}

// While a job is on another attempt: "Retrying · attempt 2 of 3 (planner exit 1)".
export function retryText(retry) {
  const r = retry && typeof retry === 'object' ? retry : null;
  if (!r || typeof r.attempt !== 'number') return '';
  const of = typeof r.of === 'number' ? ` of ${r.of}` : '';
  const why = typeof r.reason === 'string' && r.reason ? r.reason : typeof r.code === 'string' && r.code ? r.code : '';
  return `Retrying · attempt ${r.attempt}${of}${why ? ` (${why})` : ''}`;
}
