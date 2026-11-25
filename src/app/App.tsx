import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  CapstoneStudio,
  ModelsShowcase,
  SimulatorWorkbench,
  TiaPortalIdeWorkbench,
  WorkflowsShowcase,
} from '../registry';
import { ProgressProvider } from './store/progressStore';
import { AppShell } from './layout/AppShell';
import { HomePage } from './pages/HomePage';
import { LearnCatalogPage } from './pages/LearnCatalogPage';
import { LessonReaderPage } from './pages/LessonReaderPage';
import { ExamplesHallPage } from './pages/ExamplesHallPage';
import { ExampleDetailPage } from './pages/ExampleDetailPage';
import { GlossaryPage } from './pages/GlossaryPage';
import { useNativeBridge } from './native/useNativeBridge';
import { ErrorBoundary } from '../components/ErrorBoundary';

const FeatureRouteStage: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="feature-page-shell">
    <ErrorBoundary title={`${title} 暂时加载异常`}>{children}</ErrorBoundary>
  </div>
);

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
            <Route path="/learn" element={<LearnCatalogPage />} />
            <Route path="/learn/:lessonId" element={<LessonReaderPage />} />
            <Route
              path="/ide"
              element={
                <FeatureRouteStage title="博途在线编程与联调工作台">
                  <TiaPortalIdeWorkbench />
                </FeatureRouteStage>
              }
            />
            <Route
              path="/sim"
              element={
                <FeatureRouteStage title="PLC 仿真实验室">
                  <SimulatorWorkbench />
                </FeatureRouteStage>
              }
            />
            <Route
              path="/models"
              element={
                <FeatureRouteStage title="设备模型">
                  <ModelsShowcase />
                </FeatureRouteStage>
              }
            />
            <Route path="/examples" element={<ExamplesHallPage />} />
            <Route path="/examples/:id" element={<ExampleDetailPage />} />
            <Route path="/glossary" element={<GlossaryPage />} />
            <Route
              path="/workflows"
              element={
                <FeatureRouteStage title="原理动画">
                  <WorkflowsShowcase />
                </FeatureRouteStage>
              }
            />
            <Route
              path="/capstone"
              element={
                <FeatureRouteStage title="毕业项目">
                  <CapstoneStudio />
                </FeatureRouteStage>
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
