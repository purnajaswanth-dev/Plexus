import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(import.meta.dirname, '..'),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  build: {
    outDir: path.resolve(import.meta.dirname, '../src/main/resources/static/graph-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'src/main.jsx'),
      output: {
        entryFileNames: 'graph-explorer.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'graph-explorer.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
        format: 'es'
      }
    }
  }
});
