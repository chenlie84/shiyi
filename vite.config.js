import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * 两种产物：
 *   npm run dev    → 本地热更新（http://localhost:5173）
 *   npm run build  → dist/index.html 单文件，双击即玩、可直接发给别人
 *
 * 单文件是这个项目的硬需求（美术与字体全部内联，不依赖任何外部请求），
 * 所以 cssCodeSplit 关掉、assetsInlineLimit 拉满。
 */
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  server: {
    port: 5173,
    open: false,
    host: '127.0.0.1',
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    cssCodeSplit: false,
    assetsInlineLimit: 64 * 1024 * 1024,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
