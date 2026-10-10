// The phone web app's offline copy (lib/offline.js): only for the web app at
// its https address, never in Layers for Windows, the iPhone project, the dev
// server or tests.
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
