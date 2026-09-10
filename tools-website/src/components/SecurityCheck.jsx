import {useEffect, useRef} from 'react';

let loading;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => { script.remove(); loading = null; reject(new Error('The security check could not load. Refresh to try again.')); };
    document.head.append(script);
  });
  return loading;
}
export default function SecurityCheck({config, action, onToken, onError}) {
  const element = useRef(null), callbacks = useRef({onToken, onError});
  callbacks.current = {onToken, onError};
  useEffect(() => {
    let active = true, widget;
    loadTurnstile().then(api => {
      if (!active) return;
      widget = api.render(element.current, {sitekey: config.sitekey, action, theme: document.documentElement.dataset.mode || 'light',
        callback: token => { if (active) callbacks.current.onToken(token); },
        'expired-callback': () => { if (active) callbacks.current.onToken(''); },
        'error-callback': () => { if (active) callbacks.current.onToken(''); },
      });
    }).catch(error => { if (active) callbacks.current.onError(error.message); });
    return () => { active = false; if (widget !== undefined) window.turnstile?.remove(widget); };
  }, [config.sitekey, action]);
  return <div ref={element} />;
}
