"use client";

import React from "react";

type ResultErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ResultErrorBoundaryState = {
  hasError: boolean;
};

export class ResultErrorBoundary extends React.Component<ResultErrorBoundaryProps, ResultErrorBoundaryState> {
  state: ResultErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[RESULT_BOUNDARY]", error.message, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
            <div className="max-w-sm space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-[#C9A84C]">Erro ao renderizar</p>
              <p className="text-sm text-white/60">A tela de resultado encontrou um erro inesperado.</p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
