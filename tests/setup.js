// Vitest setup, shared by every test file. Unit tests run in Node; the app
// tests in tests/app/ opt into jsdom with a `@vitest-environment jsdom`
// docblock, and only they get the DOM helpers below.
import { afterEach, vi } from 'vitest';

if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete window.layersSystem;
    delete window.layersUpdater;
    vi.useRealTimers();
  });

  // jsdom has no layout engine. Recharts' ResponsiveContainer needs
  // ResizeObserver, and a few views call scrollIntoView.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function () {};
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }

  // Charts measure a 0×0 box in jsdom and warn about it on every render.
  const warn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('of chart should be greater than 0')) return;
    warn(...args);
  };
}
