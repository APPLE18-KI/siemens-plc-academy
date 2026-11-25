package com.plcacademy.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

/**
 * 主界面：在所有 Android 版本（API 24+）上统一启用边到边显示，
 * 状态栏/导航栏透明，由网页端通过 safe-area 留白；图标颜色由 Capacitor SystemBars 按主题切换。
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        // 跟随系统字体大小，但最多放大到 120%，避免超大字号把梯形图、底部导航挤乱
        if (getBridge() != null && getBridge().getWebView() != null) {
            float scale = getResources().getConfiguration().fontScale;
            int zoom = Math.round(Math.max(0.85f, Math.min(1.2f, scale)) * 100);
            getBridge().getWebView().getSettings().setTextZoom(zoom);
        }
    }
}
