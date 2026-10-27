import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Relative asset paths so the build works under the GitHub Pages subpath (/bank-under-pressure/) and at a root domain.
export default defineConfig({base: './', plugins: [react()]});
