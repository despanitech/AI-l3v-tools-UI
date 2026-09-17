// One sentence for a failed job: what the backend recorded, then a short
// reference the buyer can quote. Never a raw provider message.
export function failureText(diagnostic, fallback = 'Not completed.') {
  const d = diagnostic && typeof diagnostic === 'object' ? diagnostic : {};
  const reason = typeof d.reason === 'string' && d.reason ? d.reason : '';
  const code = typeof d.code === 'string' && d.code ? d.code : '';
  const ref = typeof d.traceId === 'string' && d.traceId ? d.traceId.slice(0, 8) : '';
  let text = reason || (code ? `Not completed (${code}).` : fallback);
  if (!/[.!?]$/.test(text)) text += '.';
  if (code && reason && !text.includes(code)) text += ` Code ${code}.`;
  if (ref) text += ` Ref ${ref}.`;
  return text;
}
