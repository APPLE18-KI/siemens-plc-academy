import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || '未知运行时错误',
    };
  }

  componentDidCatch(error: Error): void {
    // Keep console telemetry for debugging without crashing the entire shell
    console.error('[Siemens PLC Academy Boundary]', error);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="empty-state-card"
          style={this.props.compact ? { margin: '12px auto', padding: '24px 18px' } : undefined}
        >
          <AlertTriangle size={28} color="var(--alarm-amber)" />
          <h3>{this.props.title ?? '该交互模块加载遇到异常'}</h3>
          <p>{this.state.errorMessage}</p>
          <button type="button" className="btn btn-sm" onClick={this.handleRetry}>
            <RotateCcw size={14} />
            重新载入模块
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
