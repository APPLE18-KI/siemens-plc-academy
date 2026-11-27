import React from 'react';

export type SkeletonVariant = 'workbench' | 'reader' | 'catalog';

interface RouteSkeletonProps {
  label?: string;
  variant?: SkeletonVariant;
}

/**
 * 贴合页面布局结构的工业控制台风格骨架屏（配合 React.lazy + Suspense 使用）。
 * 保持与目标页面接近的视觉重心，避免路由切入时发生剧烈布局抖动 (CLS)。
 */
export const RouteSkeleton: React.FC<RouteSkeletonProps> = ({
  label = '正在装载模块',
  variant = 'catalog',
}) => {
  return (
    <div
      className={`route-skeleton is-${variant}`}
      role="status"
      aria-busy="true"
      aria-label={`${label}，请稍候`}
    >
      <div className={variant === 'workbench' ? 'feature-page-shell' : 'spa-container'}>
        <div className="rskel-header">
          <div className="rskel-telemetry">
            <span className="rskel-led" aria-hidden="true" />
            <span>S7-1200 STUDIO // {label}</span>
          </div>
          <div className="rskel-bar rskel-title" />
          <div className="rskel-bar rskel-subtitle" />
        </div>

        {variant === 'workbench' && (
          <div className="rskel-workbench">
            <div className="rskel-tabs">
              <div className="rskel-pill" />
              <div className="rskel-pill" />
              <div className="rskel-pill" />
              <div className="rskel-pill" />
            </div>
            <div className="rskel-wb-grid">
              <div className="rskel-panel rskel-panel-tall" />
              <div className="rskel-panel rskel-panel-side">
                <div className="rskel-bar rskel-w-60" />
                <div className="rskel-bar rskel-w-90" />
                <div className="rskel-bar rskel-w-75" />
                <div className="rskel-bar rskel-w-85" />
              </div>
            </div>
          </div>
        )}

        {variant === 'reader' && (
          <div className="rskel-reader">
            <div className="rskel-reader-toc">
              <div className="rskel-bar rskel-w-75" />
              <div className="rskel-bar rskel-w-90" />
              <div className="rskel-bar rskel-w-60" />
              <div className="rskel-bar rskel-w-85" />
            </div>
            <div className="rskel-reader-body">
              <div className="rskel-panel rskel-panel-med" />
              <div className="rskel-bar rskel-w-90" />
              <div className="rskel-bar rskel-w-85" />
              <div className="rskel-bar rskel-w-60" />
            </div>
          </div>
        )}

        {variant === 'catalog' && (
          <div className="rskel-cards">
            <div className="rskel-panel rskel-card" />
            <div className="rskel-panel rskel-card" />
            <div className="rskel-panel rskel-card" />
            <div className="rskel-panel rskel-card" />
            <div className="rskel-panel rskel-card" />
            <div className="rskel-panel rskel-card" />
          </div>
        )}
      </div>
    </div>
  );
};
