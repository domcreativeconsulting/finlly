import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';

export default function DashboardPage() {
  const { usuario, logout } = useAuth();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Finlly</h1>
        <div style={styles.headerActions}>
          <Link to="/perfil" style={styles.perfilLink}>
            Meu Perfil
          </Link>
          <button
            onClick={logout}
            style={styles.logoutButton}
            aria-label="logout"
          >
            Sair
          </button>
        </div>
      </header>

      <InadimplenteGuard>
        <main style={styles.main}>
          <h2 style={styles.welcome}>
            Olá, {usuario?.nome || 'usuário'}! 👋
          </h2>
          <p style={styles.subtitle}>Bem-vindo ao seu painel financeiro.</p>

          <div style={styles.card}>
            <p style={{ color: '#6b7280' }}>
              Em breve você terá acesso ao seu painel completo.
            </p>
          </div>
        </main>
      </InadimplenteGuard>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#2563eb',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  perfilLink: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#2563eb',
    textDecoration: 'none',
    border: '1px solid #2563eb',
    borderRadius: '6px',
  },
  logoutButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  welcome: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: '32px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    padding: '32px',
  },
};
