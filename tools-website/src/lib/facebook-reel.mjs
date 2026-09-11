export function facebookReelUrl(value) {
  try {
    if(typeof value!=='string'||value.length>2048||/[\x00-\x20]/.test(value.trim()))return null;
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['facebook.com','www.facebook.com','m.facebook.com'].includes(url.hostname) ||
        !/^\/reels?\/\d{1,30}\/?$/.test(url.pathname)) return null;
    return 'https://www.facebook.com/reel/' + url.pathname.split('/').filter(Boolean).at(-1);
  } catch { return null; }
}
