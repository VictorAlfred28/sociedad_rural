import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional context label for logging (e.g. "PromocionDetalle") */
  context?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary — Catches render errors and shows a premium institutional fallback.
 * Never exposes technical details to the user.
 * Use as a wrapper around any page or section that could throw.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  /** Detecta si el error es por un chunk stale/no encontrado (deploy nuevo) */
  private static isChunkError(error: Error): boolean {
    return (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Importing a module script failed') ||
      error.message.includes('error loading dynamically imported module')
    );
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Logging estructurado — persiste en producción porque preservamos console.error en vite.config.ts
    const context = this.props.context ? `:${this.props.context}` : '';
    console.error(`[ErrorBoundary${context}] ${error.message}`, info.componentStack);

    // Si es un error de chunk stale (deploy nuevo), recargar automáticamente hasta 3 veces
    if (ErrorBoundary.isChunkError(error)) {
      const reloadKey = 'chunk_error_reload';
      const attempts = parseInt(sessionStorage.getItem(reloadKey) ?? '0', 10);
      if (attempts < 3) {
        sessionStorage.setItem(reloadKey, String(attempts + 1));
        window.location.reload();
      }
      // Si ya supera 3 intentos, muestra el fallback con botón "Reintentar"
    }
  }

  handleRetry = () => {
    const errorMsg = this.state.errorMessage;
    const isChunk =
      errorMsg.includes('Failed to fetch') ||
      errorMsg.includes('Loading chunk') ||
      errorMsg.includes('Importing a module script failed') ||
      errorMsg.includes('error loading dynamically imported module');

    if (isChunk) {
      // Limpiar AMBOS guards para permitir un ciclo de auto-reload limpio
      sessionStorage.removeItem('chunk_error_reload');
      sessionStorage.removeItem('vite_chunk_reloads'); // guard de main.tsx
      window.location.reload();
    } else {
      this.setState({ hasError: false, errorMessage: '' });
    }
  };

  render() {
    if (this.state.hasError) {
      // Soporta null como fallback silencioso (ej: Chatbot que falla sin mostrar error)
      if (this.props.fallback !== undefined) return this.props.fallback;

      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-stone-50 dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800">
          <div className="size-20 rounded-[2rem] bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-5 border border-stone-200 dark:border-stone-700">
            <span className="material-symbols-outlined text-4xl text-stone-400">error_outline</span>
          </div>
          <h3 className="text-base font-black uppercase tracking-tight text-stone-700 dark:text-stone-200 mb-2">
            Algo salió mal
          </h3>
          <p className="text-xs text-stone-400 font-medium mb-6 max-w-[240px] leading-relaxed">
            Ocurrió un error inesperado. Por favor, intentá nuevamente.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#245b31] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-sm active:scale-95 transition-all hover:bg-[#1e4f2a]"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
