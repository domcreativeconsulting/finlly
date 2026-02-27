import React from 'react';
import logger from '../config/logger.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      logger.error('[ErrorBoundary] Component error:', error, info.componentStack);
    } else {
      logger.error('[ErrorBoundary] Component error:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial' }}>
            <h2>Algo deu errado.</h2>
            <p>Por favor, tente recarregar a página.</p>
            <button onClick={() => window.location.reload()}>Recarregar</button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
