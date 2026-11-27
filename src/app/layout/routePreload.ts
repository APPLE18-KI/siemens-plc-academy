/**
 * 路由级动态分包加载器与悬停/聚焦预加载表（遵循 vercel-react-best-practices:
 * bundle-dynamic-imports + bundle-preload）。
 * - 正常 Web 构建：按需分块，首屏不加载仿真引擎、2.5D 数字孪生与毕业大项目
 * - VITE_OFFLINE=1（安卓离线包 / 单文件 IIFE）：Rollup 自动 inlineDynamicImports 100% 兼容
 */

export const routeLoaders = {
  learnCatalog: () =>
    import('../pages/LearnCatalogPage').then((m) => ({ default: m.LearnCatalogPage })),
  lessonReader: () =>
    import('../pages/LessonReaderPage').then((m) => ({ default: m.LessonReaderPage })),
  simulator: () =>
    import('../../features/simulator').then((m) => ({ default: m.SimulatorWorkbench })),
  models: () =>
    import('../../features/models').then((m) => ({ default: m.ModelsShowcase })),
  examplesHall: () =>
    import('../pages/ExamplesHallPage').then((m) => ({ default: m.ExamplesHallPage })),
  exampleDetail: () =>
    import('../pages/ExampleDetailPage').then((m) => ({ default: m.ExampleDetailPage })),
  glossary: () =>
    import('../pages/GlossaryPage').then((m) => ({ default: m.GlossaryPage })),
  review: () =>
    import('../pages/ReviewPage').then((m) => ({ default: m.ReviewPage })),
  about: () =>
    import('../pages/AboutPage').then((m) => ({ default: m.AboutPage })),
  qa: () =>
    import('../pages/QaLibraryPage').then((m) => ({ default: m.QaLibraryPage })),
  workflows: () =>
    import('../../features/workflows').then((m) => ({ default: m.WorkflowsShowcase })),
  capstone: () =>
    import('../../content/capstone').then((m) => ({ default: m.CapstoneStudio })),
} as const;

type LoaderKey = keyof typeof routeLoaders;

const preloaded = new Set<LoaderKey>();

function resolveLoaderKey(path: string): LoaderKey | null {
  const clean = path.split('?')[0].split('#')[0];
  if (clean === '/learn') return 'learnCatalog';
  if (clean.startsWith('/learn/')) return 'lessonReader';
  if (clean.startsWith('/sim')) return 'simulator';
  if (clean.startsWith('/models')) return 'models';
  if (clean === '/examples') return 'examplesHall';
  if (clean.startsWith('/examples/')) return 'exampleDetail';
  if (clean.startsWith('/glossary')) return 'glossary';
  if (clean.startsWith('/review')) return 'review';
  if (clean.startsWith('/about')) return 'about';
  if (clean.startsWith('/qa')) return 'qa';
  if (clean.startsWith('/workflows')) return 'workflows';
  if (clean.startsWith('/capstone')) return 'capstone';
  return null;
}

/** 在用户悬停或聚焦链接时预热目标路由代码分块（每个分块仅触发一次） */
export function preloadRoute(path: string): void {
  if (typeof window === 'undefined') return;
  const key = resolveLoaderKey(path);
  if (!key || preloaded.has(key)) return;
  preloaded.add(key);
  void routeLoaders[key]().catch(() => {
    preloaded.delete(key);
  });
}
