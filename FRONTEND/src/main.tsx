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
// Usamos un CONTADOR en sessionStorage (máx 3 intentos) en lugar de un
// booleano para evitar que el guard quede activo de forma permanente.
window.addEventListener('vite:preloadError', () => {
  const attempts = parseInt(sessionStorage.getItem('vite_chunk_reloads') ?? '0', 10);
  if (attempts < 3) {
    sessionStorage.setItem('vite_chunk_reloads', String(attempts + 1));
    window.location.reload();
  }
  // Si ya superó 3 intentos, el ErrorBoundary tomará el control y mostrará
  // el botón "Reintentar" que limpiará los guards manualmente.
});

// ── Limpieza de guards en carga exitosa ──────────────────────────────────────
// Si la app carga correctamente durante 3 segundos sin crashes,
// limpiamos todos los guards para que futuros errors puedan triggear
// el auto-reload nuevamente (crucial en sesiones largas con múltiples deploys).
setTimeout(() => {
  sessionStorage.removeItem('vite_chunk_reloads');
  sessionStorage.removeItem('chunk_error_reload');
}, 3000);

