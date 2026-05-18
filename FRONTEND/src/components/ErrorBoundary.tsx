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

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Controlled logging — never exposed to user
    console.error(`[ErrorBoundary${this.props.context ? ':' + this.props.context : ''}]`, error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
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
