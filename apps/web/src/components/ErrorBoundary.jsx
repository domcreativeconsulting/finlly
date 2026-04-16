import { Component } from 'react';
import logger from '../utils/logger.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    logger.error('React ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'Arial, sans-serif',
            color: '#333',
          }}
        >
          <h2>Algo deu errado</h2>
          <p style={{ color: '#666' }}>
            Ocorreu um erro inesperado. Atualize a página ou tente novamente.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              cursor: 'pointer',
              backgroundColor: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
