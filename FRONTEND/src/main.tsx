import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
