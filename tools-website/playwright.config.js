import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:4195', headless: true, screenshot: 'only-on-failure'},
  webServer: {command: 'node server.cjs', env: {PORT: '4195'}, url: 'http://127.0.0.1:4195', reuseExistingServer: false},
});
