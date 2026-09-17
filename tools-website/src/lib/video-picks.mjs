// Which finished previews become Studio's clips. Pure, shared by the page
// (to show what is coming) and the edge (to decide what is created).

// Scenes with natural motion first: a street, a sail, a balloon. A tattoo or a
// business card has nothing to move, so they come last.
export const MOTION_FRIENDLY = [
  'hot-air-balloon', 'boat-sail', 'city-bus', 'delivery-van', 'food-truck', 'beach-flag',
  'festival-stage', 'event-tent', 'cafe-umbrella', 'market-stall', 'lamp-post-banner',
  'storefront-sign', 'restaurant-awning', 'rooftop-sign', 'building-facade', 'event-backdrop',
  'park-kiosk', 'construction-hoarding', 'bicycle-delivery-box', 'scarf', 'hoodie', 'denim-jacket',
];

/** Motion-friendly templates in order, then whatever finished first. `items` carry the template id as `id`. */
export function pickVideoSubjects(items, count = 3) {
  const finished = (Array.isArray(items) ? items : []).filter(item => item && item.id);
  const rank = id => { const at = MOTION_FRIENDLY.indexOf(id); return at < 0 ? MOTION_FRIENDLY.length : at; };
  return [...finished].sort((a, b) => rank(a.id) - rank(b.id)).slice(0, count);
}
