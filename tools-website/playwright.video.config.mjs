import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:['seedance.spec.js','video-reel.spec.js'],workers:1,
  use:{baseURL:'http://127.0.0.1:4371',headless:true},
  webServer:{command:'node server.cjs',env:{PORT:'4371'},url:'http://127.0.0.1:4371',reuseExistingServer:false},
});
