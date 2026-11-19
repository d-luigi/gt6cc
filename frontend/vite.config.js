import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const dataset = JSON.parse(readFileSync(new URL('./cheats.json', import.meta.url), 'utf8'));

export default defineConfig({
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  plugins: [{
    name: 'embed-cheat-data',
    transformIndexHtml() {
      return [{
        tag: 'script',
        attrs: { id: 'cheat-data', type: 'application/json' },
        children: JSON.stringify(dataset).replaceAll('<', '\\u003c'),
        injectTo: 'body',
      }];
    },
  }],
  build: {
    rollupOptions: { output: { entryFileNames: 'app.js', assetFileNames: 'details.css' } },
  },
});
