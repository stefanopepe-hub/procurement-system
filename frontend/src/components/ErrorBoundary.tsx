import React from 'react';
import { Button, Result } from 'antd';

interface State { hasError: boolean; error?: Error }

class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Qualcosa è andato storto"
          subTitle="Si è verificato un errore inatteso. Riprova o contatta il supporto."
          extra={
            <Button type="primary" onClick={() => this.setState({ hasError: false })}>
              Riprova
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
