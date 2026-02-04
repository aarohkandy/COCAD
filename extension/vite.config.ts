import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

// Copy static files to dist after build
function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    closeBundle() {
      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      );
      
      // Copy icons
      const iconsDir = resolve(__dirname, 'icons');
      const distIconsDir = resolve(__dirname, 'dist/icons');
      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true });
      }
      if (existsSync(iconsDir)) {
        readdirSync(iconsDir).forEach(file => {
          copyFileSync(
            resolve(iconsDir, file),
            resolve(distIconsDir, file)
          );
        });
      }
      
      // Copy content.css
      const contentCssDir = resolve(__dirname, 'dist/src/content');
      if (!existsSync(contentCssDir)) {
        mkdirSync(contentCssDir, { recursive: true });
      }
      copyFileSync(
        resolve(__dirname, 'src/content/content.css'),
        resolve(contentCssDir, 'content.css')
      );
    }
  };
}

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        sidebar: resolve(__dirname, 'src/sidebar/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') return 'src/content/index.js';
          if (chunkInfo.name === 'background') return 'src/background/index.js';
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
