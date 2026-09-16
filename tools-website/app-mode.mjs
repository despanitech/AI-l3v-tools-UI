// The one switch that selects a lane for the whole site.
//
//   production  everything real: the gateway generates, Stripe charges.
//   uat         generation is simulated, Stripe runs in test mode for real.
//   dev         generation is simulated and there is no Stripe at all: Pay
//               records the purchase and comes straight back as paid.
//
// Anything other than an explicit "dev" or "uat" is production, so a missing
// or misspelled value can never switch real traffic onto the simulator.

export const MODES = ['dev', 'uat', 'production'];

export function appMode(env) {
  const value = String(env?.APP_MODE || '').trim().toLowerCase();
  return value === 'dev' || value === 'uat' ? value : 'production';
}

/** Whether generation is simulated in this mode. */
export const simulated = mode => mode === 'dev' || mode === 'uat';

/** Whether checkout skips Stripe entirely in this mode. */
export const paymentSimulated = mode => mode === 'dev';
