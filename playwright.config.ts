import { defineConfig } from '@playwright/test';

const widths = [360, 390, 768, 1440];

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
  use: {baseURL: 'http://localhost:5179', locale: 'he-IL'},
  projects: widths.map(width => ({name: `w${width}`, use: {browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', viewport: {width, height: 900}}})),
  webServer: {command: 'npx vite --port 5179 --strictPort', url: 'http://localhost:5179', reuseExistingServer: !process.env.CI},
});
