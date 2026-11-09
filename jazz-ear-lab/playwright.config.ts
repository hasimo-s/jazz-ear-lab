import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// クラウド環境などでブラウザが事前インストールされている場合はそれを使う
const preinstalled = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(preinstalled) && !process.env.PW_USE_BUNDLED
  ? { executablePath: preinstalled }
  : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions,
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],
});
