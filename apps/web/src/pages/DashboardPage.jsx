import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { Button, Card } from '../design-system/index.js';
import { colors, typography } from '../design-system/tokens.js';

export default function DashboardPage() {
  const { usuario, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column' }}>
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
        <main style={{ flex: 1, maxWidth: '900px', margin: '0 auto', padding: '40px 24px', width: '100%' }}>
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

      {/* Footer */}
      <div style={footerStyle}>
        Finlly • painel financeiro pessoal — {new Date().getFullYear()}
      </div>
    </div>
  );
}

const footerStyle = { backgroundColor: '#33528a', color: '#FFFFFF', textAlign: 'center', paddingTop: '18px', paddingBottom: '18px', paddingLeft: '32px', paddingRight: '32px', fontSize: '14px', fontWeight: '500', letterSpacing: '0.01em' };
