import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react({
    tsDecorators: true
  })],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@nova-ecs': resolve(__dirname, '../src')
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    minify: false,
    rollupOptions: {
      external: ['electron']
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  optimizeDeps: {
    exclude: ['@esengine/nova-ecs'],
    include: ['reflect-metadata']
  },
  define: {
    // Fix potential build warnings
    global: 'globalThis',
  },
  esbuild: {
    target: 'esnext',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false
      }
    }
  }
});