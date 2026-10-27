import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: '2rem',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12,
          margin: '1rem',
          fontFamily: 'Inter, sans-serif',
        }}>
          <h2 style={{ color: 'var(--error, #ef4444)', marginBottom: '0.5rem', fontSize: '1rem' }}>
            ⚠ Something went wrong in this section
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <details style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Stack trace</summary>
            <pre style={{ overflow: 'auto', maxHeight: 200 }}>
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            style={{
              marginTop: '1rem',
              padding: '0.4rem 1rem',
              background: 'var(--accent, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
