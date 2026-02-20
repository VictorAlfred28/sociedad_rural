import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full border-l-4 border-red-500">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Algo salió mal (Error de Renderizado)</h1>
                        <p className="text-gray-700 mb-4">La aplicación ha encontrado un error crítico.</p>

                        <div className="bg-gray-100 p-4 rounded overflow-auto max-h-60 mb-4">
                            <p className="font-mono text-sm text-red-700 font-bold">
                                {this.state.error?.toString()}
                            </p>
                        </div>

                        <details className="text-xs text-gray-500 cursor-pointer">
                            <summary>Ver stack trace</summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>

                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                            Recargar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
