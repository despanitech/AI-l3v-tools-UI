// The one switch that selects a lane for the whole site.
//
//   production  everything real: the gateway generates, Stripe charges.
//   uat         real generation; Stripe runs in test mode.
//   test        generation is simulated; Stripe runs in test mode for real.
//   dev         generation is simulated and there is no Stripe at all: Pay
//               records the purchase and comes straight back as paid.
//
// Anything other than an explicit dev, test or uat is production, so a
// missing or misspelled value can never switch real traffic onto the
// simulator.

export const MODES = ['dev', 'test', 'uat', 'production'];

export function normalize(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'dev' || mode === 'test' || mode === 'uat' ? mode : 'production';
}

/** The deploy-time default from wrangler.jsonc. */
export function appMode(env) {
  return normalize(env?.APP_MODE);
}

// The switch in the UI writes the mode here; the deploy-time value is only
// the default when nothing has been set. One KV read per request.
export const MODE_KEY = 'app-mode';

export async function resolveAppMode(env) {
  if (!env?.INVITATIONS) return appMode(env);
  try {
    const stored = await env.INVITATIONS.get(MODE_KEY);
    return stored ? normalize(stored) : appMode(env);
  } catch { return appMode(env); }
}

export async function storeAppMode(env, value) {
  const mode = normalize(value);
  await env.INVITATIONS.put(MODE_KEY, mode);
  return mode;
}

/** Whether generation is simulated in this mode. */
export const simulated = mode => mode === 'dev' || mode === 'test';

/** Whether checkout skips Stripe entirely in this mode. */
export const paymentSimulated = mode => mode === 'dev';
