import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android 打包配置（Capacitor）
 * - webDir：Vite 构建产物（使用 `npm run build:android`，会去掉需要联网的网络字体）
 * - 页面由 App 内置的本地服务器提供（https://localhost），完全离线可用
 */
const config: CapacitorConfig = {
  appId: 'com.plcacademy.app',
  appName: '西门子PLC实训工坊',
  webDir: 'dist',
  android: {
    // 不允许混合内容、不需要外部导航
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // 边到边（edge-to-edge）：WebView 铺满状态栏/导航栏下方，页面用 env(safe-area-inset-*) /
    // --safe-area-inset-* 自行留白；图标颜色由 useNativeBridge 按主题切换
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      // 首屏渲染后由 useNativeBridge 主动 hide，避免白屏闪烁
      launchAutoHide: false,
      launchShowDuration: 2500,
      launchFadeOutDuration: 220,
      backgroundColor: '#0a0f14',
      showSpinner: false,
    },
  },
};

export default config;
