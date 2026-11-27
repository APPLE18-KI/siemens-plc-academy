import React, { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AppShell } from './layout/AppShell';
import { RouteSkeleton, type SkeletonVariant } from './layout/RouteSkeleton';
import { routeLoaders } from './layout/routePreload';
import { useNativeBridge } from './native/useNativeBridge';
import { HomePage } from './pages/HomePage';
import { ProgressProvider } from './store/progressStore';

// 路由级按需动态加载（与 routePreload.ts 共享同一动态导入工厂；VITE_OFFLINE=1 自动内联兼容）
const LearnCatalogPage = React.lazy(routeLoaders.learnCatalog);
const LessonReaderPage = React.lazy(routeLoaders.lessonReader);
const SimulatorWorkbench = React.lazy(routeLoaders.simulator);
const ModelsShowcase = React.lazy(routeLoaders.models);
const ExamplesHallPage = React.lazy(routeLoaders.examplesHall);
const ExampleDetailPage = React.lazy(routeLoaders.exampleDetail);
const GlossaryPage = React.lazy(routeLoaders.glossary);
const ReviewPage = React.lazy(routeLoaders.review);
const AboutPage = React.lazy(routeLoaders.about);
const QaLibraryPage = React.lazy(routeLoaders.qa);
const WorkflowsShowcase = React.lazy(routeLoaders.workflows);
const CapstoneStudio = React.lazy(routeLoaders.capstone);

const LazyRouteStage: React.FC<{
  title: string;
  variant: SkeletonVariant;
  featureShell?: boolean;
  children: React.ReactNode;
}> = ({ title, variant, featureShell = false, children }) => {
  const inner = (
    <ErrorBoundary title={`${title} 暂时加载异常`}>
      <Suspense fallback={<RouteSkeleton label={title} variant={variant} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );

  return featureShell ? <div className="feature-page-shell">{inner}</div> : inner;
};

/** 在 HashRouter 内挂载原生桥接（Android 返回键等），网页端无副作用 */
const NativeBridgeMount: React.FC = () => {
  useNativeBridge();
  return null;
};

export const App: React.FC = () => {
  return (
    <ProgressProvider>
      <HashRouter>
        <NativeBridgeMount />
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/learn"
              element={
                <LazyRouteStage title="课程目录" variant="catalog">
                  <LearnCatalogPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/learn/:lessonId"
              element={
                <LazyRouteStage title="课程精读工作台" variant="reader">
                  <LessonReaderPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/sim"
              element={
                <LazyRouteStage title="PLC 仿真实验室" variant="workbench" featureShell>
                  <SimulatorWorkbench />
                </LazyRouteStage>
              }
            />
            <Route
              path="/models"
              element={
                <LazyRouteStage title="设备数字孪生模型" variant="workbench" featureShell>
                  <ModelsShowcase />
                </LazyRouteStage>
              }
            />
            <Route
              path="/examples"
              element={
                <LazyRouteStage title="经典工程实例馆" variant="catalog">
                  <ExamplesHallPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/examples/:id"
              element={
                <LazyRouteStage title="工程实例详情" variant="reader">
                  <ExampleDetailPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/glossary"
              element={
                <LazyRouteStage title="工控术语表" variant="catalog">
                  <GlossaryPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/review"
              element={
                <LazyRouteStage title="间隔复习与错题中心" variant="catalog">
                  <ReviewPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/about"
              element={
                <LazyRouteStage title="关于与开源许可" variant="catalog">
                  <AboutPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/qa"
              element={
                <LazyRouteStage title="新手问答库" variant="catalog">
                  <QaLibraryPage />
                </LazyRouteStage>
              }
            />
            <Route
              path="/workflows"
              element={
                <LazyRouteStage title="PLC 底层原理动画" variant="workbench" featureShell>
                  <WorkflowsShowcase />
                </LazyRouteStage>
              }
            />
            <Route
              path="/capstone"
              element={
                <LazyRouteStage title="工业毕业大项目实训台" variant="workbench" featureShell>
                  <CapstoneStudio />
                </LazyRouteStage>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </ProgressProvider>
  );
};

export default App;
