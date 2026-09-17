// Which artwork goes on which product in a paid set.
//
// Left alone, a set is split evenly across the designs the buyer has - ten
// name logos, ten initials and ten signatures for Studio - rather than one
// artwork on everything. The buyer can still change any product, and those
// choices are kept when the balance is recomputed.

export const ARTWORK_MODES = ['logo', 'initials', 'signature'];
export const ARTWORK_SHORT = {logo: 'Name logo', initials: 'Initials', signature: 'Signature'};

/**
 * Assign an artwork mode to every selected subject.
 * `existing` choices for subjects still selected are kept; unassigned
 * subjects go to the mode with the fewest products so far, preferring the
 * subject's natural fit when it is among the least used.
 */
export function balanceArtwork(subjects, modes, existing = {}, natural = () => null) {
  const available = ARTWORK_MODES.filter(mode => modes.includes(mode));
  if (!available.length) return {};
  const result = {};
  const counts = Object.fromEntries(available.map(mode => [mode, 0]));
  for (const id of subjects) {
    const kept = existing[id];
    if (available.includes(kept)) { result[id] = kept; counts[kept]++; }
  }
  for (const id of subjects) {
    if (result[id]) continue;
    const least = Math.min(...available.map(mode => counts[mode]));
    const candidates = available.filter(mode => counts[mode] === least);
    const fit = natural(id);
    const mode = candidates.includes(fit) ? fit : candidates[0];
    result[id] = mode;
    counts[mode]++;
  }
  return result;
}

/** How many products carry each mode, in ARTWORK_MODES order. */
export function artworkCounts(assignment, subjects) {
  const counts = Object.fromEntries(ARTWORK_MODES.map(mode => [mode, 0]));
  for (const id of subjects) if (counts[assignment[id]] !== undefined) counts[assignment[id]]++;
  return counts;
}

/** The next mode after `current`, among those available. */
export function nextArtwork(current, modes) {
  const available = ARTWORK_MODES.filter(mode => modes.includes(mode));
  if (!available.length) return current;
  const at = available.indexOf(current);
  return available[(at + 1) % available.length];
}
