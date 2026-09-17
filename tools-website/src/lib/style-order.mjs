// Which styles lead each list, and which one is chosen before the user
// touches anything. The name logo leads with the compact emblem, then the
// tall one; on a phone the tall one fits the screen, so it is the default.
export const PHONE_QUERY = '(max-width: 760px)';

const LEAD = {logo: ['hard-angular', 'tall-stems']};
const DEFAULT = {logo: {desktop: 'hard-angular', phone: 'tall-stems'}};

export function orderStyles(styles) {
  const rank = style => {
    const index = (LEAD[style.mode] || []).indexOf(style.id);
    return index < 0 ? Infinity : index;
  };
  return styles.map((style, index) => ({style, index}))
    .sort((a, b) => rank(a.style) - rank(b.style) || a.index - b.index)
    .map(({style}) => style);
}

// The first style of the mode, unless a preferred default is in the list.
export function defaultStyleId(styles, mode, {phone = false} = {}) {
  const shown = orderStyles(styles).filter(style => style.mode === mode);
  const wanted = DEFAULT[mode]?.[phone ? 'phone' : 'desktop'];
  return (shown.find(style => style.id === wanted) || shown[0])?.id;
}

export function onPhone() {
  try {return globalThis.matchMedia?.(PHONE_QUERY).matches === true} catch {return false}
}
