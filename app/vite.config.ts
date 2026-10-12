import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the Pages workflow (/kintree/); local builds stay relative.
export default defineConfig({ plugins: [react()], base: process.env.BASE_PATH ?? './', server: { fs: { strict: false } } });
