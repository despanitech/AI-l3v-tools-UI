export function facebookReelUrl(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['facebook.com','www.facebook.com','m.facebook.com'].includes(url.hostname) ||
        !/^\/reels?\/\d+\/?$/.test(url.pathname)) return null;
    return url.origin + url.pathname;
  } catch { return null; }
}
