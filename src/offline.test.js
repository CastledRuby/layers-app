// The phone web app's offline copy (lib/offline.js): only for the web app at
// its https address, never in Layers for Windows, the iPhone project, the dev
// server or tests.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { cacheOffline, shouldCacheOffline } from './lib/offline.js';

const browser = (protocol, extra = {}) => ({ location: { protocol }, navigator: { serviceWorker: { register: vi.fn(async () => ({})) } }, addEventListener: vi.fn((type, fn) => fn()), ...extra });

describe('the offline copy', () => {
  it('is only for the web app on https', () => {
    expect(shouldCacheOffline({ protocol: 'https:' }, browser('https:'))).toBe(true);
    expect(shouldCacheOffline({ protocol: 'http:' }, browser('http:'))).toBe(false); // the dev server
    expect(shouldCacheOffline({ protocol: 'file:' }, browser('file:', { layersSystem: {} }))).toBe(false); // Layers for Windows
    expect(shouldCacheOffline({ protocol: 'https:' }, browser('https:', { layersSystem: {} }))).toBe(false);
    expect(shouldCacheOffline({ protocol: 'capacitor:' }, browser('capacitor:'))).toBe(false); // the iPhone project
    expect(shouldCacheOffline({ protocol: 'https:' }, { navigator: {} })).toBe(false); // no service workers
  });
  it("keeps the page for offline only when it loaded properly, never a 'not found' page (audit 2026-10-14)", async () => {
    const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
    const listeners = {};
    const put = vi.fn(async () => {});
    const self = { location: { origin: 'https://layers.example' }, addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting() {}, clients: { claim: async () => {} } };
    const caches = { open: async () => ({ put, addAll: async () => {} }), match: async () => null, keys: async () => [] };
    let status = 404;
    const fetch = async () => ({ ok: status === 200, status, clone() { return this; } });
    new Function('self', 'caches', 'fetch', source)(self, caches, fetch);
    const navigate = async () => {
      let answer;
      listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://layers.example/somewhere' }, respondWith: (p) => { answer = p; } });
      await answer;
      await new Promise(r => setTimeout(r, 0));
    };
    await navigate();
    expect(put).not.toHaveBeenCalled();
    status = 200;
    await navigate();
    expect(put).toHaveBeenCalledWith('./index.html', expect.objectContaining({ status: 200 }));
  });
  it('registers public/sw.js once the page has loaded', () => {
    const win = browser('https:');
    cacheOffline(win);
    expect(win.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    expect(win.navigator.serviceWorker.register).toHaveBeenCalledWith('./sw.js');
    const local = browser('http:');
    cacheOffline(local);
    expect(local.navigator.serviceWorker.register).not.toHaveBeenCalled();
  });
});
