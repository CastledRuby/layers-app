// End-to-end tests drive the real packaged Layers.exe (see docs/testing.md).
// Run them with `npm run test:e2e`, which builds the app first.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90 * 1000,
  // One app at a time: the tests launch real windows and a tray icon.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'test-results',
});
