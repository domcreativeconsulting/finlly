import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { Button, Card } from '../design-system/index.js';
import { colors, typography } from '../design-system/tokens.js';

export default function DashboardPage() {
  const { usuario, logout } = useAuth();

  return (
    <div style={{ height: '100vh', overflow: 'hidden', backgroundColor: colors.bg }}>
      <header
        style={{
          backgroundColor: colors.white,
          borderBottom: `1px solid ${colors.border}`,
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1
          style={{
            fontSize: typography.sizes['4xl'],
            fontWeight: typography.weights.bold,
            color: colors.primaryLight,
            margin: 0,
          }}
        >
          Finlly
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/perfil" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="sm">Meu Perfil</Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={logout} aria-label="logout">
            Sair
          </Button>
        </div>
      </header>

      <InadimplenteGuard>
        <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
          <h2
            style={{
              fontSize: typography.sizes['6xl'],
              fontWeight: typography.weights.bold,
              color: colors.neutral900,
              margin: '0 0 8px',
            }}
          >
            Olá, {usuario?.nome || 'usuário'}! 👋
          </h2>
          <p style={{ color: colors.neutral500, marginBottom: '32px' }}>
            Bem-vindo ao seu painel financeiro.
          </p>

          <Card>
            <p style={{ color: colors.neutral500 }}>
              Em breve você terá acesso ao seu painel completo.
            </p>
          </Card>
        </main>
      </InadimplenteGuard>
    </div>
  );
}
