import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({testDir:'./e2e',use:{baseURL:'http://127.0.0.1:3000',trace:'off'},webServer:{command:'npm run dev',cwd:path.resolve(__dirname,'../..'),url:'http://127.0.0.1:3000',reuseExistingServer:false,timeout:120000},reporter:'list'});
