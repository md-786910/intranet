import React from 'react';
import ErrorFallback from './ErrorFallback';

/**
 * Catches render errors so the app does not white-screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleRetry })
          : this.props.fallback;
      }
      return (
        <ErrorFallback
          homeTo={this.props.homeTo || '/dashboard'}
          homeLabel={this.props.homeLabel || 'Back to dashboard'}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
