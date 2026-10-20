/// <reference types="node" />
import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// Use the browser already installed on the test machine. Never download one.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (process.platform === 'win32'
  ? [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].find((path) => existsSync(path))
  : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/opt/pw-browsers/chromium');
if (!chromiumPath) throw new Error('Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to an installed Chromium browser.');

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    launchOptions: { executablePath: chromiumPath, args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 30_000 },
});
