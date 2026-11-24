import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  CapstoneStudio,
  ModelsShowcase,
  SimulatorWorkbench,
  WorkflowsShowcase,
} from '../registry';
import { ProgressProvider } from './store/progressStore';
import { AppShell } from './layout/AppShell';
import { HomePage } from './pages/HomePage';
import { LearnCatalogPage } from './pages/LearnCatalogPage';
import { LessonReaderPage } from './pages/LessonReaderPage';
import { ExamplesHallPage } from './pages/ExamplesHallPage';
import { ExampleDetailPage } from './pages/ExampleDetailPage';
import { ErrorBoundary } from '../components/ErrorBoundary';

const FeatureRouteStage: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="feature-page-shell">
    <ErrorBoundary title={`${title} 暂时加载异常`}>{children}</ErrorBoundary>
  </div>
);

export const App: React.FC = () => {
  return (
    <ProgressProvider>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/learn" element={<LearnCatalogPage />} />
            <Route path="/learn/:lessonId" element={<LessonReaderPage />} />
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
                <FeatureRouteStage title="2.5D 数字孪生建模大厅">
                  <ModelsShowcase />
                </FeatureRouteStage>
              }
            />
            <Route path="/examples" element={<ExamplesHallPage />} />
            <Route path="/examples/:id" element={<ExampleDetailPage />} />
            <Route
              path="/workflows"
              element={
                <FeatureRouteStage title="工业工作流解剖大厅">
                  <WorkflowsShowcase />
                </FeatureRouteStage>
              }
            />
            <Route
              path="/capstone"
              element={
                <FeatureRouteStage title="简历毕业大项目实训室">
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
