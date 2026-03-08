import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" aria-label="Carregando..." />
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Carregando...</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ element, requiredRole }) {
  const { isAuthenticated, usuario, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && usuario?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return element;
}
