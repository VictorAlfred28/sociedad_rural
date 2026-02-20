import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Deshabilitar source maps en producción para seguridad y tamaño
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'recharts', '@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: true, // Exponer a red local en modo dev
    port: 5173,
  }
});
