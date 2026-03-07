import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { toast } from 'react-toastify';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Erro ao fazer logout.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎉 Dashboard</h1>
        <button
          onClick={handleLogout}
          style={styles.logoutButton}
          aria-label="logout"
        >
          Sair
        </button>
      </div>
      <div style={styles.card}>
        <h2 style={styles.welcome}>
          Bem-vindo, {usuario?.nome || usuario?.email || 'Usuário'}!
        </h2>
        <p style={{ color: '#666' }}>Você está autenticado com sucesso.</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '800px',
    margin: '0 auto 24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111',
    margin: 0,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    padding: '32px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  welcome: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: '8px',
  },
  logoutButton: {
    padding: '8px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
