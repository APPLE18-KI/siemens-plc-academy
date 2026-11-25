/**
 * 运行环境与原生能力桥接（网页 / Android App 通用）。
 * - Android App 由 Capacitor 打包：触感反馈用 @capacitor/haptics，返回键用 @capacitor/app。
 * - 在普通浏览器里这些函数都会安全地什么也不做（不振动、不拦截返回）。
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticKind = 'tap' | 'success' | 'error' | 'press';

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let lastHapticAt = 0;

/** 轻触反馈：仅在 App 内生效；50ms 内的重复调用会被合并，避免“连振” */
export function haptic(kind: HapticKind = 'tap'): void {
  if (!isNativeApp()) return;
  const now = Date.now();
  if (now - lastHapticAt < 50) return;
  lastHapticAt = now;
  const run = async () => {
    switch (kind) {
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'press':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      default:
        await Haptics.impact({ style: ImpactStyle.Light });
    }
  };
  run().catch(() => undefined);
}
