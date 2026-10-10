// The phone web app works offline (docs/build-and-release.md, "The phone web
// app"): a service worker (public/sw.js) keeps the app's own files. Only for
// the web app at its https address: never in Layers for Windows (file://, with
// its bridge), the iPhone project (capacitor://), the dev server or tests.
export function shouldCacheOffline(loc = window.location, win = window) {
  return loc.protocol === 'https:' && !win.layersSystem && !!(win.navigator && 'serviceWorker' in win.navigator);
}
export function cacheOffline(win = window) {
  if (!shouldCacheOffline(win.location, win)) return;
  win.addEventListener('load', () => { win.navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
