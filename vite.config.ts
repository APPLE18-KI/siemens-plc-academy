import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    rollupOptions: {
      output: {
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
