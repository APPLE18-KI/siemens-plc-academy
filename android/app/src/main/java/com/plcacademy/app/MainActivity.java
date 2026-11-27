package com.plcacademy.app;

import android.content.res.Configuration;
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
        applyTextZoom();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyTextZoom();
    }

    /**
     * 跟随系统字体大小，但限制在 85%–120%：网页布局已按 130% 文字缩放验证不溢出（v2.1），
     * 再大的系统字号（部分机型可到 200%）会让梯形图、底部导航过于拥挤。
     * Capacitor 本身不设置 textZoom，WebView 在 super.onCreate() 里已创建，因此这里设置会生效。
     */
    private void applyTextZoom() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        float scale = getResources().getConfiguration().fontScale;
        int zoom = Math.round(Math.max(0.85f, Math.min(1.2f, scale)) * 100);
        getBridge().getWebView().getSettings().setTextZoom(zoom);
    }
}
