import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * Inlines built JS and CSS assets directly into dist/index.html on production builds,
 * producing a single self-contained HTML file ready for GitHub Pages or local file:// use.
 */
function inlineSingleHtmlPlugin(): Plugin {
  return {
    name: 'inline-single-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlChunk = bundle['index.html'];
      if (!htmlChunk || htmlChunk.type !== 'asset' || typeof htmlChunk.source !== 'string') {
        return;
      }

      let html = htmlChunk.source;

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && fileName.endsWith('.css') && typeof chunk.source === 'string') {
          const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const linkRegex = new RegExp(`<link[^>]*href=["']\\.?/?${escaped}["'][^>]*>`, 'i');
          if (linkRegex.test(html)) {
            html = html.replace(linkRegex, () => `<style>${chunk.source}</style>`);
            delete bundle[fileName];
          }
        } else if (chunk.type === 'chunk' && chunk.isEntry) {
          const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const scriptRegex = new RegExp(
            `<script[^>]*src=["']\\.?/?${escaped}["'][^>]*></script>`,
            'i',
          );
          if (scriptRegex.test(html)) {
            const safeCode = chunk.code.replace(/<\/script>/gi, '<\\/script>');
            html = html.replace(
              scriptRegex,
              () => `<script type="module">${safeCode}</script>`,
            );
            delete bundle[fileName];
          }
        }
      }

      htmlChunk.source = html;
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      inlineSingleHtmlPlugin(),
      // Copies src/assets into dist/ if present
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
