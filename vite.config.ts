import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 打包友好：
 * - base 默认 './'（相对路径），同一份 dist 可放在 GitHub Pages 子路径、任意静态服务器、
 *   Capacitor/Electron 等打包容器中；如需绝对路径可用环境变量 VITE_BASE 覆盖，例如
 *   VITE_BASE=/siemens-plc-academy/ npm run build
 * - 去掉 index.html 中 <script>/<link> 的 crossorigin 属性，避免在 file:// 或自定义协议容器里
 *   因 CORS 检查导致脚本加载失败。
 */
const OFFLINE = Boolean(process.env.VITE_OFFLINE);

const stripCrossorigin = (): Plugin => ({
  name: 'strip-crossorigin',
  enforce: 'post',
  transformIndexHtml(html) {
    let out = html;
    // VITE_OFFLINE=1（安卓离线包）：去掉标记为 data-online-only 的网络字体等外部资源
    if (process.env.VITE_OFFLINE) {
      out = out.replace(/\s*<link[^>]*data-online-only[^>]*\/?>/g, '');
    }
    out = out.replace(/\s+crossorigin(=["'][^"']*["'])?/g, '');
    // 离线包为单文件 IIFE：浏览器禁止 file:// 下加载 ES 模块脚本（CORS），改为普通 defer 脚本
    if (OFFLINE) {
      out = out.replace(/<script type="module"([^>]*)><\/script>/g, '<script defer$1></script>');
    }
    return out;
  },
});



export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react(), stripCrossorigin()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    // 离线包（安卓 App / 直接双击 index.html）：单个 JS + 单个 CSS，不依赖 ES 模块与动态分包
    cssCodeSplit: !OFFLINE,
    chunkSizeWarningLimit: OFFLINE ? 1600 : 500,
    rollupOptions: {
      output: OFFLINE
        ? { format: 'iife', inlineDynamicImports: true }
        : {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/src/content/lessons/') || id.includes('\\src\\content\\lessons\\')) {
            return 'curriculum';
          }
          if (id.includes('/src/features/simulator/') || id.includes('\\src\\features\\simulator\\') || id.includes('/src/core/plc/') || id.includes('\\src\\core\\plc\\')) {
            return 'simulator';
          }
          if (id.includes('/src/features/models/') || id.includes('\\src\\features\\models\\') || id.includes('/src/content/examples/') || id.includes('\\src\\content\\examples\\')) {
            return 'models-examples';
          }
          if (id.includes('/src/features/workflows/') || id.includes('\\src\\features\\workflows\\') || id.includes('/src/content/capstone/') || id.includes('\\src\\content\\capstone\\')) {
            return 'workflows-capstone';
          }
        },
          },
    },
  },
});
