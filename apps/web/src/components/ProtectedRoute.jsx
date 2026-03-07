import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

function LoadingScreen() {
  return (
    <div className="auth-loading-screen">
      <div className="auth-spinner" aria-label="Carregando..." />
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
