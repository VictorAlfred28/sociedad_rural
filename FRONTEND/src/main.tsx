import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Global QueryClient — configured for mobile PWA/Capacitor patterns
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus (mobile PWA re-focus is noisy)
      refetchOnWindowFocus: false,
      // Retry once on network errors
      retry: 1,
      // Consider data fresh for 2 min by default
      staleTime: 2 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary context="Root">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// ── Stale chunk auto-reload ──────────────────────────────────────────────────
// Cuando hay un nuevo deploy, los hashes de los chunks cambian.
// El browser puede tener el index.html viejo que referencia chunks que ya no
// existen (404). Vite emite este evento cuando falla la precarga de un módulo.
// La solución es recargar la página una sola vez para obtener el HTML nuevo.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('vite_chunk_reload')) {
    sessionStorage.setItem('vite_chunk_reload', '1');
    window.location.reload();
  }
});
